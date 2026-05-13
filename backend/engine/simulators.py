"""
Multi-Repo / Multi-Branch Webhook & Worker Simulators
======================================================
Simulates realistic git push events across 3 repositories and 8 branches,
each with distinct commit patterns that exercise the priority scheduler.
Each commit includes a list of specific files changed for traceability.
"""

import asyncio
import random
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from models.pipeline import Pipeline
from models.execution import Execution
from models.job import Job
from routers.executions import STAGE_TEMPLATES, DEFAULT_STAGES, _determine_pipeline_type
from engine.workers import worker_pool

# ═════════════════════════════════════════════════════════════
# Repository & Branch Configuration  (3 repos × 2+ branches = 8 branches)
# Each commit template includes the exact file paths that were changed.
# ═════════════════════════════════════════════════════════════
REPO_BRANCHES = [
    # ── Repo 1: Python API (production backend) ──
    {
        "url": "https://github.com/acme/python-api.git",
        "branch": "main",
        "language": "python",
        "commit_templates": [
            {
                "message": "fix: resolve auth token expiry issue",
                "files": 3,
                "author": "alice@acme.com",
                "changed_files": [
                    "src/auth/token_manager.py",
                    "src/auth/middleware.py",
                    "tests/test_token_expiry.py",
                ],
            },
            {
                "message": "feat: add rate limiting middleware",
                "files": 7,
                "author": "bob@acme.com",
                "changed_files": [
                    "src/middleware/rate_limiter.py",
                    "src/middleware/__init__.py",
                    "src/config/rate_limits.yaml",
                    "src/routes/api_v2.py",
                    "tests/test_rate_limiter.py",
                    "tests/fixtures/rate_limit_data.json",
                    "docs/api/rate-limiting.md",
                ],
            },
            {
                "message": "[urgent] fix: patch SQL injection vulnerability",
                "files": 2,
                "author": "carol@acme.com",
                "changed_files": [
                    "src/db/query_builder.py",
                    "src/db/sanitizer.py",
                ],
            },
            {
                "message": "chore: update dependencies to latest versions",
                "files": 1,
                "author": "dave@acme.com",
                "changed_files": [
                    "requirements.txt",
                ],
            },
        ],
    },
    {
        "url": "https://github.com/acme/python-api.git",
        "branch": "develop",
        "language": "python",
        "commit_templates": [
            {
                "message": "feat: implement user profile endpoints",
                "files": 5,
                "author": "alice@acme.com",
                "changed_files": [
                    "src/routes/users.py",
                    "src/models/user_profile.py",
                    "src/schemas/user.py",
                    "src/services/user_service.py",
                    "tests/test_user_profile.py",
                ],
            },
            {
                "message": "refactor: extract validation logic into utils",
                "files": 4,
                "author": "bob@acme.com",
                "changed_files": [
                    "src/utils/validators.py",
                    "src/routes/orders.py",
                    "src/routes/payments.py",
                    "tests/test_validators.py",
                ],
            },
            {
                "message": "fix: handle edge case in pagination",
                "files": 2,
                "author": "carol@acme.com",
                "changed_files": [
                    "src/utils/pagination.py",
                    "tests/test_pagination.py",
                ],
            },
        ],
    },
    {
        "url": "https://github.com/acme/python-api.git",
        "branch": "feature/oauth2-integration",
        "language": "python",
        "commit_templates": [
            {
                "message": "feat: add OAuth2 provider configuration",
                "files": 6,
                "author": "alice@acme.com",
                "changed_files": [
                    "src/auth/oauth2_provider.py",
                    "src/auth/oauth2_config.py",
                    "src/config/oauth2.yaml",
                    "src/routes/auth.py",
                    "src/models/oauth_token.py",
                    "tests/test_oauth2_config.py",
                ],
            },
            {
                "message": "feat: implement token refresh flow",
                "files": 4,
                "author": "alice@acme.com",
                "changed_files": [
                    "src/auth/token_refresh.py",
                    "src/auth/oauth2_provider.py",
                    "src/middleware/auth_middleware.py",
                    "tests/test_token_refresh.py",
                ],
            },
            {
                "message": "test: add OAuth2 integration tests",
                "files": 3,
                "author": "alice@acme.com",
                "changed_files": [
                    "tests/integration/test_oauth2_flow.py",
                    "tests/fixtures/oauth2_mocks.py",
                    "tests/conftest.py",
                ],
            },
        ],
    },

    # ── Repo 2: React Frontend (production SPA) ──
    {
        "url": "https://github.com/acme/react-frontend.git",
        "branch": "main",
        "language": "javascript",
        "commit_templates": [
            {
                "message": "fix: resolve SSR hydration mismatch",
                "files": 2,
                "author": "eve@acme.com",
                "changed_files": [
                    "src/app/layout.tsx",
                    "src/components/ClientWrapper.tsx",
                ],
            },
            {
                "message": "feat: add dark mode toggle component",
                "files": 5,
                "author": "frank@acme.com",
                "changed_files": [
                    "src/components/ThemeToggle.tsx",
                    "src/context/ThemeProvider.tsx",
                    "src/styles/themes/dark.css",
                    "src/styles/themes/light.css",
                    "src/hooks/useTheme.ts",
                ],
            },
            {
                "message": "[critical] fix: XSS vulnerability in markdown renderer",
                "files": 1,
                "author": "carol@acme.com",
                "changed_files": [
                    "src/components/MarkdownRenderer.tsx",
                ],
            },
        ],
    },
    {
        "url": "https://github.com/acme/react-frontend.git",
        "branch": "staging",
        "language": "javascript",
        "commit_templates": [
            {
                "message": "feat: implement dashboard analytics widgets",
                "files": 8,
                "author": "eve@acme.com",
                "changed_files": [
                    "src/pages/Dashboard.tsx",
                    "src/components/widgets/LineChart.tsx",
                    "src/components/widgets/BarChart.tsx",
                    "src/components/widgets/PieChart.tsx",
                    "src/components/widgets/StatCard.tsx",
                    "src/hooks/useAnalytics.ts",
                    "src/api/analytics.ts",
                    "src/types/analytics.d.ts",
                ],
            },
            {
                "message": "fix: correct responsive layout breakpoints",
                "files": 3,
                "author": "frank@acme.com",
                "changed_files": [
                    "src/styles/breakpoints.css",
                    "src/components/layout/Sidebar.tsx",
                    "src/components/layout/Header.tsx",
                ],
            },
            {
                "message": "chore: upgrade React to v19",
                "files": 12,
                "author": "eve@acme.com",
                "changed_files": [
                    "package.json",
                    "package-lock.json",
                    "src/app/layout.tsx",
                    "src/components/Suspense.tsx",
                    "src/components/ErrorBoundary.tsx",
                    "src/hooks/useTransition.ts",
                    "src/hooks/useOptimistic.ts",
                    "tsconfig.json",
                    "vite.config.ts",
                    "src/types/react.d.ts",
                    "tests/setup.ts",
                    "docs/migration-guide.md",
                ],
            },
        ],
    },

    # ── Repo 3: Data Pipeline (infrastructure) ──
    {
        "url": "https://github.com/acme/data-pipeline.git",
        "branch": "main",
        "language": "python",
        "commit_templates": [
            {
                "message": "feat: add Kafka consumer for event streaming",
                "files": 6,
                "author": "grace@acme.com",
                "changed_files": [
                    "src/consumers/kafka_consumer.py",
                    "src/consumers/event_handler.py",
                    "src/config/kafka.yaml",
                    "src/models/event.py",
                    "src/serializers/avro_serializer.py",
                    "tests/test_kafka_consumer.py",
                ],
            },
            {
                "message": "[hotfix] fix: data loss in batch processor",
                "files": 2,
                "author": "henry@acme.com",
                "changed_files": [
                    "src/processors/batch_processor.py",
                    "src/processors/checkpoint_manager.py",
                ],
            },
            {
                "message": "fix: correct timezone handling in ETL jobs",
                "files": 3,
                "author": "grace@acme.com",
                "changed_files": [
                    "src/etl/transform.py",
                    "src/utils/timezone.py",
                    "tests/test_timezone.py",
                ],
            },
        ],
    },
    {
        "url": "https://github.com/acme/data-pipeline.git",
        "branch": "develop",
        "language": "python",
        "commit_templates": [
            {
                "message": "feat: implement real-time anomaly detection",
                "files": 9,
                "author": "grace@acme.com",
                "changed_files": [
                    "src/ml/anomaly_detector.py",
                    "src/ml/feature_extractor.py",
                    "src/ml/model_loader.py",
                    "src/ml/training/train_anomaly.py",
                    "src/config/anomaly_thresholds.yaml",
                    "src/api/anomaly_endpoints.py",
                    "src/models/anomaly_result.py",
                    "tests/test_anomaly_detector.py",
                    "models/anomaly_v1.pkl",
                ],
            },
            {
                "message": "refactor: migrate from Pandas to Polars",
                "files": 15,
                "author": "henry@acme.com",
                "changed_files": [
                    "src/etl/extract.py",
                    "src/etl/transform.py",
                    "src/etl/load.py",
                    "src/etl/pipeline_runner.py",
                    "src/utils/dataframe_utils.py",
                    "src/utils/io_helpers.py",
                    "src/processors/aggregator.py",
                    "src/processors/cleaner.py",
                    "src/processors/enricher.py",
                    "requirements.txt",
                    "tests/test_extract.py",
                    "tests/test_transform.py",
                    "tests/test_load.py",
                    "tests/test_aggregator.py",
                    "docs/polars-migration.md",
                ],
            },
            {
                "message": "feat: add data quality validation pipeline",
                "files": 7,
                "author": "grace@acme.com",
                "changed_files": [
                    "src/quality/validator.py",
                    "src/quality/rules_engine.py",
                    "src/quality/report_generator.py",
                    "src/config/quality_rules.yaml",
                    "src/models/quality_report.py",
                    "tests/test_quality_validator.py",
                    "tests/test_rules_engine.py",
                ],
            },
        ],
    },
    {
        "url": "https://github.com/acme/data-pipeline.git",
        "branch": "hotfix/critical-fix",
        "language": "python",
        "commit_templates": [
            {
                "message": "[urgent] [hotfix] fix: critical memory leak in stream processor",
                "files": 1,
                "author": "henry@acme.com",
                "changed_files": [
                    "src/processors/stream_processor.py",
                ],
            },
            {
                "message": "[hotfix] fix: revert broken schema migration",
                "files": 2,
                "author": "grace@acme.com",
                "changed_files": [
                    "migrations/versions/003_add_index.py",
                    "migrations/versions/002_rollback.py",
                ],
            },
        ],
    },
]

