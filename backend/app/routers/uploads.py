"""
Encrypted file upload, listing, and download endpoints.
Stores encrypted payloads; never stores or exposes plaintext or DEK.
"""
import os
import json
import base64
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db, EncryptedFile, User, AuditLog, SensorReading
from app.crypto.aes_encryption import encrypt_data, decrypt_data
from app.crypto.umbral_pre import pre_encapsulate_dek, decrypt_reencrypted_dek

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage")

router = APIRouter(prefix="/uploads", tags=["uploads"])


class UploadRequest(BaseModel):
    owner_id: int
    sensor_id: Optional[str] = None
    sensor_reading_id: Optional[int] = None
    owner_sk_b64: Optional[str] = None
    capsule_b64: Optional[str] = None
    encrypted_dek_b64: Optional[str] = None
    nonce_b64: Optional[str] = None
    encrypted_data_b64: Optional[str] = None
    filename: Optional[str] = None


class DecryptRequest(BaseModel):
    file_id: int
    recipient_sk_b64: str
    cfrags_b64: list[str]


@router.post("/encrypt-upload")
async def encrypt_upload(req: UploadRequest, db: AsyncSession = Depends(get_db)):
    # Verify owner exists
    result = await db.execute(select(User).where(User.id == req.owner_id))
    owner = result.scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    os.makedirs(STORAGE_DIR, exist_ok=True)

    # Path A: Directly encrypting a sensor reading by ID
    if req.sensor_reading_id:
        r_result = await db.execute(select(SensorReading).where(SensorReading.id == req.sensor_reading_id))
        reading = r_result.scalar_one_or_none()
        if not reading:
            raise HTTPException(status_code=404, detail="Sensor reading not found")
        
        plaintext = reading.data_json.encode("utf-8")
        sensor_id = reading.sensor_id
        filename = f"{sensor_id}_reading_{reading.id}.json"

        # 1. AES-256-GCM encrypt
        aes_res = encrypt_data(plaintext)
        dek_bytes = base64.b64decode(aes_res["dek_b64"])

        # 2. PRE Encapsulate DEK under Alice's public key
        pre_res = pre_encapsulate_dek(dek_bytes, owner.public_key_b64)

        capsule_b64 = pre_res["capsule_b64"]
        encrypted_dek_b64 = pre_res["encrypted_dek_b64"]
        nonce_b64 = aes_res["nonce_b64"]
        encrypted_bytes = base64.b64decode(aes_res["ciphertext_b64"])
    else:
        # Path B: Pre-encrypted payload
        if not (req.capsule_b64 and req.encrypted_dek_b64 and req.nonce_b64 and req.encrypted_data_b64):
            raise HTTPException(status_code=400, detail="Missing encrypted data payload")
        capsule_b64 = req.capsule_b64
        encrypted_dek_b64 = req.encrypted_dek_b64
        nonce_b64 = req.nonce_b64
        encrypted_bytes = base64.b64decode(req.encrypted_data_b64)
        filename = req.filename or f"sensor_data_{req.owner_id}.json"
        sensor_id = req.sensor_id

    safe_name = filename.replace("/", "_").replace("..", "_")
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    storage_filename = f"{req.owner_id}_{ts}_{safe_name}.enc"
    storage_path = os.path.join(STORAGE_DIR, storage_filename)

    with open(storage_path, "wb") as f:
        f.write(encrypted_bytes)

    file_record = EncryptedFile(
        filename=filename,
        sensor_id=sensor_id,
        owner_id=req.owner_id,
        capsule_b64=capsule_b64,
        encrypted_dek_b64=encrypted_dek_b64,
        nonce_b64=nonce_b64,
        file_size=len(encrypted_bytes),
        storage_path=storage_filename,
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    log = AuditLog(
        action="file_upload",
        user_id=req.owner_id,
        details_json=json.dumps({"file_id": file_record.id, "filename": filename}),
    )
    db.add(log)
    await db.commit()

    return {
        "id": file_record.id,
        "file_id": file_record.id,
        "filename": file_record.filename,
        "sensor_id": file_record.sensor_id,
        "file_size": file_record.file_size,
        "owner_id": file_record.owner_id,
        "capsule_b64": file_record.capsule_b64,
        "encrypted_dek_b64": file_record.encrypted_dek_b64,
        "nonce_b64": file_record.nonce_b64,
        "created_at": file_record.created_at.isoformat(),
    }


@router.post("/decrypt")
async def decrypt_uploaded_file(req: DecryptRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EncryptedFile).where(EncryptedFile.id == req.file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    owner_result = await db.execute(select(User).where(User.id == f.owner_id))
    owner = owner_result.scalar_one_or_none()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    # Read encrypted ciphertext from storage
    storage_path = os.path.join(STORAGE_DIR, f.storage_path)
    if not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="Encrypted file payload missing on disk")

    with open(storage_path, "rb") as fh:
        encrypted_bytes = fh.read()

    # 1. Recipient uses private key + cfrags to recover the DEK via PRE
    try:
        dek_bytes = decrypt_reencrypted_dek(
            bob_sk_b64=req.recipient_sk_b64,
            alice_pk_b64=owner.public_key_b64,
            capsule_b64=f.capsule_b64,
            cfrag_b64_list=req.cfrags_b64,
            encrypted_dek_b64=f.encrypted_dek_b64,
            verifying_pk_b64=owner.signing_pk_b64,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PRE DEK recovery failed: {e}")

    # 2. Decrypt AES-256-GCM
    try:
        ciphertext_b64 = base64.b64encode(encrypted_bytes).decode("utf-8")
        dek_b64 = base64.b64encode(dek_bytes).decode("utf-8")
        plaintext_bytes = decrypt_data(ciphertext_b64, f.nonce_b64, dek_b64)
        decrypted_str = plaintext_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AES-GCM decryption failed: {e}")

    return {
        "success": True,
        "file_id": f.id,
        "filename": f.filename,
        "decrypted_data": decrypted_str,
    }


@router.get("")
async def list_files(owner_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(EncryptedFile)
    if owner_id:
        stmt = stmt.where(EncryptedFile.owner_id == owner_id)
    stmt = stmt.order_by(EncryptedFile.created_at.desc())
    result = await db.execute(stmt)
    files = result.scalars().all()
    return [
        {
            "id": f.id,
            "file_id": f.id,
            "filename": f.filename,
            "sensor_id": f.sensor_id,
            "owner_id": f.owner_id,
            "file_size": f.file_size,
            "capsule_b64": f.capsule_b64,
            "encrypted_dek_b64": f.encrypted_dek_b64,
            "nonce_b64": f.nonce_b64,
            "created_at": f.created_at.isoformat(),
        }
        for f in files
    ]


@router.get("/{file_id}")
async def get_file_metadata(file_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EncryptedFile).where(EncryptedFile.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return {
        "file_id": f.id,
        "filename": f.filename,
        "sensor_id": f.sensor_id,
        "owner_id": f.owner_id,
        "file_size": f.file_size,
        "capsule_b64": f.capsule_b64,
        "encrypted_dek_b64": f.encrypted_dek_b64,
        "nonce_b64": f.nonce_b64,
        "created_at": f.created_at.isoformat(),
    }


@router.get("/{file_id}/download")
async def download_encrypted_file(file_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EncryptedFile).where(EncryptedFile.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    storage_path = os.path.join(STORAGE_DIR, f.storage_path)
    if not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="Encrypted file data not found on disk")

    with open(storage_path, "rb") as fh:
        encrypted_bytes = fh.read()

    return {
        "file_id": f.id,
        "filename": f.filename,
        "capsule_b64": f.capsule_b64,
        "encrypted_dek_b64": f.encrypted_dek_b64,
        "nonce_b64": f.nonce_b64,
        "encrypted_data_b64": base64.b64encode(encrypted_bytes).decode(),
        "file_size": f.file_size,
    }
