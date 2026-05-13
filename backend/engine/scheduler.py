"""
Priority-Based Job Scheduler
=============================
Replaces simple FIFO with a weighted multi-factor priority algorithm.

Priority Formula:
  score = (branch_w × 30) + (jobtype_w × 25) + (commit_w × 20) + (aging_w × 15) + (repo_w × 10)

Each factor weight is normalized to 0.0–1.0, then multiplied by the factor's
maximum contribution.  The final score ranges from 0 to 100.

Factor Criteria (deterministic — never random):
  1. Branch Type:  hotfix/* → 1.0, main/master → 0.9, release/* → 0.8,
                   staging → 0.7, develop → 0.5, feature/* → 0.3, others → 0.2
  2. Job Type:     security → 1.0, deploy → 0.9, build → 0.6, test → 0.5, lint → 0.3
  3. Commit Signal: Keywords in commit message + files-changed magnitude
  4. Aging:        seconds_waiting / 120  (capped at 1.0 after 2 min)
  5. Repo Priority: Production repos ranked higher via lookup table
"""

import asyncio
import re
from datetime import datetime, timezone
from sqlalchemy import select
from models.job import Job
from engine.workers import worker_pool

# ─────────────────────────────────────────────────────────────
# Factor Weight Configuration (must sum to 100)
# ─────────────────────────────────────────────────────────────
WEIGHT_BRANCH   = 30
WEIGHT_JOBTYPE  = 25
WEIGHT_COMMIT   = 20
WEIGHT_AGING    = 15
WEIGHT_REPO     = 10

# ─────────────────────────────────────────────────────────────
# 1. Branch-Type Scoring
# ─────────────────────────────────────────────────────────────
BRANCH_SCORES = {
    "main": 0.9,
    "master": 0.9,
    "staging": 0.7,
    "develop": 0.5,
}

def _score_branch(branch: str) -> float:
    """Deterministic branch priority based on naming convention."""
    branch_lower = branch.lower().strip()
    # Exact match first
    if branch_lower in BRANCH_SCORES:
        return BRANCH_SCORES[branch_lower]
    # Prefix match
    if branch_lower.startswith("hotfix/") or branch_lower.startswith("hotfix-"):
        return 1.0
    if branch_lower.startswith("release/") or branch_lower.startswith("release-"):
        return 0.8
    if branch_lower.startswith("bugfix/") or branch_lower.startswith("bugfix-"):
        return 0.7
    if branch_lower.startswith("feature/") or branch_lower.startswith("feature-"):
        return 0.3
    return 0.2  # unknown / experimental branches

# ─────────────────────────────────────────────────────────────
# 2. Job-Type Scoring
# ─────────────────────────────────────────────────────────────
JOBTYPE_SCORES = {
    "security": 1.0,
    "deploy":   0.9,
    "build":    0.6,
    "test":     0.5,
    "lint":     0.3,
}

def _score_jobtype(job_type: str) -> float:
    return JOBTYPE_SCORES.get(job_type.lower(), 0.4)

# ─────────────────────────────────────────────────────────────
# 3. Commit-Signal Scoring (message keywords + files changed)
# ─────────────────────────────────────────────────────────────
URGENT_PATTERNS = [
    (re.compile(r"\[urgent\]", re.IGNORECASE), 0.35),
    (re.compile(r"\[hotfix\]", re.IGNORECASE), 0.30),
    (re.compile(r"\bfix:", re.IGNORECASE), 0.20),
    (re.compile(r"\bfeat:", re.IGNORECASE), 0.15),
    (re.compile(r"\bbreaking\b", re.IGNORECASE), 0.25),
    (re.compile(r"\bcritical\b", re.IGNORECASE), 0.30),
    (re.compile(r"\brevert\b", re.IGNORECASE), 0.20),
]

def _score_commit(commit_message: str | None, files_changed: int) -> float:
    """Score based on commit message keywords and number of files changed."""
    score = 0.0
    if commit_message:
        for pattern, weight in URGENT_PATTERNS:
            if pattern.search(commit_message):
                score += weight
    # Files-changed component: more files → bigger change → higher priority
    # Normalize: 1 file → 0.1, 5 → 0.3, 10+ → 0.5
    files_score = min(0.5, files_changed * 0.05)
    score += files_score
    return min(1.0, score)

# ─────────────────────────────────────────────────────────────
# 4. Aging Scoring (prevents starvation)
# ─────────────────────────────────────────────────────────────
AGING_CAP_SECONDS = 120  # 2 minutes to reach max aging bonus

