"""
Access check endpoint — query whether a user has active access to a file.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.models.database import get_db, AccessGrant, EncryptedFile

router = APIRouter(prefix="/access", tags=["access"])


@router.get("/check")
async def check_access(file_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    # Check if user is the owner
    result = await db.execute(select(EncryptedFile).where(EncryptedFile.id == file_id))
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.owner_id == user_id:
        return {"has_access": True, "reason": "owner", "grant_id": None, "status": "owner"}

    # Check for an active grant
    stmt = select(AccessGrant).where(
        AccessGrant.file_id == file_id,
        AccessGrant.grantee_id == user_id,
    )
    result2 = await db.execute(stmt)
    grants = result2.scalars().all()

    now = datetime.utcnow()
    for g in grants:
        if g.status == "active":
            if g.expires_at and g.expires_at < now:
                g.status = "expired"
                continue
            return {"has_access": True, "reason": "grant", "grant_id": g.id, "status": "active"}

    await db.commit()
    return {"has_access": False, "reason": "no_grant", "grant_id": None, "status": None}
