"""
FastAPI application entry point.
"""
import os
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import create_tables, AsyncSessionLocal, User, get_db
from app.routers.users import hash_password
from app.crypto.umbral_pre import generate_keypair

from app.routers import users, sensors, uploads, sharing, proxy, access, benchmarks, audit, security_tests

logger = logging.getLogger("iot_secure")
logging.basicConfig(level=logging.INFO)


STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "storage")
KEYS_DIR = os.path.join(os.path.dirname(__file__), "..", "keys")


async def _seed_demo_users():
    """Create alice, bob, charlie with pre-generated keypairs if DB is empty."""
    from sqlalchemy import select, func
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count()).select_from(User))
        count = result.scalar()
        if count > 0:
            return  # already seeded

        demo_users = [
            {"username": "alice", "email": "alice@iot.local", "role": "admin"},
            {"username": "bob",   "email": "bob@iot.local",   "role": "user"},
            {"username": "charlie", "email": "charlie@iot.local", "role": "user"},
        ]
        for u in demo_users:
            kp = generate_keypair()
            sign_kp = generate_keypair()
            user = User(
                username=u["username"],
                email=u["email"],
                role=u["role"],
                public_key_b64=kp["public_key_b64"],
                signing_pk_b64=sign_kp["public_key_b64"],
                hashed_password=hash_password("password123"),
            )
            db.add(user)
            # Store secret keys to a local JSON file for demo purposes ONLY
            # (never in DB)
            key_file = os.path.join(KEYS_DIR, f"{u['username']}_demo_keys.json")
            with open(key_file, "w") as f:
                json.dump({
                    "username": u["username"],
                    "public_key_b64": kp["public_key_b64"],
                    "secret_key_b64": kp["secret_key_b64"],
                    "signing_public_key_b64": sign_kp["public_key_b64"],
                    "signing_secret_key_b64": sign_kp["secret_key_b64"],
                }, f, indent=2)
            logger.info(f"Demo user '{u['username']}' keys written to {key_file}")

        await db.commit()
        logger.info("Demo users seeded: alice, bob, charlie (password: password123)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(STORAGE_DIR, exist_ok=True)
    os.makedirs(KEYS_DIR, exist_ok=True)
    await create_tables()
    await _seed_demo_users()
    logger.info("IoT Secure PRE backend started")
    yield
    # Shutdown
    logger.info("IoT Secure PRE backend shutting down")


app = FastAPI(
    title="IoT Secure PRE Backend",
    description="Proxy Re-Encryption for Secure IoT Cloud Data Sharing",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321", "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

# Dashboard Stats endpoint
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: AsyncSessionLocal = Depends(get_db)):
    from sqlalchemy import select, func
    from app.models.database import SensorReading, EncryptedFile, AccessGrant, User, ProxyOperation, AuditLog

    sensor_c = await db.scalar(select(func.count(SensorReading.id)))
    file_c = await db.scalar(select(func.count(EncryptedFile.id)))
    grant_c = await db.scalar(select(func.count(AccessGrant.id)).where(AccessGrant.status == "active"))
    user_c = await db.scalar(select(func.count(User.id)))
    proxy_c = await db.scalar(select(func.count(ProxyOperation.id)))

    recent_logs = (
        await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10))
    ).scalars().all()

    return {
        "sensor_count": sensor_c or 0,
        "file_count": file_c or 0,
        "grant_count": grant_c or 0,
        "user_count": user_c or 0,
        "proxy_op_count": proxy_c or 0,
        "recent_audit_logs": [
            {
                "id": log.id,
                "action": log.action,
                "user_id": log.user_id,
                "details_json": log.details_json,
                "ip_address": log.ip_address or "127.0.0.1",
                "created_at": log.created_at.isoformat(),
            }
            for log in recent_logs
        ],
    }

# Key generation helper
@app.post("/api/crypto/generate-keypair")
async def api_generate_keypair():
    return generate_keypair()

# Register all routers
app.include_router(users.router,          prefix="/api")
app.include_router(sensors.router,        prefix="/api")
app.include_router(uploads.router,        prefix="/api")
app.include_router(sharing.router,        prefix="/api")
# Alias sharing routes under /api/grants for direct frontend compatibility
app.include_router(sharing.router,        prefix="/api/grants", tags=["grants-alias"])
app.include_router(proxy.router,          prefix="/api")
app.include_router(access.router,         prefix="/api")
app.include_router(benchmarks.router,     prefix="/api")
app.include_router(audit.router,          prefix="/api")
app.include_router(security_tests.router, prefix="/api")
