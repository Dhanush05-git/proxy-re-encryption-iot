"""
User registration, login, and listing endpoints.
"""
import json
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from jose import jwt

from app.models.database import get_db, User, AuditLog

router = APIRouter(prefix="/users", tags=["users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "iot-secure-pre-secret-key-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"
    public_key_b64: Optional[str] = None
    signing_pk_b64: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Check uniqueness
    result = await db.execute(select(User).where(User.username == req.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    result2 = await db.execute(select(User).where(User.email == req.email))
    if result2.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=req.username,
        email=req.email,
        role=req.role,
        public_key_b64=req.public_key_b64,
        signing_pk_b64=req.signing_pk_b64,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    log = AuditLog(
        action="user_register",
        user_id=user.id,
        details_json=json.dumps({"username": req.username, "role": req.role}),
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    await db.commit()

    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "public_key_b64": user.public_key_b64,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})

    log = AuditLog(
        action="user_login",
        user_id=user.id,
        details_json=json.dumps({"username": user.username}),
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    await db.commit()

    # If demo keys exist on server for this user, deliver them to client for demo session
    demo_keys = None
    import os
    keys_dir = os.path.join(os.path.dirname(__file__), "..", "..", "keys")
    key_file = os.path.join(keys_dir, f"{user.username}_demo_keys.json")
    if os.path.exists(key_file):
        try:
            with open(key_file, "r") as f:
                demo_keys = json.load(f)
        except Exception:
            pass

    return {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "token": token,
        "public_key_b64": user.public_key_b64,
        "signing_pk_b64": user.signing_pk_b64,
        "demo_keys": demo_keys,
    }


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [
        {
            "user_id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "public_key_b64": u.public_key_b64,
            "signing_pk_b64": u.signing_pk_b64,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.get("/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "public_key_b64": user.public_key_b64,
        "signing_pk_b64": user.signing_pk_b64,
        "created_at": user.created_at.isoformat(),
    }