# Weighted probabilities to simulate realistic push frequencies:
# main/hotfix branches push less often but are higher priority
PUSH_WEIGHTS = {
    "main": 2,
    "develop": 4,
    "staging": 3,
    "feature/oauth2-integration": 5,
    "hotfix/critical-fix": 1,
}


def _get_push_weight(branch: str) -> int:
    return PUSH_WEIGHTS.get(branch, 3)


# ═════════════════════════════════════════════════════════════
# Webhook Simulator
# ═════════════════════════════════════════════════════════════
async def webhook_simulator(session_maker):
    """Periodically simulates git pushes across 3 repos / 8 branches."""
    print("🤖 Multi-Repo Webhook Simulator started (3 repos, 8 branches)")

    # Build weighted selection list
    weighted_entries = []
    for entry in REPO_BRANCHES:
        weight = _get_push_weight(entry["branch"])
        weighted_entries.extend([entry] * weight)

    while True:
        # Random interval between 15s to 35s
        await asyncio.sleep(random.randint(15, 35))
        try:
            async with session_maker() as session:
                target = random.choice(weighted_entries)
                commit = random.choice(target["commit_templates"])
                commit_sha = uuid.uuid4().hex[:40]

                # Ensure pipeline exists for this repo+branch
                result = await session.execute(
                    select(Pipeline).where(
                        Pipeline.repo_url == target["url"],
                        Pipeline.branch == target["branch"],
                    )
                )
                pipeline = result.scalar_one_or_none()

                if not pipeline:
                    # Derive pipeline name from repo + branch
                    repo_short = target["url"].split("/")[-1].replace(".git", "")
                    pipeline = Pipeline(
                        name=f"{repo_short} ({target['branch']})",
                        repo_url=target["url"],
                        branch=target["branch"],
                        trigger_on_push=True,
                    )
                    session.add(pipeline)
                    await session.flush()

                ptype = _determine_pipeline_type(pipeline)
                stages = STAGE_TEMPLATES.get(ptype, DEFAULT_STAGES)

                execution = Execution(
                    pipeline_id=pipeline.id,
                    status="pending",
                    trigger_type="webhook_push",
                    trigger_ref=f"{target['branch']}@{commit_sha[:8]}",
                    total_stages=len(stages),
                    branch_name=target["branch"],
                    commit_message=commit["message"],
                    files_changed=commit["files"],
                    changed_files_list=commit["changed_files"],
                    commit_sha=commit_sha,
                    author=commit["author"],
                )
                session.add(execution)
                await session.flush()

                for order, (stage_name, job_type) in enumerate(stages):
                    job = Job(
                        execution_id=execution.id,
                        stage_name=stage_name,
                        stage_order=order,
                        job_type=job_type,
                        language=target["language"],
                        status="pending",
                        cpu=2 if job_type in ("build", "deploy") else 1,
                        # Priority metadata (will be scored by scheduler)
                        branch_name=target["branch"],
                        repo_url=target["url"],
                        commit_message=commit["message"],
                        files_changed=commit["files"],
                        changed_files_list=commit["changed_files"],
                        commit_sha=commit_sha,
                    )
                    session.add(job)

                await session.commit()
                file_list_short = ", ".join(
                    f.split("/")[-1] for f in commit["changed_files"][:3]
                )
                if len(commit["changed_files"]) > 3:
                    file_list_short += f" (+{len(commit['changed_files']) - 3} more)"
                print(
                    f"🤖 Push → {target['url'].split('/')[-1].replace('.git','')}:{target['branch']} "
                    f"| \"{commit['message'][:50]}\" | files: {file_list_short} | by {commit['author']}"
                )
        except Exception as e:
            print(f"Webhook simulator err: {e}")


