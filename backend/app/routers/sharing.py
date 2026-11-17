import os
import json
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db, AccessGrant, EncryptedFile, User, AuditLog
from app.crypto.umbral_pre import generate_kfrags_for_sharing

KEYS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "keys")

router = APIRouter(prefix="/sharing", tags=["sharing"])


class GrantRequest(BaseModel):
    granter_id: int
    grantee_id: int
    file_id: int
    kfrags_b64_list: Optional[List[str]] = None
    granter_sk_b64: Optional[str] = None
    threshold: int = 2
    shares: int = 3
    expires_hours: Optional[float] = None


class RevokeRequest(BaseModel):
    grant_id: int
    granter_id: Optional[int] = None


@router.post("/grant")
async def create_grant(req: GrantRequest, db: AsyncSession = Depends(get_db)):
    # Verify file exists and granter owns it
    result = await db.execute(select(EncryptedFile).where(EncryptedFile.id == req.file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != req.granter_id:
        raise HTTPException(status_code=403, detail="Only the file owner can grant access")

    # Verify grantee exists
    result2 = await db.execute(select(User).where(User.id == req.grantee_id))
    grantee = result2.scalar_one_or_none()
    if not grantee:
        raise HTTPException(status_code=404, detail="Grantee not found")

    # Verify granter exists
    result3 = await db.execute(select(User).where(User.id == req.granter_id))
    granter = result3.scalar_one_or_none()
    if not granter:
        raise HTTPException(status_code=404, detail="Granter not found")

    # Generate or accept kfrags
    kfrags = req.kfrags_b64_list
    if not kfrags and req.granter_sk_b64:
        # Check if demo keys exist for granter to get signing_sk
        signing_sk_b64 = None
        key_file = os.path.join(KEYS_DIR, f"{granter.username}_demo_keys.json")
        if os.path.exists(key_file):
            try:
                with open(key_file, "r") as f:
                    data = json.load(f)
                    signing_sk_b64 = data.get("signing_secret_key_b64")
            except Exception:
                pass
        if not signing_sk_b64:
            signing_sk_b64 = req.granter_sk_b64  # fallback

        try:
            kfrags = generate_kfrags_for_sharing(
                alice_sk_b64=req.granter_sk_b64,
                alice_signing_sk_b64=signing_sk_b64,
                bob_pk_b64=grantee.public_key_b64,
                threshold=req.threshold,
                shares=req.shares,
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"KFrag generation failed: {e}")

    if not kfrags:
        raise HTTPException(status_code=400, detail="Either kfrags_b64_list or granter_sk_b64 must be provided")

    expires_at = None
    if req.expires_hours:
        expires_at = datetime.utcnow() + timedelta(hours=req.expires_hours)

    grant = AccessGrant(
        file_id=req.file_id,
        granter_id=req.granter_id,
        grantee_id=req.grantee_id,
        kfrags_b64_json=json.dumps(kfrags),
        threshold=req.threshold,
        shares=req.shares,
        status="active",
        expires_at=expires_at,
    )
    db.add(grant)
    await db.commit()
    await db.refresh(grant)

    log = AuditLog(
        action="access_grant",
        user_id=req.granter_id,
        details_json=json.dumps({
            "grant_id": grant.id, "file_id": req.file_id,
            "grantee_id": req.grantee_id,
        }),
    )
    db.add(log)
    await db.commit()

    return {
        "id": grant.id,
        "grant_id": grant.id,
        "file_id": grant.file_id,
        "filename": file.filename,
        "granter_id": grant.granter_id,
        "grantee_id": grant.grantee_id,
        "grantee_username": grantee.username,
        "threshold": grant.threshold,
        "shares": grant.shares,
        "status": grant.status,
        "expires_at": grant.expires_at.isoformat() if grant.expires_at else None,
        "created_at": grant.created_at.isoformat(),
    }


@router.get("/grants")
async def list_grants(
    granter_id: Optional[int] = None,
    grantee_id: Optional[int] = None,
    file_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AccessGrant)
    if granter_id:
        stmt = stmt.where(AccessGrant.granter_id == granter_id)
    if grantee_id:
        stmt = stmt.where(AccessGrant.grantee_id == grantee_id)
    if file_id:
        stmt = stmt.where(AccessGrant.file_id == file_id)
    if user_id:
        stmt = stmt.where(
            or_(AccessGrant.granter_id == user_id, AccessGrant.grantee_id == user_id)
        )
    stmt = stmt.order_by(AccessGrant.created_at.desc())
    result = await db.execute(stmt)
    grants = result.scalars().all()

    # Preload user & file mappings
    users_res = await db.execute(select(User))
    users_map = {u.id: u.username for u in users_res.scalars().all()}

    files_res = await db.execute(select(EncryptedFile))
    files_map = {f.id: f.filename for f in files_res.scalars().all()}

    now = datetime.utcnow()
    for g in grants:
        if g.status == "active" and g.expires_at and g.expires_at < now:
            g.status = "expired"
    await db.commit()

    return [
        {
            "id": g.id,
            "grant_id": g.id,
            "file_id": g.file_id,
            "filename": files_map.get(g.file_id, f"file_{g.file_id}"),
            "granter_id": g.granter_id,
            "grantee_id": g.grantee_id,
            "grantee_username": users_map.get(g.grantee_id, f"user_{g.grantee_id}"),
            "threshold": g.threshold,
            "shares": g.shares,
            "status": g.status,
            "kfrags_b64_list": json.loads(g.kfrags_b64_json),
            "expires_at": g.expires_at.isoformat() if g.expires_at else None,
            "created_at": g.created_at.isoformat(),
        }
        for g in grants
    ]


@router.post("/revoke")
async def revoke_grant(req: RevokeRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessGrant).where(AccessGrant.id == req.grant_id))
    grant = result.scalar_one_or_none()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    if req.granter_id and grant.granter_id != req.granter_id:
        raise HTTPException(status_code=403, detail="Only the granter can revoke access")
    if grant.status == "revoked":
        raise HTTPException(status_code=400, detail="Grant already revoked")

    grant.status = "revoked"
    await db.commit()

    log = AuditLog(
        action="access_revoke",
        user_id=grant.granter_id,
        details_json=json.dumps({"grant_id": req.grant_id}),
    )
    db.add(log)
    await db.commit()

    return {"success": True, "grant_id": req.grant_id, "status": "revoked"}


@router.post("/{grant_id}/revoke")
async def revoke_grant_by_path(grant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessGrant).where(AccessGrant.id == grant_id))
    grant = result.scalar_one_or_none()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    grant.status = "revoked"
    await db.commit()
    return {"success": True, "grant_id": grant_id, "status": "revoked"}
