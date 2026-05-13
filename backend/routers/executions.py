"""Execution and Job router — trigger runs, view logs, stream results."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.pipeline import Pipeline
from models.execution import Execution
from models.job import Job
from schemas.execution import ExecutionCreate, ExecutionResponse, ExecutionDetail, JobResponse

router = APIRouter(prefix="/api", tags=["Executions"])

def get_pipeline(branch: str | None) -> list[tuple[str, str]]:
    """Determine pipeline stages based on the branch name."""
    branch = (branch or "").lower()
    if branch in ["master", "main"]:
        return [("Build", "build"), ("Test", "test"), ("Deploy", "deploy")]
    elif branch == "test":
        return [("Build", "build"), ("Test", "test")]
    elif branch == "security":
        return [("Build", "build"), ("Security Scan", "security")]
    elif branch == "deploy":
        return [("Build", "build"), ("Deploy", "deploy")]
    elif branch == "quality":
        return [("Build", "build"), ("Lint", "lint"), ("Quality Check", "test")]
    else:
        return [("Build", "build")]


# ── Trigger execution ─────────────────────────────────────

@router.post(
    "/pipelines/{pipeline_id}/execute",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_execution(
    pipeline_id: str,
    data: ExecutionCreate | None = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if data is None:
        data = ExecutionCreate()

    stages = get_pipeline(pipeline.branch)

    execution = Execution(
        pipeline_id=pipeline.id,
        status="pending",
        trigger_type=data.trigger_type,
        trigger_ref=data.trigger_ref,
        total_stages=len(stages),
        branch_name=pipeline.branch or "main",
        commit_message="Manual trigger",
        files_changed=1,
        author="manual",
    )
    db.add(execution)
    await db.flush()

    for order, (stage_name, job_type) in enumerate(stages):
        job = Job(
            execution_id=execution.id,
            stage_name=stage_name,
            stage_order=order,
            job_type=job_type,
            status="pending",
            cpu=2 if job_type in ("build", "deploy") else 1,
            branch_name=pipeline.branch or "main",
            repo_url=pipeline.repo_url,
            commit_message="Manual trigger",
            files_changed=1,
        )
        db.add(job)

    await db.commit()
    await db.refresh(execution)
    return execution


# ── List executions ───────────────────────────────────────

@router.get("/executions", response_model=list[ExecutionResponse])
async def list_executions(
    pipeline_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Execution).order_by(Execution.created_at.desc()).limit(limit)
    if pipeline_id:
        query = query.where(Execution.pipeline_id == pipeline_id)
    if status_filter:
        query = query.where(Execution.status == status_filter)

    result = await db.execute(query)
    return result.scalars().all()


# ── Get execution detail + jobs ───────────────────────────

@router.get("/executions/{execution_id}", response_model=ExecutionDetail)
async def get_execution(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Execution)
        .options(selectinload(Execution.jobs), selectinload(Execution.pipeline))
        .where(Execution.id == execution_id)
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    detail = ExecutionDetail.model_validate(execution)
    detail.pipeline_name = execution.pipeline.name if execution.pipeline else None
    detail.jobs = sorted(
        [JobResponse.model_validate(j) for j in execution.jobs],
        key=lambda j: j.stage_order,
    )
    return detail


# ── Get execution logs (job stdout) ───────────────────────

@router.get("/executions/{execution_id}/logs")
async def get_execution_logs(execution_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Job)
        .where(Job.execution_id == execution_id)
        .order_by(Job.stage_order)
    )
    jobs = result.scalars().all()
    if not jobs:
        raise HTTPException(status_code=404, detail="Execution not found or has no jobs")

    return [
        {
            "stage": j.stage_name,
            "order": j.stage_order,
            "type": j.job_type,
            "status": j.status,
            "log": j.stdout_log or "",
        }
        for j in jobs
    ]

# ── WebSocket log streaming ───────────────────────────────

@router.websocket("/executions/{execution_id}/ws")
async def websocket_logs(websocket: WebSocket, execution_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Received log request for {execution_id}: {data}")
    except WebSocketDisconnect:
        pass
