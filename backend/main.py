"""CI/CD Pipeline Manager — FastAPI Application."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import init_db, AsyncSessionLocal
from routers import pipelines, executions, webhooks
from engine.scheduler import scheduler
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables. Shutdown: cleanup."""
    await init_db()
    print("✅ Database tables created / verified")
    
    # Start Background Task Workers (No mock traffic, purely real operations)
    asyncio.create_task(scheduler.poll_pending_jobs(AsyncSessionLocal))
    print("✅ Real Database Scheduler active (Waiting for real Webhooks)")
    
    yield
    print("👋 Shutting down")


app = FastAPI(
    title="CI/CD Pipeline Manager API",
    description="Backend API for the CI/CD Job Scheduler, Priority Assigner, and Pipeline Manager.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ─────────────────────────────────────────────
app.include_router(pipelines.router)
app.include_router(executions.router)
app.include_router(webhooks.router)


# ── Health check ────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "service": "ci-cd-pipeline-manager"}


# ── Serve frontend ──────────────────────────────────────────
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not found. Place index.html in backend/static/"}


# Mount static files if directory exists
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

import asyncio
import time
from fastapi.responses import StreamingResponse

@app.get("/api/events")
async def sse_events():
    async def event_generator():
        while True:
            await asyncio.sleep(3)
            yield f"data: {{\"event\": \"System Heartbeat\", \"timestamp\": {time.time()}}}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
