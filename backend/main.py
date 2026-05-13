"""CI/CD Pipeline Manager — FastAPI Application."""
import os
import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy import select, func

from database import init_db, AsyncSessionLocal
from routers import pipelines, executions, webhooks
from engine.scheduler import scheduler
from engine.simulators import start_simulators
from models.job import Job
from models.execution import Execution
from models.pipeline import Pipeline

WEBHOOK_BASE_URL = os.getenv("WEBHOOK_BASE_URL", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables. Shutdown: cleanup."""
    await init_db()
    print("✅ Database tables created / verified")

    # Start Background Task Workers
    asyncio.create_task(scheduler.poll_pending_jobs(AsyncSessionLocal))
    print("✅ Priority Scheduler active (weighted multi-factor algorithm)")

    # Start real-world simulators (random job arrivals & worker completion)
    await start_simulators(AsyncSessionLocal)
    print("✅ Multi-repo simulators active (3 repos, 8 branches)")

    yield
    print("👋 Shutting down")


app = FastAPI(
    title="CI/CD Pipeline Manager API",
    description="Backend API for the CI/CD Job Scheduler, Priority Assigner, and Pipeline Manager.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ─────────────────────────────────────────────
app.include_router(pipelines.router)
app.include_router(executions.router)
app.include_router(webhooks.router)


# ── Health check ────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "service": "ci-cd-pipeline-manager", "version": "2.0.0"}


# ── Webhook info (for frontend setup UI) ────────────────────
@app.get("/api/webhook-info", tags=["Webhooks"])
async def webhook_info(request: Request):
    """Returns the webhook URLs to configure in GitHub/GitLab."""
    base = WEBHOOK_BASE_URL or str(request.base_url).rstrip("/")
    secret = os.getenv("SECRET_KEY", "")
    return {
        "github_url": f"{base}/api/webhooks/github",
        "gitlab_url": f"{base}/api/webhooks/gitlab",
        "secret_configured": bool(secret),
        "base_url": base,
        "instructions": {
            "github": [
                "Go to your GitHub repo → Settings → Webhooks → Add webhook",
                f"Set Payload URL to: {base}/api/webhooks/github",
                "Set Content type to: application/json",
                f"Set Secret to match your SECRET_KEY env var{' (currently configured)' if secret else ' (not set — signatures will be skipped)'}",
                "Select 'Just the push event'",
                "Click 'Add webhook'",
            ],
            "gitlab": [
                "Go to your GitLab repo → Settings → Webhooks",
                f"Set URL to: {base}/api/webhooks/gitlab",
                "Check 'Push events'",
                "Click 'Add webhook'",
            ],
        },
    }


# ── Scheduler Stats API ────────────────────────────────────
@app.get("/api/scheduler/stats", tags=["Scheduler"])
async def scheduler_stats():
    """Returns current priority queue state and scheduler metrics."""
    async with AsyncSessionLocal() as session:
        # Pending jobs sorted by priority
        pending_result = await session.execute(
            select(Job).where(Job.status == "pending").order_by(Job.priority_score.desc())
        )
        pending_jobs = pending_result.scalars().all()

        # Running jobs
        running_result = await session.execute(
            select(Job).where(Job.status == "running")
        )
        running_jobs = running_result.scalars().all()

        # Completed count today
        completed_result = await session.execute(
            select(func.count(Job.id)).where(Job.status == "completed")
        )
        completed_count = completed_result.scalar() or 0

        # Active pipelines count
        pipeline_count_result = await session.execute(
            select(func.count(Pipeline.id))
        )
        pipeline_count = pipeline_count_result.scalar() or 0

        # Branch distribution in queue
        branch_dist = {}
        for job in pending_jobs:
            branch = job.branch_name or "unknown"
            branch_dist[branch] = branch_dist.get(branch, 0) + 1

        return {
            "queue_depth": len(pending_jobs),
            "running_count": len(running_jobs),
            "completed_total": completed_count,
            "active_pipelines": pipeline_count,
            "branch_distribution": branch_dist,
            "priority_queue": [
                {
                    "id": j.id,
                    "stage_name": j.stage_name,
                    "job_type": j.job_type,
                    "branch_name": j.branch_name,
                    "repo_url": j.repo_url,
                    "commit_message": j.commit_message,
                    "files_changed": j.files_changed,
                    "changed_files_list": j.changed_files_list,
                    "commit_sha": j.commit_sha,
                    "priority_score": j.priority_score,
                    "priority_branch": j.priority_branch,
                    "priority_jobtype": j.priority_jobtype,
                    "priority_commit": j.priority_commit,
                    "priority_aging": j.priority_aging,
                    "priority_repo": j.priority_repo,
                    "status": j.status,
                    "created_at": j.created_at.isoformat() if j.created_at else None,
                }
                for j in pending_jobs[:20]
            ],
            "running_jobs": [
                {
                    "id": j.id,
                    "stage_name": j.stage_name,
                    "job_type": j.job_type,
                    "branch_name": j.branch_name,
                    "worker_id": j.worker_id,
                    "priority_score": j.priority_score,
                    "started_at": j.started_at.isoformat() if j.started_at else None,
                }
                for j in running_jobs[:10]
            ],
        }


# ── Serve frontend ──────────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not found. Place index.html in backend/static/"}


# Mount static files if directory exists
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/api/events")
async def sse_events():
    async def event_generator():
        while True:
            await asyncio.sleep(3)
            # Grab live scheduler state
            try:
                async with AsyncSessionLocal() as session:
                    pending = await session.execute(
                        select(func.count(Job.id)).where(Job.status == "pending")
                    )
                    running = await session.execute(
                        select(func.count(Job.id)).where(Job.status == "running")
                    )
                    pending_count = pending.scalar() or 0
                    running_count = running.scalar() or 0

                    # Get the highest-priority pending job info
                    top_job_result = await session.execute(
                        select(Job).where(Job.status == "pending").order_by(Job.priority_score.desc()).limit(1)
                    )
                    top_job = top_job_result.scalar_one_or_none()

                    event_data = {
                        "event": "Scheduler Heartbeat",
                        "timestamp": time.time(),
                        "pending_jobs": pending_count,
                        "running_jobs": running_count,
                    }
                    if top_job:
                        event_data["next_job"] = {
                            "stage": top_job.stage_name,
                            "branch": top_job.branch_name,
                            "score": top_job.priority_score,
                        }

                import json
                yield f"data: {json.dumps(event_data)}\n\n"
            except Exception:
                yield f"data: {{\"event\": \"System Heartbeat\", \"timestamp\": {time.time()}}}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
