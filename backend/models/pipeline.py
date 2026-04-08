"""Pipeline Definitions schema."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    yaml_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    graph_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    repo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    branch: Mapped[str] = mapped_column(String(128), default="main")
    trigger_on_push: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    executions = relationship("Execution", back_populates="pipeline", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Pipeline {self.name} ({self.id})>"
