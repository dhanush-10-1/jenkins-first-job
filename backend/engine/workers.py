from typing import Dict, List

class WorkerPool:
    def __init__(self):
        self.workers: Dict[str, dict] = {}
        # Pre-seed multiple workers across languages to simulate real world
        self.register("worker-py-1", 4, 16, ["python", "bash"])
        self.register("worker-js-1", 4, 16, ["javascript", "bash"])
        self.register("worker-general-1", 2, 8, ["python", "javascript", "bash"])

    def register(self, worker_id: str, cpu: int, memory: int, supported_languages: List[str] = None):
        self.workers[worker_id] = {
            "cpu": cpu,
            "memory": memory,
            "supported_languages": supported_languages or ["bash"],
            "status": "active"
        }

    def deregister(self, worker_id: str):
        if worker_id in self.workers:
            del self.workers[worker_id]
            
    def get_available_worker(self, required_cpu: int, language: str) -> str:
        for w_id, w_info in self.workers.items():
            if w_info['status'] == 'active' and w_info['cpu'] >= required_cpu:
                if language in w_info['supported_languages'] or not language:
                    return w_id
        return None

worker_pool = WorkerPool()
