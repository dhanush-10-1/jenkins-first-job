"""Execution Logs schema."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipelines.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default="pending"
    )  # pending | running | success | failed | cancelled
    trigger_type: Mapped[str] = mapped_column(
        String(32), default="manual"
    )  # manual | webhook_push | webhook_mr
    trigger_ref: Mapped[str | None] = mapped_column(String(256), nullable=True)  # commit SHA / branch
    total_stages: Mapped[int] = mapped_column(Integer, default=0)
    completed_stages: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    pipeline = relationship("Pipeline", back_populates="executions")
    jobs = relationship("Job", back_populates="execution", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Execution {self.id} [{self.status}]>"
