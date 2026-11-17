"""
Proxy re-encryption endpoints — orchestrate workers, store operations.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.database import get_db, AccessGrant, ProxyOperation, AuditLog, EncryptedFile, User
from app.services.proxy_service import reencrypt_with_workers, get_worker_status

router = APIRouter(prefix="/proxy", tags=["proxy"])


class ReencryptRequest(BaseModel):
    grant_id: int
    requester_id: Optional[int] = None
    capsule_b64: Optional[str] = None


@router.post("/reencrypt")
async def proxy_reencrypt(req: ReencryptRequest, db: AsyncSession = Depends(get_db)):
    # Fetch and validate grant
    result = await db.execute(select(AccessGrant).where(AccessGrant.id == req.grant_id))
    grant = result.scalar_one_or_none()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    requester_id = req.requester_id or grant.grantee_id
    if grant.grantee_id != requester_id:
        raise HTTPException(status_code=403, detail="Requester is not the grantee of this grant")
    if grant.status != "active":
        raise HTTPException(status_code=403, detail=f"Grant is {grant.status}, not active")
    if grant.expires_at and grant.expires_at < datetime.utcnow():
        grant.status = "expired"
        await db.commit()
        raise HTTPException(status_code=403, detail="Grant has expired")

    # Fetch the file to get Alice's (granter's) public key info
    file_result = await db.execute(select(EncryptedFile).where(EncryptedFile.id == grant.file_id))
    file = file_result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="Associated file not found")

    capsule_to_transform = (
        req.capsule_b64
        if (req.capsule_b64 and len(req.capsule_b64) > 10)
        else file.capsule_b64
    )

    # Fetch the granter (Alice) for her signing public key
    granter_result = await db.execute(select(User).where(User.id == grant.granter_id))
    granter = granter_result.scalar_one_or_none()
    if not granter:
        raise HTTPException(status_code=404, detail="Granter not found")

    # Fetch the grantee (Bob) for his public key
    grantee_result = await db.execute(select(User).where(User.id == grant.grantee_id))
    grantee = grantee_result.scalar_one_or_none()
    if not grantee:
        raise HTTPException(status_code=404, detail="Grantee not found")

    kfrags_list = json.loads(grant.kfrags_b64_json)

    # Run proxy workers with verification keys
    result_data = reencrypt_with_workers(
        capsule_to_transform,
        kfrags_list,
        grant.threshold,
        verifying_pk_b64=granter.signing_pk_b64,  # Alice's signing public key
        alice_pk_b64=granter.public_key_b64,       # Alice's delegating public key
        bob_pk_b64=grantee.public_key_b64,         # Bob's receiving public key
    )

    # Persist operations to DB
    for wr in result_data["worker_results"]:
        op = ProxyOperation(
            grant_id=grant.id,
            worker_id=wr["worker_id"],
            cfrag_b64=wr.get("cfrag_b64"),
            processing_time_ms=wr.get("processing_time_ms"),
            status=wr["status"],
        )
        db.add(op)

    if not result_data["success"]:
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Re-encryption failed: not enough workers succeeded (threshold={grant.threshold})"
        )

    log = AuditLog(
        action="proxy_reencrypt",
        user_id=req.requester_id,
        details_json=json.dumps({
            "grant_id": req.grant_id,
            "workers_succeeded": len(result_data["cfrags"]),
        }),
    )
    db.add(log)
    await db.commit()

    return {
        "grant_id": grant.id,
        "success": True,
        "cfrags": result_data["cfrags"],
        "worker_results": result_data["worker_results"],
        "threshold": grant.threshold,
        "alice_pk_b64": granter.public_key_b64,
        "verifying_pk_b64": granter.signing_pk_b64,
    }


@router.get("/workers")
async def get_workers():
    return {"workers": get_worker_status()}


@router.get("/operations")
async def get_operations(grant_id: Optional[int] = None, limit: int = 100, db: AsyncSession = Depends(get_db)):
    stmt = select(ProxyOperation)
    if grant_id:
        stmt = stmt.where(ProxyOperation.grant_id == grant_id)
    stmt = stmt.order_by(ProxyOperation.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    ops = result.scalars().all()
    return [
        {
            "id": op.id,
            "grant_id": op.grant_id,
            "worker_id": op.worker_id,
            "status": op.status,
            "processing_time_ms": op.processing_time_ms,
            "created_at": op.created_at.isoformat(),
        }
        for op in ops
    ]
