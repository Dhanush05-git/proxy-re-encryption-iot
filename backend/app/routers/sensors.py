"""
Sensor data generation and retrieval endpoints.
"""
import json
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db, SensorReading
from app.services.sensor_simulator import generate_reading, generate_batch, generate_historical

router = APIRouter(prefix="/sensors", tags=["sensors"])


class GenerateRequest(BaseModel):
    sensor_id: Optional[str] = None
    count: Optional[int] = 1
    store: Optional[bool] = True
    owner_id: Optional[int] = None


class BatchRequest(BaseModel):
    count: int = 10
    sensor_ids: Optional[List[str]] = None
    store: Optional[bool] = True
    owner_id: Optional[int] = None


class HistoricalRequest(BaseModel):
    sensor_id: str
    days: int = 7


@router.post("/generate")
async def generate_sensor_data(req: GenerateRequest, db: AsyncSession = Depends(get_db)):
    count = max(1, min(req.count or 1, 1000))
    readings = generate_batch(count, [req.sensor_id] if req.sensor_id else None)

    if req.store:
        for r in readings:
            row = SensorReading(
                sensor_id=r["sensor_id"],
                data_json=json.dumps(r),
                owner_id=req.owner_id,
            )
            db.add(row)
        await db.commit()

    return {"generated": len(readings), "readings": readings}


@router.post("/generate-batch")
async def generate_batch_data(req: BatchRequest, db: AsyncSession = Depends(get_db)):
    count = max(1, min(req.count, 1000))
    readings = generate_batch(count, req.sensor_ids)

    if req.store:
        for r in readings:
            row = SensorReading(
                sensor_id=r["sensor_id"],
                data_json=json.dumps(r),
                owner_id=req.owner_id,
            )
            db.add(row)
        await db.commit()

    return {"generated": len(readings), "readings": readings}


@router.get("/readings")
async def get_readings(
    sensor_id: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SensorReading)
    if sensor_id:
        stmt = stmt.where(SensorReading.sensor_id == sensor_id)
    stmt = stmt.order_by(SensorReading.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    out = []
    for r in rows:
        parsed = json.loads(r.data_json) if r.data_json else {}
        item = {
            "id": r.id,
            "sensor_id": r.sensor_id,
            "data": parsed,
            "owner_id": r.owner_id,
            "created_at": r.created_at.isoformat(),
            # Flatten standard sensor fields so charts and tables bind directly
            "temperature": parsed.get("temperature", 24.0),
            "humidity": parsed.get("humidity", 50.0),
            "air_quality": parsed.get("air_quality", 100.0),
            "pressure": parsed.get("pressure", 1013.0),
            "energy_consumption": parsed.get("energy_consumption", 1.0),
            "device_status": parsed.get("device_status", "online"),
            "timestamp": parsed.get("timestamp", r.created_at.isoformat()),
        }
        out.append(item)
    return out


@router.post("/historical")
async def get_historical(req: HistoricalRequest):
    days = max(1, min(req.days, 90))
    readings = generate_historical(req.sensor_id, days)
    return {"sensor_id": req.sensor_id, "days": days, "count": len(readings), "readings": readings}
