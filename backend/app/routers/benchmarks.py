"""
Performance benchmarks — timing measurements for crypto operations.
"""
import time
import statistics
import os
from typing import Optional, List

from fastapi import APIRouter
from pydantic import BaseModel

from app.crypto.aes_encryption import encrypt_data, decrypt_data
from app.crypto.umbral_pre import (
    generate_keypair, pre_encapsulate_dek,
    generate_kfrags_for_sharing, proxy_reencrypt_capsule,
    decrypt_reencrypted_dek, pre_decrypt_original_dek,
)

router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])

_last_results: dict = {}


class BenchmarkRequest(BaseModel):
    file_sizes: Optional[List[int]] = None
    trials: Optional[int] = 5


def _time_fn(fn, *args, **kwargs) -> float:
    start = time.perf_counter()
    fn(*args, **kwargs)
    return (time.perf_counter() - start) * 1000


@router.post("/run")
async def run_benchmarks(req: BenchmarkRequest):
    trials = max(1, min(req.trials or 5, 20))
    file_sizes = req.file_sizes or [1024, 10240, 102400, 1048576]

    results = {}

    # --- Key generation ---
    kg_times = [_time_fn(generate_keypair) for _ in range(trials)]
    results["key_generation"] = {
        "mean_ms": round(statistics.mean(kg_times), 3),
        "min_ms": round(min(kg_times), 3),
        "max_ms": round(max(kg_times), 3),
        "trials": trials,
    }

    # --- AES encryption & decryption ---
    aes_enc_times = {}
    aes_dec_times = {}
    for sz in file_sizes:
        plaintext = os.urandom(sz)
        enc_times = []
        dec_times = []
        for _ in range(trials):
            t0 = time.perf_counter()
            enc = encrypt_data(plaintext)
            enc_times.append((time.perf_counter() - t0) * 1000)

            t0 = time.perf_counter()
            decrypt_data(enc["ciphertext_b64"], enc["nonce_b64"], enc["dek_b64"])
            dec_times.append((time.perf_counter() - t0) * 1000)

        label = f"{sz // 1024}KB" if sz >= 1024 else f"{sz}B"
        aes_enc_times[label] = round(statistics.mean(enc_times), 3)
        aes_dec_times[label] = round(statistics.mean(dec_times), 3)

    results["aes_encryption"] = {"mean_ms_by_size": aes_enc_times, "trials": trials}
    results["aes_decryption"] = {"mean_ms_by_size": aes_dec_times, "trials": trials}

    # --- PRE full workflow ---
    encap_times = []
    kfrag_times = []
    reenc_times = []
    dec_re_times = []

    alice = generate_keypair()
    alice_sign = generate_keypair()
    bob = generate_keypair()
    dek = os.urandom(32)

    for _ in range(trials):
        t0 = time.perf_counter()
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        encap_times.append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        kfrags = generate_kfrags_for_sharing(
            alice["secret_key_b64"], alice_sign["secret_key_b64"],
            bob["public_key_b64"], threshold=2, shares=3,
        )
        kfrag_times.append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        cfrag1 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[0],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        cfrag2 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[1],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        reenc_times.append((time.perf_counter() - t0) * 1000)

        t0 = time.perf_counter()
        decrypt_reencrypted_dek(
            bob["secret_key_b64"], alice["public_key_b64"],
            enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"],
            verifying_pk_b64=alice_sign["public_key_b64"],
        )
        dec_re_times.append((time.perf_counter() - t0) * 1000)

    results["pre_encapsulation"] = {"mean_ms": round(statistics.mean(encap_times), 3), "trials": trials}
    results["pre_kfrag_generation"] = {"mean_ms": round(statistics.mean(kfrag_times), 3), "trials": trials}
    results["pre_reencryption"] = {
        "mean_ms": round(statistics.mean(reenc_times), 3),
        "note": "2 workers in sequence",
        "trials": trials,
    }
    results["pre_decryption_reencrypted"] = {"mean_ms": round(statistics.mean(dec_re_times), 3), "trials": trials}

    global _last_results
    _last_results = results
    return results


@router.get("/results")
async def get_last_results():
    if not _last_results:
        return {"message": "No benchmarks run yet. POST /api/benchmarks/run first."}
    return _last_results
