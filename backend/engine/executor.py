import docker
import asyncio

client = docker.from_env()

class StageExecutor:
    async def run_stage(self, stage_name: str, script: str):
        try:
            # Run detached to avoid blocking
            container = await asyncio.to_thread(
                client.containers.run,
                "ubuntu:22.04",
                command=f'sh -c "{script}"',
                detach=True
            )
            
            # Read logs pseudo-stream
            # to_thread to avoid blocking loop while waiting
            def wait_and_logs():
                logs = []
                for line in container.logs(stream=True):
                    log_line = line.decode('utf-8')
                    print(log_line, end="")
                    logs.append(log_line)
                result = container.wait()
                return result, "".join(logs)

            result, full_logs = await asyncio.to_thread(wait_and_logs)
            
            status = 'completed' if result['StatusCode'] == 0 else 'failed'
            # Cleanup
            await asyncio.to_thread(container.remove)
            
            return status, full_logs
        except Exception as e:
            print(f"Docker Error: {e}")
            return 'failed', str(e)

executor = StageExecutor()

async def execute_job_real(job_id: str, worker_id: str, async_session_maker):
    from models.job import Job
    from models.execution import Execution
    from engine.workers import worker_pool
    from datetime import datetime, timezone
    from sqlalchemy import select

    async with async_session_maker() as session:
        job = await session.get(Job, job_id)
        if not job:
            return

        script = f"echo 'Starting real execution for {job.stage_name} ({job.job_type})...'; sleep 5; echo 'Done.'"
        if job.job_type == "test":
            script += " echo 'Running tests...'; sleep 3; echo 'Tests passed!'"
            
    # Run the real docker stage outside DB session
    status, logs = await executor.run_stage(job.stage_name, script)

    async with async_session_maker() as session:
        job = await session.get(Job, job_id)
        job.status = status
        job.stdout_log = logs
        job.completed_at = datetime.now(timezone.utc)
        if job.started_at:
            job.duration_seconds = job.completed_at.timestamp() - job.started_at.timestamp()

        # Free up worker
        if worker_id in worker_pool.workers:
            worker_pool.workers[worker_id]['cpu'] += job.cpu

        await session.commit()
        
        # Check parent Execution completion
        exec_obj = await session.get(Execution, job.execution_id)
        if exec_obj:
            job_res = await session.execute(
                select(Job).where(Job.execution_id == exec_obj.id)
            )
            exec_jobs = job_res.scalars().all()
            all_done = all(j.status in ("completed", "failed") for j in exec_jobs)
            if all_done:
                exec_obj.status = "completed"
                exec_obj.completed_at = datetime.now(timezone.utc)
                if exec_obj.started_at:
                    exec_obj.duration_seconds = exec_obj.completed_at.timestamp() - exec_obj.started_at.timestamp()
            await session.commit()

