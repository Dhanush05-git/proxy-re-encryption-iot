"""
Database models using async SQLAlchemy with aiosqlite.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime,
    ForeignKey, Boolean
)
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

DATABASE_URL = "sqlite+aiosqlite:///./iot_secure.db"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(128), unique=True, nullable=False)
    role = Column(String(32), default="user")
    public_key_b64 = Column(Text, nullable=True)
    signing_pk_b64 = Column(Text, nullable=True)
    hashed_password = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sensor_readings = relationship("SensorReading", back_populates="owner", lazy="select")
    encrypted_files = relationship("EncryptedFile", back_populates="owner", foreign_keys="EncryptedFile.owner_id", lazy="select")
    grants_given = relationship("AccessGrant", back_populates="granter", foreign_keys="AccessGrant.granter_id", lazy="select")
    grants_received = relationship("AccessGrant", back_populates="grantee", foreign_keys="AccessGrant.grantee_id", lazy="select")


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String(64), nullable=False, index=True)
    data_json = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="sensor_readings")


class EncryptedFile(Base):
    __tablename__ = "encrypted_files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(256), nullable=False)
    sensor_id = Column(String(64), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    capsule_b64 = Column(Text, nullable=False)
    encrypted_dek_b64 = Column(Text, nullable=False)
    nonce_b64 = Column(Text, nullable=False)
    file_size = Column(Integer, default=0)
    storage_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="encrypted_files", foreign_keys=[owner_id])
    access_grants = relationship("AccessGrant", back_populates="file", lazy="select")


class AccessGrant(Base):
    __tablename__ = "access_grants"
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("encrypted_files.id"), nullable=False)
    granter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    grantee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    kfrags_b64_json = Column(Text, nullable=False)   # JSON list of base64 kfrags
    threshold = Column(Integer, default=2)
    shares = Column(Integer, default=3)
    status = Column(String(16), default="active")    # active / revoked / expired
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("EncryptedFile", back_populates="access_grants")
    granter = relationship("User", back_populates="grants_given", foreign_keys=[granter_id])
    grantee = relationship("User", back_populates="grants_received", foreign_keys=[grantee_id])
    proxy_operations = relationship("ProxyOperation", back_populates="grant", lazy="select")


class ProxyOperation(Base):
    __tablename__ = "proxy_operations"
    id = Column(Integer, primary_key=True, index=True)
    grant_id = Column(Integer, ForeignKey("access_grants.id"), nullable=False)
    worker_id = Column(String(64), nullable=False)
    cfrag_b64 = Column(Text, nullable=True)
    processing_time_ms = Column(Float, nullable=True)
    status = Column(String(16), default="success")  # success / failed
    created_at = Column(DateTime, default=datetime.utcnow)

    grant = relationship("AccessGrant", back_populates="proxy_operations")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(128), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    details_json = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
