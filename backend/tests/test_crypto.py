"""
Pytest tests for the crypto layer.
Run: .venv/bin/python3 -m pytest backend/tests/ -v
"""
import os
import base64
import sys

# Ensure backend is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from app.crypto.aes_encryption import encrypt_data, decrypt_data
from app.crypto.umbral_pre import (
    generate_keypair,
    pre_encapsulate_dek,
    generate_kfrags_for_sharing,
    proxy_reencrypt_capsule,
    decrypt_reencrypted_dek,
    pre_decrypt_original_dek,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_parties():
    alice = generate_keypair()
    alice_sign = generate_keypair()
    bob = generate_keypair()
    return alice, alice_sign, bob


def do_kfrags(alice, alice_sign, bob, threshold=2, shares=3):
    return generate_kfrags_for_sharing(
        alice["secret_key_b64"], alice_sign["secret_key_b64"],
        bob["public_key_b64"], threshold=threshold, shares=shares,
    )


def do_reencrypt(capsule_b64, kfrag_b64, alice, alice_sign, bob):
    return proxy_reencrypt_capsule(
        capsule_b64, kfrag_b64,
        verifying_pk_b64=alice_sign["public_key_b64"],
        alice_pk_b64=alice["public_key_b64"],
        bob_pk_b64=bob["public_key_b64"],
    )


def do_decrypt(bob, alice, alice_sign, capsule_b64, cfrags, encrypted_dek_b64):
    return decrypt_reencrypted_dek(
        bob["secret_key_b64"], alice["public_key_b64"],
        capsule_b64, cfrags, encrypted_dek_b64,
        verifying_pk_b64=alice_sign["public_key_b64"],
    )


# ── AES-256-GCM ──────────────────────────────────────────────────────────────

def test_aes_roundtrip():
    """AES-256-GCM encrypts and decrypts correctly."""
    plaintext = b"Hello, IoT Secure World! \x00\x01\x02"
    result = encrypt_data(plaintext)

    assert "ciphertext_b64" in result
    assert "nonce_b64" in result
    assert "dek_b64" in result
    assert len(base64.b64decode(result["dek_b64"])) == 32
    assert len(base64.b64decode(result["nonce_b64"])) == 12

    recovered = decrypt_data(result["ciphertext_b64"], result["nonce_b64"], result["dek_b64"])
    assert recovered == plaintext


def test_aes_different_plaintexts_produce_different_ciphertexts():
    """Same plaintext encrypted twice should give different ciphertexts."""
    pt = b"sensor data"
    e1 = encrypt_data(pt)
    e2 = encrypt_data(pt)
    assert e1["ciphertext_b64"] != e2["ciphertext_b64"]
    assert e1["nonce_b64"] != e2["nonce_b64"]
    assert e1["dek_b64"] != e2["dek_b64"]


def test_wrong_key_fails():
    """Decryption with a wrong key must fail."""
    plaintext = b"Secret data"
    enc = encrypt_data(plaintext)
    wrong_dek = base64.b64encode(os.urandom(32)).decode()
    with pytest.raises(Exception):
        decrypt_data(enc["ciphertext_b64"], enc["nonce_b64"], wrong_dek)


def test_tamper_detection():
    """Flipping a byte in the ciphertext must be detected by GCM authentication."""
    plaintext = b"Tamper-resistant payload"
    enc = encrypt_data(plaintext)
    ct = bytearray(base64.b64decode(enc["ciphertext_b64"]))
    ct[0] ^= 0xFF
    tampered = base64.b64encode(bytes(ct)).decode()
    with pytest.raises(Exception):
        decrypt_data(tampered, enc["nonce_b64"], enc["dek_b64"])


# ── PRE workflow ──────────────────────────────────────────────────────────────

def test_pre_workflow():
    """Full PRE round-trip: Alice encrypts, proxy re-encrypts, Bob decrypts."""
    alice, alice_sign, bob = make_parties()
    dek = os.urandom(32)

    enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
    assert "capsule_b64" in enc
    assert "encrypted_dek_b64" in enc

    kfrags = do_kfrags(alice, alice_sign, bob)
    assert len(kfrags) == 3

    cfrag1 = do_reencrypt(enc["capsule_b64"], kfrags[0], alice, alice_sign, bob)
    cfrag2 = do_reencrypt(enc["capsule_b64"], kfrags[1], alice, alice_sign, bob)

    recovered = do_decrypt(bob, alice, alice_sign, enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"])
    assert recovered == dek


def test_threshold_pass():
    """2-of-3 threshold: exactly threshold cfrags are sufficient."""
    alice, alice_sign, bob = make_parties()
    dek = os.urandom(32)
    enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
    kfrags = do_kfrags(alice, alice_sign, bob)

    cfrag1 = do_reencrypt(enc["capsule_b64"], kfrags[0], alice, alice_sign, bob)
    cfrag2 = do_reencrypt(enc["capsule_b64"], kfrags[2], alice, alice_sign, bob)  # skip kfrag[1]

    recovered = do_decrypt(bob, alice, alice_sign, enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"])
    assert recovered == dek


def test_threshold_fail():
    """Below threshold (1 cfrag when threshold=2) must fail."""
    alice, alice_sign, bob = make_parties()
    dek = os.urandom(32)
    enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
    kfrags = do_kfrags(alice, alice_sign, bob)
    cfrag1 = do_reencrypt(enc["capsule_b64"], kfrags[0], alice, alice_sign, bob)
    with pytest.raises(Exception):
        do_decrypt(bob, alice, alice_sign, enc["capsule_b64"], [cfrag1], enc["encrypted_dek_b64"])


def test_wrong_key_fails_pre():
    """Wrong receiver secret key must not allow PRE decryption."""
    alice, alice_sign, bob = make_parties()
    charlie = generate_keypair()
    dek = os.urandom(32)
    enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
    kfrags = do_kfrags(alice, alice_sign, bob)
    cfrag1 = do_reencrypt(enc["capsule_b64"], kfrags[0], alice, alice_sign, bob)
    cfrag2 = do_reencrypt(enc["capsule_b64"], kfrags[1], alice, alice_sign, bob)
    with pytest.raises(Exception):
        # Charlie uses his key but cfrags were made for Bob → fails verification
        decrypt_reencrypted_dek(
            charlie["secret_key_b64"], alice["public_key_b64"],
            enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"],
            verifying_pk_b64=alice_sign["public_key_b64"],
        )


def test_revocation():
    """Simulated revocation: without cfrags, Bob cannot decrypt."""
    alice, alice_sign, bob = make_parties()
    dek = os.urandom(32)
    enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
    with pytest.raises(Exception):
        decrypt_reencrypted_dek(
            bob["secret_key_b64"], alice["public_key_b64"],
            enc["capsule_b64"], [], enc["encrypted_dek_b64"],
        )


def test_alice_direct_decrypt():
    """Alice can always decrypt her own data directly."""
    alice, _, _ = make_parties()
    dek = os.urandom(32)
    enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
    recovered = pre_decrypt_original_dek(
        alice["secret_key_b64"], enc["capsule_b64"], enc["encrypted_dek_b64"]
    )
    assert recovered == dek
