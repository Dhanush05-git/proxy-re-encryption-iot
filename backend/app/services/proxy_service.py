"""
Proxy re-encryption service with 3 simulated proxy workers.
Workers run independently and results are aggregated against the threshold.
"""
import time
import random
from typing import List, Optional
from app.crypto.umbral_pre import proxy_reencrypt_capsule


PROXY_WORKERS = ["PROXY_WORKER_1", "PROXY_WORKER_2", "PROXY_WORKER_3"]


def _worker_reencrypt(
    worker_id: str,
    capsule_b64: str,
    kfrag_b64: str,
    verifying_pk_b64: str,
    alice_pk_b64: Optional[str] = None,
    bob_pk_b64: Optional[str] = None,
) -> dict:
    """
    Simulate a single proxy worker performing re-encryption.
    Returns worker result dict.
    """
    start = time.monotonic()
    try:
        time.sleep(random.uniform(0.001, 0.005))
        cfrag_b64 = proxy_reencrypt_capsule(
            capsule_b64, kfrag_b64,
            verifying_pk_b64=verifying_pk_b64,
            alice_pk_b64=alice_pk_b64,
            bob_pk_b64=bob_pk_b64,
        )
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "worker_id": worker_id,
            "status": "success",
            "processing_time_ms": round(elapsed_ms, 3),
            "cfrag_b64": cfrag_b64,
        }
    except Exception as e:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "worker_id": worker_id,
            "status": "failed",
            "processing_time_ms": round(elapsed_ms, 3),
            "cfrag_b64": None,
            "error": str(e),
        }


def reencrypt_with_workers(
    capsule_b64: str,
    kfrags_b64_list: List[str],
    threshold: int = 2,
    verifying_pk_b64: str = None,
    alice_pk_b64: str = None,
    bob_pk_b64: str = None,
) -> dict:
    """
    Distribute kfrags across proxy workers and collect cfrags.
    Returns:
        {
            "success": bool,
            "cfrags": [cfrag_b64, ...],
            "worker_results": [{worker_id, status, processing_time_ms, cfrag_b64}]
        }
    """
    worker_results = []
    num_workers = min(len(PROXY_WORKERS), len(kfrags_b64_list))

    for i in range(num_workers):
        worker_id = PROXY_WORKERS[i]
        kfrag_b64 = kfrags_b64_list[i]
        result = _worker_reencrypt(
            worker_id, capsule_b64, kfrag_b64,
            verifying_pk_b64=verifying_pk_b64,
            alice_pk_b64=alice_pk_b64,
            bob_pk_b64=bob_pk_b64,
        )
        worker_results.append(result)

    successful = [r for r in worker_results if r["status"] == "success"]
    success = len(successful) >= threshold
    cfrags = [r["cfrag_b64"] for r in successful] if success else []

    return {
        "success": success,
        "cfrags": cfrags,
        "worker_results": worker_results,
    }


def get_worker_status() -> List[dict]:
    """Return current status of all proxy workers (simulated)."""
    return [
        {
            "worker_id": w,
            "status": "online",
            "version": "1.0.0",
            "supported_ops": ["reencrypt"],
        }
        for w in PROXY_WORKERS
    ]
