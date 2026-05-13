"""Webhook handler for GitHub/GitLab push events."""
import hashlib
import hmac
import os
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.pipeline import Pipeline
from models.execution import Execution
from models.job import Job
from routers.executions import STAGE_TEMPLATES, DEFAULT_STAGES, _determine_pipeline_type

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])

WEBHOOK_SECRET = os.getenv("SECRET_KEY", "")


def _verify_github_signature(payload_body: bytes, signature_header: str | None) -> bool:
    """Verify GitHub webhook HMAC-SHA256 signature."""
    if not WEBHOOK_SECRET or not signature_header:
        return not WEBHOOK_SECRET  # skip verification if no secret configured
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        WEBHOOK_SECRET.encode(), payload_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature_header)


def _extract_changed_files(payload: dict) -> list[str]:
    """Extract all distinct changed file paths from the push payload."""
    files = []
    seen = set()
    for commit in payload.get("commits", []):
        for f in commit.get("added", []) + commit.get("modified", []) + commit.get("removed", []):
            if f not in seen:
                files.append(f)
                seen.add(f)
    return files


def _count_files_changed(payload: dict) -> int:
    """Count distinct files changed across all commits in the push payload."""
    return max(1, len(_extract_changed_files(payload)))


def _extract_commit_message(payload: dict) -> str:
    """Extract the head commit message from the payload."""
    head_commit = payload.get("head_commit", {})
    if head_commit:
        return head_commit.get("message", "")
    commits = payload.get("commits", [])
    if commits:
        return commits[-1].get("message", "")
    return ""


