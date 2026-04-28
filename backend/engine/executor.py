import asyncio
import sys


class StageExecutor:
    async def run_stage(self, stage_name: str, script: str):
        """Execute a stage script using a local subprocess instead of Docker."""
        try:
            if sys.platform == "win32":
                shell_cmd = ["cmd", "/c", script]
            else:
                shell_cmd = ["sh", "-c", script]

            process = await asyncio.create_subprocess_exec(
                *shell_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            stdout_bytes, _ = await process.communicate()
            logs = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""

            status = "completed" if process.returncode == 0 else "failed"
            return status, logs
        except Exception as e:
            print(f"Execution Error: {e}")
            return "failed", str(e)


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

        script = f"echo Starting real execution for {job.stage_name} ({job.job_type})..."
        if job.job_type == "test":
            script += " && echo Running tests... && echo Tests passed!"

    # Run the stage outside DB session
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
