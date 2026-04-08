"""Pydantic schemas for Pipeline CRUD operations."""
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


# ── Request schemas ────────────────────────────────────────

class PipelineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, examples=["deploy-frontend"])
    description: str | None = Field(None, max_length=2000)
    yaml_content: str | None = None
    graph_json: dict | None = None
    repo_url: str | None = Field(None, max_length=512, examples=["https://github.com/acme/app"])
    branch: str = Field("main", max_length=128)
    trigger_on_push: bool = False


class PipelineUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    yaml_content: str | None = None
    graph_json: dict | None = None
    repo_url: str | None = None
    branch: str | None = None
    trigger_on_push: bool | None = None


# ── Response schemas ───────────────────────────────────────

class PipelineResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    yaml_content: str | None
    graph_json: dict | None
    repo_url: str | None
    branch: str
    trigger_on_push: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineListItem(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    repo_url: str | None
    branch: str
    trigger_on_push: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