def _score_aging(created_at: datetime | None) -> float:
    if not created_at:
        return 0.0
    now = datetime.now(timezone.utc).timestamp()
    wait = now - created_at.timestamp()
    return min(1.0, max(0.0, wait / AGING_CAP_SECONDS))

# ─────────────────────────────────────────────────────────────
# 5. Repository Priority Scoring
# ─────────────────────────────────────────────────────────────
REPO_PRIORITY = {
    "https://github.com/acme/python-api.git": 0.9,        # production backend
    "https://github.com/acme/react-frontend.git": 0.8,    # production frontend
    "https://github.com/acme/data-pipeline.git": 0.7,     # data infrastructure
}

def _score_repo(repo_url: str | None) -> float:
    if not repo_url:
        return 0.5  # default mid-priority
    return REPO_PRIORITY.get(repo_url, 0.5)


# ═════════════════════════════════════════════════════════════
# Main Priority Calculator
# ═════════════════════════════════════════════════════════════
def calculate_priority(
    branch: str,
    job_type: str,
    commit_message: str | None,
    files_changed: int,
    created_at: datetime | None,
    repo_url: str | None,
) -> tuple[float, float, float, float, float, float]:
    """
    Returns (total_score, branch_score, jobtype_score, commit_score, aging_score, repo_score).
    All individual scores are their *weighted* contributions (not raw 0-1).
    Total is the sum, ranging from 0 to 100.
    """
    b = _score_branch(branch) * WEIGHT_BRANCH
    j = _score_jobtype(job_type) * WEIGHT_JOBTYPE
    c = _score_commit(commit_message, files_changed) * WEIGHT_COMMIT
    a = _score_aging(created_at) * WEIGHT_AGING
    r = _score_repo(repo_url) * WEIGHT_REPO

    total = round(b + j + c + a + r, 2)
    return total, round(b, 2), round(j, 2), round(c, 2), round(a, 2), round(r, 2)


# ═════════════════════════════════════════════════════════════
# Scheduler
# ═════════════════════════════════════════════════════════════
class TaskScheduler:
    async def poll_pending_jobs(self, async_session_maker):
        print("🚀 Priority Scheduler started (weighted multi-factor algorithm)")
        while True:
            await asyncio.sleep(2)  # poll every 2 seconds
            try:
                async with async_session_maker() as session:
                    result = await session.execute(
                        select(Job).where(Job.status == "pending")
                    )
                    jobs = result.scalars().all()

                    if not jobs:
                        continue

                    # Compute priority for every pending job
                    for job in jobs:
                        total, p_branch, p_jtype, p_commit, p_aging, p_repo = calculate_priority(
                            branch=job.branch_name or "main",
                            job_type=job.job_type,
                            commit_message=job.commit_message,
                            files_changed=job.files_changed or 1,
                            created_at=job.created_at,
                            repo_url=job.repo_url,
                        )
                        job.priority_score = total
                        job.priority_branch = p_branch
                        job.priority_jobtype = p_jtype
                        job.priority_commit = p_commit
                        job.priority_aging = p_aging
                        job.priority_repo = p_repo

                    # Sort by priority score DESCENDING (highest priority first)
                    jobs.sort(key=lambda j: j.priority_score, reverse=True)

                    assigned = False
                    for job in jobs:
                        worker_id = worker_pool.get_available_worker(job.cpu, job.language)
                        if worker_id:
                            job.status = "running"
                            job.worker_id = worker_id
                            worker_pool.workers[worker_id]['cpu'] -= job.cpu
                            job.started_at = datetime.now(timezone.utc)
                            assigned = True

                            # Log priority decision
                            print(
                                f"📊 Scheduled [{job.stage_name}] "
                                f"branch={job.branch_name} type={job.job_type} "
                                f"score={job.priority_score:.1f} "
                                f"(B:{job.priority_branch:.1f} J:{job.priority_jobtype:.1f} "
                                f"C:{job.priority_commit:.1f} A:{job.priority_aging:.1f} "
                                f"R:{job.priority_repo:.1f})"
                            )

                            # REAL EXECUTION in background
                            from engine.executor import execute_job_real
                            asyncio.create_task(
                                execute_job_real(job.id, worker_id, async_session_maker)
                            )

                    if assigned:
                        await session.commit()
            except Exception as e:
                print(f"Error in scheduler: {e}")

scheduler = TaskScheduler()
