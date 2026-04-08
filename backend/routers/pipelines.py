"""Pipeline CRUD router."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.pipeline import Pipeline
from schemas.pipeline import PipelineCreate, PipelineUpdate, PipelineResponse, PipelineListItem

router = APIRouter(prefix="/api/pipelines", tags=["Pipelines"])


@router.post("/", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(data: PipelineCreate, db: AsyncSession = Depends(get_db)):
    pipeline = Pipeline(**data.model_dump())
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.get("/", response_model=list[PipelineListItem])
async def list_pipelines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pipeline).order_by(Pipeline.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: uuid.UUID, data: PipelineUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pipeline, key, value)

    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(pipeline_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    await db.delete(pipeline)
    await db.commit()
