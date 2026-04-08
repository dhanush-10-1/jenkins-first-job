import asyncio
from typing import Dict, Any, List
import time
from datetime import datetime, timezone
from sqlalchemy import select
from models.job import Job
from engine.workers import worker_pool

class TaskScheduler:
    def calculate_priority(self, job_type: str, wait_time: int, cpu: int, manual: bool) -> int:
        type_multiplier = 40 if job_type in ('deploy', 'security') else 20
        return type_multiplier + (wait_time * 30) + (cpu * 20) + (10 if manual else 0)

    async def poll_pending_jobs(self, async_session_maker):
        print("🚀 Scheduler Poller started")
        while True:
            await asyncio.sleep(2)  # poll every 2 seconds
            try:
                async with async_session_maker() as session:
                    result = await session.execute(
                        select(Job).where(Job.status == "pending")
                    )
                    jobs = result.scalars().all()

                    if not jobs:
                        continue

                    # Compute priority
                    now = datetime.now(timezone.utc).timestamp()
                    for job in jobs:
                        wait = int(now - job.created_at.timestamp()) if job.created_at else 0
                        job.priority_score = self.calculate_priority(job.job_type, wait, job.cpu, False)
                    
                    # Sort by score descending
                    jobs.sort(key=lambda j: j.priority_score, reverse=True)

                    assigned = False
                    for job in jobs:
                        worker_id = worker_pool.get_available_worker(job.cpu, job.language)
                        if worker_id:
                            job.status = "running"
                            job.worker_id = worker_id
                            worker_pool.workers[worker_id]['cpu'] -= job.cpu
                            job.started_at = datetime.now(timezone.utc)
                            assigned = True
                            
                            # REAL EXECUTION in background
                            from engine.executor import execute_job_real
                            asyncio.create_task(
                                execute_job_real(job.id, worker_id, async_session_maker)
                            )

                    if assigned:
                        await session.commit()
            except Exception as e:
                print(f"Error in scheduler: {e}")

scheduler = TaskScheduler()
