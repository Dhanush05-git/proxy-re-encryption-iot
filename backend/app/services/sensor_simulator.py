"""
Sensor data simulator — generates realistic IoT sensor readings.
"""
import random
import uuid
import math
from datetime import datetime, timedelta
from typing import Optional, List


DEVICE_STATUSES = ["online", "online", "online", "idle", "warning", "error"]


def generate_reading(sensor_id: Optional[str] = None) -> dict:
    """
    Generate a single synthetic IoT sensor reading.
    Returns dict with sensor metrics.
    """
    sid = sensor_id or f"SENSOR-{random.randint(1, 10):03d}"
    return {
        "sensor_id": sid,
        "temperature": round(random.uniform(15.0, 45.0), 2),
        "humidity": round(random.uniform(20.0, 95.0), 2),
        "air_quality": round(random.uniform(0.0, 500.0), 1),
        "pressure": round(random.uniform(980.0, 1030.0), 2),
        "energy_consumption": round(random.uniform(0.1, 5.0), 3),
        "device_status": random.choice(DEVICE_STATUSES),
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


def generate_batch(count: int, sensor_ids: Optional[List[str]] = None) -> List[dict]:
    """
    Generate `count` sensor readings. If sensor_ids given, distribute among them.
    """
    readings = []
    for i in range(count):
        sid = None
        if sensor_ids:
            sid = sensor_ids[i % len(sensor_ids)]
        readings.append(generate_reading(sid))
    return readings


def generate_historical(sensor_id: str, days: int = 7) -> List[dict]:
    """
    Generate hourly sensor readings for `days` days with realistic drift.
    Uses sinusoidal temperature model + noise.
    """
    readings = []
    now = datetime.utcnow()
    total_hours = days * 24

    # Seed baseline values
    base_temp = random.uniform(20.0, 30.0)
    base_humidity = random.uniform(40.0, 70.0)
    base_aq = random.uniform(50.0, 150.0)
    base_pressure = random.uniform(1005.0, 1020.0)
    base_energy = random.uniform(1.0, 3.0)

    for h in range(total_hours, 0, -1):
        ts = now - timedelta(hours=h)
        hour_of_day = ts.hour
        day_progress = hour_of_day / 24.0

        # Realistic sinusoidal variation
        temp = base_temp + 5.0 * math.sin(2 * math.pi * day_progress - math.pi / 2)
        temp += random.gauss(0, 0.5)
        temp = max(15.0, min(45.0, temp))

        humidity = base_humidity - 10.0 * math.sin(2 * math.pi * day_progress)
        humidity += random.gauss(0, 1.0)
        humidity = max(20.0, min(95.0, humidity))

        aq = base_aq + 20.0 * math.sin(2 * math.pi * (day_progress + 0.3))
        aq += random.gauss(0, 5.0)
        aq = max(0.0, min(500.0, aq))

        pressure = base_pressure + random.gauss(0, 1.0)
        pressure = max(980.0, min(1030.0, pressure))

        energy = base_energy + 0.5 * math.sin(2 * math.pi * (day_progress + 0.1))
        energy += random.gauss(0, 0.1)
        energy = max(0.1, min(5.0, energy))

        # Slight drift over days
        base_temp += random.gauss(0, 0.05)
        base_humidity += random.gauss(0, 0.1)

        readings.append({
            "sensor_id": sensor_id,
            "temperature": round(temp, 2),
            "humidity": round(humidity, 2),
            "air_quality": round(aq, 1),
            "pressure": round(pressure, 2),
            "energy_consumption": round(energy, 3),
            "device_status": random.choice(DEVICE_STATUSES),
            "timestamp": ts.isoformat() + "Z",
        })

    return readings
