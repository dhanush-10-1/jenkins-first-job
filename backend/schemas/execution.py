"""Pydantic schemas for Execution and Job resources."""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Execution schemas ──────────────────────────────────────

class ExecutionCreate(BaseModel):
    trigger_type: str = Field("manual", pattern="^(manual|webhook_push|webhook_mr)$")
    trigger_ref: str | None = None


class ExecutionResponse(BaseModel):
    id: uuid.UUID
    pipeline_id: uuid.UUID
    status: str
    trigger_type: str
    trigger_ref: str | None
    total_stages: int
    completed_stages: int
    duration_seconds: float | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExecutionDetail(ExecutionResponse):
    jobs: list["JobResponse"] = []
    pipeline_name: str | None = None


# ── Job schemas ────────────────────────────────────────────

class JobResponse(BaseModel):
    id: uuid.UUID
    execution_id: uuid.UUID
    stage_name: str
    stage_order: int
    job_type: str
    language: str
    status: str
    worker_id: str | None
    cpu: int
    priority_score: float
    stdout_log: str | None
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Webhook schemas ────────────────────────────────────────

class GitHubPushPayload(BaseModel):
    ref: str = Field(..., examples=["refs/heads/main"])
    after: str = Field(..., examples=["abc1234def5678"])
    repository: dict = Field(..., examples=[{"full_name": "acme/app", "clone_url": "https://github.com/acme/app.git"}])
