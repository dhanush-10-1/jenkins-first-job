"""Job History schema."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    execution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("executions.id", ondelete="CASCADE"), index=True
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

    # Relationships
    execution = relationship("Execution", back_populates="jobs")

    def __repr__(self) -> str:
        return f"<Job {self.stage_name} [{self.status}]>"
