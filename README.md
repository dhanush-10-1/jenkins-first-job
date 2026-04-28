# CI/CD Pipeline Manager

A distributed CI/CD pipeline management platform that simulates Jenkins' core architecture — the **Controller-Worker model**, **webhook-triggered builds**, **priority-based job scheduling**, and **language-specific worker routing**.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub / GitLab                          │
│              (Push Event → Webhook POST)                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI Backend (Jenkins Master)               │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐     │
│  │ Webhook  │  │   Pipeline   │  │   SSE / WebSocket   │     │
│  │ Handler  │  │   Manager    │  │   Event Stream      │     │
│  └────┬─────┘  └──────┬───────┘  └────────────────────┘     │
│       │               │                                      │
│       ▼               ▼                                      │
│  ┌────────────────────────────────┐                          │
│  │      SQLite Database (Queue)   │                          │
│  │  Pipelines → Executions → Jobs │                          │
│  └───────────────┬────────────────┘                          │
│                  │                                            │
│                  ▼                                            │
│  ┌────────────────────────────────┐                          │
│  │    Priority-Based Scheduler    │                          │
│  │  Score = Type + Wait + CPU     │                          │
│  └───────────────┬────────────────┘                          │
│                  │                                            │
│     ┌────────────┼────────────┬───────────┐                  │
│     ▼            ▼            ▼           ▼                  │
│ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐            │
│ │worker  │ │worker  │ │ worker   │ │ worker   │            │
│ │py-1    │ │js-1    │ │general-1 │ │docker-1  │            │
│ │Python  │ │JS/Node │ │ General  │ │ Docker   │            │
│ └────────┘ └────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **Webhook Triggers** | GitHub & GitLab push webhook endpoints with HMAC-SHA256 signature verification |
| **Jenkins Master** | FastAPI backend with 14 REST API endpoints for full pipeline lifecycle |
| **Job Queue (Database)** | SQLite + SQLAlchemy async ORM with 3-table schema (Pipelines → Executions → Jobs) |
| **Priority Scheduler** | Dynamic priority scoring: `TypeWeight + (WaitTime × 30) + (CPU × 20) + ManualBoost` |
| **4 Workers** | Language-specific routing: Python → `worker-py-1`, JavaScript → `worker-js-1` |
| **Real-World Simulation** | Random webhook arrivals (20–45s), random completion times (5–12s), load-dependent assignment |
| **React Dashboard** | Real-time execution visualizer with live priority scores, SSE event timeline |
| **Visual Pipeline Designer** | React Flow graph editor with bidirectional YAML sync |

## Tech Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy (async), Pydantic v2
- **Frontend:** React 18, TypeScript, React Flow, Vite
- **Database:** SQLite (dev) / PostgreSQL (production via Docker)
- **Containerization:** Docker Compose

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker (Full Stack)
```bash
docker compose up --build
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webhooks/github` | GitHub push webhook (HMAC verified) |
| `POST` | `/api/webhooks/gitlab` | GitLab push webhook |
| `POST` | `/api/pipelines/` | Create pipeline |
| `GET` | `/api/pipelines/` | List pipelines |
| `POST` | `/api/pipelines/{id}/execute` | Trigger execution |
| `GET` | `/api/executions` | List executions |
| `GET` | `/api/executions/{id}` | Execution details + jobs |
| `GET` | `/api/executions/{id}/logs` | Job stdout logs |
| `GET` | `/api/events` | SSE event stream |
| `GET` | `/api/health` | Health check |

## Simulating a GitHub Webhook

```bash
curl -X POST http://localhost:8100/api/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "refs/heads/main",
    "after": "abc123def456",
    "repository": {
      "full_name": "acme/python-api",
      "clone_url": "https://github.com/acme/python-api.git"
    }
  }'
```

## Worker Pool

| Worker | CPU | Languages | Role |
|--------|-----|-----------|------|
| `worker-py-1` | 4 cores | Python, Bash | Python specialist |
| `worker-js-1` | 4 cores | JavaScript, Bash | JS/Node specialist |
| `worker-general-1` | 2 cores | Python, JS, Bash | General purpose |
| `worker-docker-1` | 4 cores | Python, JS, Bash, Docker | Docker-capable |

## Scheduler Priority Formula

```
Priority = TypeMultiplier + (WaitTime × 30) + (CPU × 20) + ManualBoost

TypeMultiplier: 40 (deploy/security) | 20 (build/test/lint)
WaitTime: seconds since job creation (prevents starvation)
CPU: resource weight
ManualBoost: +10 for manually triggered jobs
```

## Project Structure

```
jenkins-first-job/
├── backend/
│   ├── main.py              # FastAPI app + lifespan
│   ├── database.py           # SQLAlchemy async engine
│   ├── models/
│   │   ├── pipeline.py       # Pipeline ORM model
│   │   ├── execution.py      # Execution ORM model
│   │   └── job.py            # Job ORM model
│   ├── schemas/
│   │   ├── pipeline.py       # Pydantic request/response
│   │   └── execution.py      # Pydantic request/response
│   ├── routers/
│   │   ├── pipelines.py      # Pipeline CRUD
│   │   ├── executions.py     # Execution triggers + logs
│   │   └── webhooks.py       # GitHub/GitLab webhooks
│   └── engine/
│       ├── scheduler.py      # Priority-based task scheduler
│       ├── workers.py        # Worker pool (4 workers)
│       ├── executor.py       # Stage execution engine
│       └── simulators.py     # Random webhook + worker sim
├── frontend/
│   └── src/
│       ├── App.tsx            # Main app with tabs
│       ├── components/
│       │   ├── Dashboard.tsx  # Real-time execution dashboard
│       │   ├── PipelineCanvas.tsx
│       │   ├── CustomNodes.tsx
│       │   └── YamlEditor.tsx
│       └── lib/
│           └── sync.ts       # YAML ↔ Graph bidirectional sync
├── docker-compose.yml         # Multi-container deployment
└── README.md
```