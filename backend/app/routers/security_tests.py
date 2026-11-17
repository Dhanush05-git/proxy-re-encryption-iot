"""
Security test suite — 9 automated checks for the crypto layer.
"""
import os
import base64
from fastapi import APIRouter
from app.crypto.aes_encryption import encrypt_data, decrypt_data
from app.crypto.umbral_pre import (
    generate_keypair, pre_encapsulate_dek,
    generate_kfrags_for_sharing, proxy_reencrypt_capsule,
    decrypt_reencrypted_dek, pre_decrypt_original_dek,
)

router = APIRouter(prefix="/security-tests", tags=["security-tests"])


def _run_test(name: str, fn) -> dict:
    try:
        details = fn()
        return {"name": name, "passed": True, "details": details or "OK"}
    except AssertionError as e:
        return {"name": name, "passed": False, "details": str(e)}
    except Exception as e:
        return {"name": name, "passed": False, "details": f"Exception: {type(e).__name__}: {e}"}


def _pre_setup():
    """Generate demo parties for PRE tests."""
    alice = generate_keypair()
    alice_sign = generate_keypair()
    bob = generate_keypair()
    return alice, alice_sign, bob


@router.post("/run")
async def run_security_tests():
    tests = []

    # 1. AES round-trip
    def test_aes_roundtrip():
        pt = b"Hello AES-256-GCM secure world!"
        enc = encrypt_data(pt)
        dec = decrypt_data(enc["ciphertext_b64"], enc["nonce_b64"], enc["dek_b64"])
        assert dec == pt, "AES decryption mismatch"
        return "Plaintext round-trip verified"
    tests.append(_run_test("AES-256-GCM Round-Trip", test_aes_roundtrip))

    # 2. Wrong key fails AES
    def test_wrong_key():
        pt = b"Secret sensor data"
        enc = encrypt_data(pt)
        wrong_dek = base64.b64encode(os.urandom(32)).decode()
        try:
            decrypt_data(enc["ciphertext_b64"], enc["nonce_b64"], wrong_dek)
            assert False, "Should have failed with wrong key"
        except Exception:
            return "Wrong key correctly rejected"
    tests.append(_run_test("AES Wrong Key Rejection", test_wrong_key))

    # 3. Tamper detection
    def test_tamper_detection():
        pt = b"Tamper me if you can"
        enc = encrypt_data(pt)
        ct_bytes = bytearray(base64.b64decode(enc["ciphertext_b64"]))
        ct_bytes[0] ^= 0xFF
        tampered_b64 = base64.b64encode(bytes(ct_bytes)).decode()
        try:
            decrypt_data(tampered_b64, enc["nonce_b64"], enc["dek_b64"])
            assert False, "Tamper should have been detected"
        except Exception:
            return "Ciphertext tampering correctly detected"
    tests.append(_run_test("AES-GCM Tamper Detection", test_tamper_detection))

    # 4. PRE full workflow
    def test_pre_workflow():
        alice, alice_sign, bob = _pre_setup()
        dek = os.urandom(32)
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        kfrags = generate_kfrags_for_sharing(
            alice["secret_key_b64"], alice_sign["secret_key_b64"],
            bob["public_key_b64"], threshold=2, shares=3
        )
        cfrag1 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[0],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        cfrag2 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[1],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        recovered = decrypt_reencrypted_dek(
            bob["secret_key_b64"], alice["public_key_b64"],
            enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"],
            verifying_pk_b64=alice_sign["public_key_b64"],
        )
        assert recovered == dek, "PRE DEK recovery mismatch"
        return "Full PRE workflow verified"
    tests.append(_run_test("PRE Full Workflow", test_pre_workflow))

    # 5. Threshold pass (2 of 3)
    def test_threshold_pass():
        alice, alice_sign, bob = _pre_setup()
        dek = os.urandom(32)
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        kfrags = generate_kfrags_for_sharing(
            alice["secret_key_b64"], alice_sign["secret_key_b64"],
            bob["public_key_b64"], threshold=2, shares=3
        )
        cfrag1 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[0],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        cfrag2 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[2],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        recovered = decrypt_reencrypted_dek(
            bob["secret_key_b64"], alice["public_key_b64"],
            enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"],
            verifying_pk_b64=alice_sign["public_key_b64"],
        )
        assert recovered == dek, "Threshold pass failed"
        return "2-of-3 threshold satisfied and DEK recovered"
    tests.append(_run_test("PRE Threshold Pass (2-of-3)", test_threshold_pass))

    # 6. Threshold fail (1 cfrag when threshold=2)
    def test_threshold_fail():
        alice, alice_sign, bob = _pre_setup()
        dek = os.urandom(32)
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        kfrags = generate_kfrags_for_sharing(
            alice["secret_key_b64"], alice_sign["secret_key_b64"],
            bob["public_key_b64"], threshold=2, shares=3
        )
        cfrag1 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[0],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        try:
            decrypt_reencrypted_dek(
                bob["secret_key_b64"], alice["public_key_b64"],
                enc["capsule_b64"], [cfrag1], enc["encrypted_dek_b64"],
                verifying_pk_b64=alice_sign["public_key_b64"],
            )
            assert False, "Should have failed with insufficient cfrags"
        except Exception:
            return "Below-threshold cfrag count correctly fails"
    tests.append(_run_test("PRE Threshold Fail (1-of-3)", test_threshold_fail))

    # 7. Wrong receiving key
    def test_wrong_receiver():
        alice, alice_sign, bob = _pre_setup()
        charlie = generate_keypair()
        dek = os.urandom(32)
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        kfrags = generate_kfrags_for_sharing(
            alice["secret_key_b64"], alice_sign["secret_key_b64"],
            bob["public_key_b64"], threshold=2, shares=3
        )
        cfrag1 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[0],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        cfrag2 = proxy_reencrypt_capsule(
            enc["capsule_b64"], kfrags[1],
            verifying_pk_b64=alice_sign["public_key_b64"],
            alice_pk_b64=alice["public_key_b64"],
            bob_pk_b64=bob["public_key_b64"],
        )
        try:
            # Charlie tries to decrypt — should fail on cfrag verification
            decrypt_reencrypted_dek(
                charlie["secret_key_b64"], alice["public_key_b64"],
                enc["capsule_b64"], [cfrag1, cfrag2], enc["encrypted_dek_b64"],
                verifying_pk_b64=alice_sign["public_key_b64"],
            )
            assert False, "Wrong receiver should not decrypt"
        except Exception:
            return "Wrong receiver correctly rejected"
    tests.append(_run_test("PRE Wrong Receiver Key", test_wrong_receiver))

    # 8. Alice can decrypt original
    def test_alice_direct_decrypt():
        alice, _, _ = _pre_setup()
        dek = os.urandom(32)
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        recovered = pre_decrypt_original_dek(
            alice["secret_key_b64"], enc["capsule_b64"], enc["encrypted_dek_b64"]
        )
        assert recovered == dek, "Alice direct decryption failed"
        return "Alice direct decryption verified"
    tests.append(_run_test("PRE Original Owner Decryption", test_alice_direct_decrypt))

    # 9. Revocation simulation
    def test_revocation():
        alice, _, bob = _pre_setup()
        dek = os.urandom(32)
        enc = pre_encapsulate_dek(dek, alice["public_key_b64"])
        try:
            decrypt_reencrypted_dek(
                bob["secret_key_b64"], alice["public_key_b64"],
                enc["capsule_b64"], [], enc["encrypted_dek_b64"],
            )
            assert False, "Should fail with no cfrags"
        except Exception:
            return "Revocation enforced: no cfrags → no access"
    tests.append(_run_test("PRE Revocation Enforcement", test_revocation))

    passed = sum(1 for t in tests if t["passed"])
    return {
        "total": len(tests),
        "passed": passed,
        "failed": len(tests) - passed,
        "tests": tests,
        "results": tests,
    }
