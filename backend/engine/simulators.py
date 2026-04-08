import asyncio
import random
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from models.pipeline import Pipeline
from models.execution import Execution
from models.job import Job
from routers.executions import STAGE_TEMPLATES, DEFAULT_STAGES, _determine_pipeline_type
from engine.workers import worker_pool

async def webhook_simulator(session_maker):
    """Periodically triggers dummy webhooks to populate random jobs without frontend interaction."""
    print("🤖 Webhook Simulator started")
    repos = [
        {"url": "https://github.com/acme/python-api.git", "branch": "main"},
        {"url": "https://github.com/acme/react-frontend.git", "branch": "main"},
        {"url": "https://github.com/acme/data-pipeline.git", "branch": "develop"},
    ]
    
    while True:
        # Random interval between 20s to 45s
        await asyncio.sleep(random.randint(20, 45))
        try:
            async with session_maker() as session:
                target_repo = random.choice(repos)
                # Ensure pipeline exists
                result = await session.execute(
                    select(Pipeline).where(Pipeline.repo_url == target_repo["url"])
                )
                pipeline = result.scalar_one_or_none()
                
                if not pipeline:
                    pipeline = Pipeline(
                        name=f"Auto Pipeline {target_repo['url'].split('/')[-1]}",
                        repo_url=target_repo["url"],
                        branch=target_repo["branch"],
                        trigger_on_push=True
                    )
                    session.add(pipeline)
                    await session.flush()
                
                ptype = _determine_pipeline_type(pipeline)
                stages = STAGE_TEMPLATES.get(ptype, DEFAULT_STAGES)
                
                execution = Execution(
                    pipeline_id=pipeline.id,
                    status="pending",
                    trigger_type="webhook_push",
                    trigger_ref=f"{target_repo['branch']}@{uuid.uuid4().hex[:8]}",
                    total_stages=len(stages)
                )
                session.add(execution)
                await session.flush()
                
                lang = "javascript" if "react" in target_repo["url"] else "python"
                for order, (stage_name, job_type) in enumerate(stages):
                    job = Job(
                        execution_id=execution.id,
                        stage_name=stage_name,
                        stage_order=order,
                        job_type=job_type,
                        language=lang,
                        status="pending",
                        cpu=2 if job_type in ("build", "deploy") else 1,
                    )
                    session.add(job)
                
                await session.commit()
                print(f"🤖 Simulated Webhook Push on {pipeline.name}!")
        except Exception as e:
            print(f"Webhook simulator err: {e}")

async def worker_execution_simulator(session_maker):
    """Simulates workers finishing jobs sitting in 'running' state."""
    print("🤖 Worker Simulator started")
    while True:
        await asyncio.sleep(3)
        try:
            async with session_maker() as session:
                result = await session.execute(
                    select(Job).where(Job.status == "running")
                )
                running_jobs = result.scalars().all()
                
                now = datetime.now(timezone.utc).timestamp()
                
                for job in running_jobs:
                    started_ts = job.started_at.timestamp() if job.started_at else now
                    elapsed = now - started_ts
                    
                    # Random completion time between 5s to 12s
                    if elapsed > random.uniform(5, 12):
                        job.status = "completed"
                        job.completed_at = datetime.now(timezone.utc)
                        job.duration_seconds = elapsed
                        job.stdout_log = "SIMULATED SUCCESS LOGS OUTPUT...\nCompleted with exit code 0."
                        
                        # Free up CPU in the worker pool
                        if job.worker_id and job.worker_id in worker_pool.workers:
                            worker_pool.workers[job.worker_id]['cpu'] += job.cpu
                
                await session.commit()
                
                # Check execution statuses
                exec_result = await session.execute(
                    select(Execution).where(Execution.status.in_(["pending", "running"]))
                )
                active_execs = exec_result.scalars().all()
                for exec_obj in active_execs:
                    job_res = await session.execute(
                        select(Job).where(Job.execution_id == exec_obj.id)
                    )
                    exec_jobs = job_res.scalars().all()
                    if not exec_jobs:
                        continue
                    
                    all_done = all(j.status in ("completed", "failed") for j in exec_jobs)
                    any_running = any(j.status == "running" for j in exec_jobs)
                    
                    if all_done:
                        exec_obj.status = "completed"
                        exec_obj.completed_at = datetime.now(timezone.utc)
                        exec_obj.completed_stages = len(exec_jobs)
                        if exec_obj.started_at:
                            exec_obj.duration_seconds = exec_obj.completed_at.timestamp() - exec_obj.started_at.timestamp()
                    elif any_running:
                        if exec_obj.status != "running":
                            exec_obj.status = "running"
                            exec_obj.started_at = datetime.now(timezone.utc)
                
                await session.commit()
        except Exception as e:
            print(f"Worker execution simulator err: {e}")

async def start_simulators(session_maker):
    asyncio.create_task(webhook_simulator(session_maker))
    asyncio.create_task(worker_execution_simulator(session_maker))
