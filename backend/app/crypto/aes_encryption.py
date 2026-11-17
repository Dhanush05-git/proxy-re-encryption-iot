"""
AES-256-GCM encryption/decryption for Data Encryption Keys (DEK).
NEVER log the DEK or plaintext.
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_data(plaintext: bytes) -> dict:
    """
    Encrypt plaintext using AES-256-GCM with a randomly generated DEK.
    Returns:
        dict with keys: ciphertext_b64, nonce_b64, dek_b64
    """
    dek = os.urandom(32)          # 256-bit DEK
    nonce = os.urandom(12)        # 96-bit nonce (GCM standard)
    aesgcm = AESGCM(dek)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return {
        "ciphertext_b64": base64.b64encode(ciphertext).decode(),
        "nonce_b64": base64.b64encode(nonce).decode(),
        "dek_b64": base64.b64encode(dek).decode(),
    }


def decrypt_data(ciphertext_b64: str, nonce_b64: str, dek_b64: str) -> bytes:
    """
    Decrypt AES-256-GCM ciphertext.
    Returns plaintext bytes.
    Raises ValueError on authentication failure.
    """
    try:
        dek = base64.b64decode(dek_b64)
        nonce = base64.b64decode(nonce_b64)
        ciphertext = base64.b64decode(ciphertext_b64)
        aesgcm = AESGCM(dek)
        return aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as e:
        raise ValueError(f"AES-GCM decryption failed: {e}") from e


def encrypt_with_key(plaintext: bytes, dek_b64: str) -> dict:
    """
    Encrypt using a provided DEK (for re-encryption workflows).
    Returns: {ciphertext_b64, nonce_b64}
    """
    try:
        dek = base64.b64decode(dek_b64)
        nonce = os.urandom(12)
        aesgcm = AESGCM(dek)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        return {
            "ciphertext_b64": base64.b64encode(ciphertext).decode(),
            "nonce_b64": base64.b64encode(nonce).decode(),
        }
    except Exception as e:
        raise ValueError(f"AES-GCM encryption failed: {e}") from e
