"""Job History schema."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    execution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("executions.id", ondelete="CASCADE"), index=True
    )
    stage_name: Mapped[str] = mapped_column(String(128), nullable=False)
    stage_order: Mapped[int] = mapped_column(Integer, default=0)
    job_type: Mapped[str] = mapped_column(
        String(32), default="build"
    )  # build | test | deploy | lint | security
    language: Mapped[str] = mapped_column(
        String(32), default="python"
    )
    status: Mapped[str] = mapped_column(
        String(32), default="pending"
    )  # pending | queued | running | success | failed | cancelled
    worker_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cpu: Mapped[int] = mapped_column(Integer, default=1)
    priority_score: Mapped[float] = mapped_column(Float, default=0.0)
    stdout_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # ── Priority-related metadata (denormalized from execution for fast scheduler queries) ──
    branch_name: Mapped[str] = mapped_column(String(128), default="main")
    repo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    commit_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    files_changed: Mapped[int] = mapped_column(Integer, default=1)
    changed_files_list: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["src/auth.py", ...]
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # ── Priority breakdown for frontend visualization ──
    priority_branch: Mapped[float] = mapped_column(Float, default=0.0)
    priority_jobtype: Mapped[float] = mapped_column(Float, default=0.0)
    priority_commit: Mapped[float] = mapped_column(Float, default=0.0)
    priority_aging: Mapped[float] = mapped_column(Float, default=0.0)
    priority_repo: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    execution = relationship("Execution", back_populates="jobs")

    def __repr__(self) -> str:
        return f"<Job {self.stage_name} [{self.status}]>"