# ═════════════════════════════════════════════════════════════
# Worker Execution Simulator
# ═════════════════════════════════════════════════════════════
async def worker_execution_simulator(session_maker):
    """Simulates workers finishing jobs sitting in 'running' state."""
    print("🤖 Worker Simulator started")
    while True:
        await asyncio.sleep(3)
        try:
            async with session_maker() as session:
                result = await session.execute(
                    select(Job).where(Job.status == "running")
                )
                running_jobs = result.scalars().all()

                now = datetime.now(timezone.utc).timestamp()

                for job in running_jobs:
                    started_ts = job.started_at.timestamp() if job.started_at else now
                    elapsed = now - started_ts

                    # Random completion time between 5s to 12s
                    if elapsed > random.uniform(5, 12):
                        job.status = "completed"
                        job.completed_at = datetime.now(timezone.utc)
                        job.duration_seconds = elapsed

                        # Build detailed log with file list
                        files_section = ""
                        if job.changed_files_list:
                            files_section = "\nChanged Files:\n" + "\n".join(
                                f"  → {f}" for f in job.changed_files_list
                            ) + "\n"

                        job.stdout_log = (
                            f"=== {job.stage_name} ({job.job_type}) ===\n"
                            f"Repository: {job.repo_url or 'N/A'}\n"
                            f"Branch: {job.branch_name}\n"
                            f"Commit: {job.commit_sha or 'N/A'}\n"
                            f"Message: {job.commit_message or 'N/A'}\n"
                            f"{files_section}"
                            f"Priority Score: {job.priority_score:.1f}\n"
                            f"  Branch: {job.priority_branch:.1f} | JobType: {job.priority_jobtype:.1f} | "
                            f"Commit: {job.priority_commit:.1f} | Aging: {job.priority_aging:.1f} | "
                            f"Repo: {job.priority_repo:.1f}\n"
                            f"---\n"
                            f"Executed on worker {job.worker_id}\n"
                            f"Duration: {elapsed:.1f}s\n"
                            f"Completed with exit code 0."
                        )

                        # Free up CPU in the worker pool
                        if job.worker_id and job.worker_id in worker_pool.workers:
                            worker_pool.workers[job.worker_id]['cpu'] += job.cpu

                await session.commit()

                # Check execution statuses
                exec_result = await session.execute(
                    select(Execution).where(Execution.status.in_(["pending", "running"]))
                )
                active_execs = exec_result.scalars().all()
                for exec_obj in active_execs:
                    job_res = await session.execute(
                        select(Job).where(Job.execution_id == exec_obj.id)
                    )
                    exec_jobs = job_res.scalars().all()
                    if not exec_jobs:
                        continue

                    all_done = all(j.status in ("completed", "failed") for j in exec_jobs)
                    any_running = any(j.status == "running" for j in exec_jobs)

                    if all_done:
                        exec_obj.status = "completed"
                        exec_obj.completed_at = datetime.now(timezone.utc)
                        exec_obj.completed_stages = len(exec_jobs)
                        if exec_obj.started_at:
                            exec_obj.duration_seconds = exec_obj.completed_at.timestamp() - exec_obj.started_at.timestamp()
                    elif any_running:
                        if exec_obj.status != "running":
                            exec_obj.status = "running"
                            exec_obj.started_at = datetime.now(timezone.utc)

                await session.commit()
        except Exception as e:
            print(f"Worker execution simulator err: {e}")


async def start_simulators(session_maker):
    # asyncio.create_task(webhook_simulator(session_maker))
    asyncio.create_task(worker_execution_simulator(session_maker))