def _extract_author(payload: dict) -> str:
    """Extract the pusher / author name from the payload."""
    pusher = payload.get("pusher", {})
    if pusher.get("email"):
        return pusher["email"]
    if pusher.get("name"):
        return pusher["name"]
    sender = payload.get("sender", {})
    return sender.get("login", "unknown")


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_push_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle GitHub push webhook — triggers pipelines matching the repo URL."""
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")

    if not _verify_github_signature(body, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()

    # Extract push info
    ref = payload.get("ref", "")  # e.g. "refs/heads/main"
    branch = ref.replace("refs/heads/", "") if ref.startswith("refs/heads/") else ref
    commit = payload.get("after", "")
    repo = payload.get("repository", {})
    clone_url = repo.get("clone_url", "")
    repo_name = repo.get("full_name", "")

    if not branch or not clone_url:
        raise HTTPException(status_code=400, detail="Missing ref or repository info")

    # Extract commit metadata for priority scoring
    commit_message = _extract_commit_message(payload)
    changed_files = _extract_changed_files(payload)
    files_changed = max(1, len(changed_files))
    commit_sha = payload.get("after", "") or ""
    author = _extract_author(payload)

    # Find pipelines that match this repo + branch and have trigger_on_push enabled
    result = await db.execute(
        select(Pipeline).where(
            Pipeline.trigger_on_push.is_(True),
            Pipeline.branch == branch,
        )
    )
    pipelines = result.scalars().all()

    # Filter by repo URL match (flexible: match on full_name or clone_url)
    matching = [
        p for p in pipelines
        if p.repo_url and (
            repo_name in p.repo_url or clone_url in p.repo_url or p.repo_url in clone_url
        )
    ]

    # Auto-register: create a pipeline if none matched this repo+branch
    if not matching:
        short_name = repo_name.split("/")[-1] if repo_name else clone_url.split("/")[-1].replace(".git", "")
        new_pipeline = Pipeline(
            name=f"{short_name} ({branch})",
            repo_url=clone_url,
            branch=branch,
            trigger_on_push=True,
        )
        db.add(new_pipeline)
        await db.flush()
        matching = [new_pipeline]

    triggered = []
    for pipeline in matching:
        ptype = _determine_pipeline_type(pipeline)
        stages = STAGE_TEMPLATES.get(ptype, DEFAULT_STAGES)

        execution = Execution(
            pipeline_id=pipeline.id,
            status="pending",
            trigger_type="webhook_push",
            trigger_ref=f"{branch}@{commit_sha[:8]}" if commit_sha else branch,
            total_stages=len(stages),
            branch_name=branch,
            commit_message=commit_message,
            files_changed=files_changed,
            changed_files_list=changed_files,
            commit_sha=commit_sha,
            author=author,
        )
        db.add(execution)
        await db.flush()

        lang = "javascript" if "react" in clone_url or "frontend" in clone_url else "python"
        for order, (stage_name, job_type) in enumerate(stages):
            job = Job(
                execution_id=execution.id,
                stage_name=stage_name,
                stage_order=order,
                job_type=job_type,
                language=lang,
                status="pending",
                cpu=2 if job_type in ("build", "deploy") else 1,
                branch_name=branch,
                repo_url=clone_url,
                commit_message=commit_message,
                files_changed=files_changed,
                changed_files_list=changed_files,
                commit_sha=commit_sha,
            )
            db.add(job)

        triggered.append({"pipeline": pipeline.name, "execution_id": str(execution.id)})

    await db.commit()

    return {
        "status": "accepted",
        "repo": repo_name,
        "branch": branch,
        "commit": commit_sha[:8] if commit_sha else None,
        "commit_message": commit_message[:100] if commit_message else None,
        "files_changed": files_changed,
        "changed_files": changed_files[:10],
        "author": author,
        "triggered_pipelines": triggered,
        "total_triggered": len(triggered),
    }


@router.post("/gitlab", status_code=status.HTTP_202_ACCEPTED)
async def gitlab_push_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle GitLab push webhook — same logic, different payload structure."""
    payload = await request.json()

    ref = payload.get("ref", "")
    branch = ref.replace("refs/heads/", "") if ref.startswith("refs/heads/") else ref
    commit = payload.get("checkout_sha", "") or payload.get("after", "")
    project = payload.get("project", {})
    repo_url = project.get("git_http_url", "") or project.get("web_url", "")
    repo_name = project.get("path_with_namespace", "")

    if not branch or not repo_url:
        raise HTTPException(status_code=400, detail="Missing ref or project info")

    # Extract commit metadata
    commits = payload.get("commits", [])
    commit_message = commits[-1].get("message", "") if commits else ""
    changed_files = []
    seen = set()
    for c in commits:
        for f in c.get("added", []) + c.get("modified", []) + c.get("removed", []):
            if f not in seen:
                changed_files.append(f)
                seen.add(f)
    files_changed = max(1, len(changed_files))
    commit_sha = payload.get("checkout_sha", "") or payload.get("after", "")
    author = payload.get("user_email", "") or payload.get("user_name", "unknown")

    result = await db.execute(
        select(Pipeline).where(
            Pipeline.trigger_on_push.is_(True),
            Pipeline.branch == branch,
        )
    )
    pipelines = result.scalars().all()

    matching = [
        p for p in pipelines
        if p.repo_url and (
            repo_name in p.repo_url or repo_url in p.repo_url or p.repo_url in repo_url
        )
    ]

    # Auto-register: create a pipeline if none matched
    if not matching:
        short_name = repo_name.split("/")[-1] if repo_name else "pipeline"
        new_pipeline = Pipeline(
            name=f"{short_name} ({branch})",
            repo_url=repo_url,
            branch=branch,
            trigger_on_push=True,
        )
        db.add(new_pipeline)
        await db.flush()
        matching = [new_pipeline]

    triggered = []
    for pipeline in matching:
        ptype = _determine_pipeline_type(pipeline)
        stages = STAGE_TEMPLATES.get(ptype, DEFAULT_STAGES)

        execution = Execution(
            pipeline_id=pipeline.id,
            status="pending",
            trigger_type="webhook_push",
            trigger_ref=f"{branch}@{commit_sha[:8]}" if commit_sha else branch,
            total_stages=len(stages),
            branch_name=branch,
            commit_message=commit_message,
            files_changed=files_changed,
            changed_files_list=changed_files,
            commit_sha=commit_sha,
            author=author,
        )
        db.add(execution)
        await db.flush()

        lang = "javascript" if "react" in repo_url or "frontend" in repo_url else "python"
        for order, (stage_name, job_type) in enumerate(stages):
            job = Job(
                execution_id=execution.id,
                stage_name=stage_name,
                stage_order=order,
                job_type=job_type,
                language=lang,
                status="pending",
                cpu=2 if job_type in ("build", "deploy") else 1,
                branch_name=branch,
                repo_url=repo_url,
                commit_message=commit_message,
                files_changed=files_changed,
                changed_files_list=changed_files,
                commit_sha=commit_sha,
            )
            db.add(job)

        triggered.append({"pipeline": pipeline.name, "execution_id": str(execution.id)})

    await db.commit()

    return {
        "status": "accepted",
        "repo": repo_name,
        "branch": branch,
        "commit": commit_sha[:8] if commit_sha else None,
        "commit_message": commit_message[:100] if commit_message else None,
        "files_changed": files_changed,
        "changed_files": changed_files[:10],
        "author": author,
        "triggered_pipelines": triggered,
        "total_triggered": len(triggered),
    }
