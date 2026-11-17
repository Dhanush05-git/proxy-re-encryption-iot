"""Application configuration."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
KEYS_DIR = BASE_DIR / "keys"
RESULTS_DIR = BASE_DIR / "results"
DATABASE_URL = f"sqlite+aiosqlite:///{BASE_DIR}/pre_iot.db"

# PRE threshold config
PRE_THRESHOLD = 2
PRE_SHARES = 3

# JWT
SECRET_KEY = "pre-iot-demo-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# Ensure dirs exist
for d in [STORAGE_DIR, KEYS_DIR, RESULTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)
