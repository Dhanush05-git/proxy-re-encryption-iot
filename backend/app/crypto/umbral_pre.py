"""
Umbral Proxy Re-Encryption (PRE) wrapper using umbral 0.3.0 API.
All keys are serialized as base64 strings for JSON transport.
Private keys are NEVER stored to disk or logged.

UMBRAL 0.3.0 key facts:
- generate_kfrags() → VerifiedKeyFrag[]
- KeyFrag.from_bytes() → unverified KeyFrag (needs .verify(verifying_pk, ...))
- reencrypt(capsule, kfrag) requires a VerifiedKeyFrag → VerifiedCapsuleFrag
- CapsuleFrag.from_bytes() → unverified CapsuleFrag (needs .verify(capsule, verifying_pk, ...))
- decrypt_reencrypted needs VerifiedCapsuleFrag[]
"""
import base64
import json
from typing import List, Optional

from umbral import SecretKey, Signer, PublicKey
from umbral import encrypt as umbral_encrypt
from umbral import decrypt_original
from umbral import generate_kfrags, reencrypt, decrypt_reencrypted
from umbral import Capsule, CapsuleFrag, KeyFrag


def _b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


def _b64d(data: str) -> bytes:
    return base64.b64decode(data)


# ── Key generation ─────────────────────────────────────────────────────────────

def generate_keypair() -> dict:
    """
    Generate a new Umbral SecretKey / PublicKey pair.
    Returns: {"secret_key_b64": str, "public_key_b64": str}
    """
    sk = SecretKey.random()
    pk = sk.public_key()
    return {
        "secret_key_b64": _b64e(sk.to_secret_bytes()),
        "public_key_b64": _b64e(bytes(pk)),
    }


# ── Encryption (Alice → DEK encapsulation) ─────────────────────────────────────

def pre_encapsulate_dek(dek_bytes: bytes, alice_pk_b64: str) -> dict:
    """
    Encrypt a DEK under Alice's public key using Umbral PRE.
    Returns: {"capsule_b64": str, "encrypted_dek_b64": str}
    """
    alice_pk = PublicKey.from_bytes(_b64d(alice_pk_b64))
    capsule, ciphertext = umbral_encrypt(alice_pk, dek_bytes)
    return {
        "capsule_b64": _b64e(bytes(capsule)),
        "encrypted_dek_b64": _b64e(bytes(ciphertext)),
    }


# ── Key Fragment generation ────────────────────────────────────────────────────

def generate_kfrags_for_sharing(
    alice_sk_b64: str,
    alice_signing_sk_b64: str,
    bob_pk_b64: str,
    threshold: int = 2,
    shares: int = 3,
) -> List[str]:
    """
    Generate re-encryption key fragments (kfrags) for Bob.
    Returns list of base64-encoded KFrags.
    
    The signing SK's public key (verifying_pk) must be provided to proxy_reencrypt_capsule
    so it can verify the deserialized KeyFrag before re-encryption.
    """
    alice_sk = SecretKey.from_bytes(_b64d(alice_sk_b64))
    signing_sk = SecretKey.from_bytes(_b64d(alice_signing_sk_b64))
    bob_pk = PublicKey.from_bytes(_b64d(bob_pk_b64))
    signer = Signer(signing_sk)

    kfrags = generate_kfrags(
        delegating_sk=alice_sk,
        receiving_pk=bob_pk,
        signer=signer,
        threshold=threshold,
        shares=shares,
    )
    return [_b64e(bytes(kf)) for kf in kfrags]


# ── Proxy re-encryption ────────────────────────────────────────────────────────

def proxy_reencrypt_capsule(
    capsule_b64: str,
    kfrag_b64: str,
    verifying_pk_b64: Optional[str] = None,
    alice_pk_b64: Optional[str] = None,
    bob_pk_b64: Optional[str] = None,
) -> str:
    """
    Perform re-encryption on the proxy side.
    
    Args:
        capsule_b64: base64-encoded Capsule
        kfrag_b64: base64-encoded KeyFrag (unverified after deserialization)
        verifying_pk_b64: Alice's signing public key — required to verify the kfrag
        alice_pk_b64: Alice's delegating public key (optional, for stricter verification)
        bob_pk_b64: Bob's receiving public key (optional, for stricter verification)
    
    Returns: cfrag_b64 (base64-encoded VerifiedCapsuleFrag)
    """
    capsule = Capsule.from_bytes(_b64d(capsule_b64))
    kfrag = KeyFrag.from_bytes(_b64d(kfrag_b64))

    # Verify the kfrag before re-encryption (required by umbral 0.3.0)
    if verifying_pk_b64:
        verifying_pk = PublicKey.from_bytes(_b64d(verifying_pk_b64))
        alice_pk = PublicKey.from_bytes(_b64d(alice_pk_b64)) if alice_pk_b64 else None
        bob_pk = PublicKey.from_bytes(_b64d(bob_pk_b64)) if bob_pk_b64 else None
        verified_kfrag = kfrag.verify(verifying_pk, delegating_pk=alice_pk, receiving_pk=bob_pk)
    else:
        raise ValueError(
            "proxy_reencrypt_capsule requires verifying_pk_b64 (Alice's signing public key) "
            "to verify the deserialized KeyFrag."
        )

    cfrag = reencrypt(capsule=capsule, kfrag=verified_kfrag)
    return _b64e(bytes(cfrag))


# ── Decryption (Bob) ───────────────────────────────────────────────────────────

def decrypt_reencrypted_dek(
    bob_sk_b64: str,
    alice_pk_b64: str,
    capsule_b64: str,
    cfrag_b64_list: List[str],
    encrypted_dek_b64: str,
    verifying_pk_b64: Optional[str] = None,
) -> bytes:
    """
    Bob decrypts the re-encrypted DEK.
    
    Args:
        bob_sk_b64: Bob's secret key
        alice_pk_b64: Alice's delegating public key
        capsule_b64: The original capsule
        cfrag_b64_list: List of base64-encoded CapsuleFrags
        encrypted_dek_b64: The encrypted DEK ciphertext
        verifying_pk_b64: Alice's signing public key (for cfrag verification)
    
    Returns plaintext DEK bytes.
    """
    if not cfrag_b64_list:
        raise ValueError("No cfrags provided — cannot decrypt re-encrypted DEK")

    bob_sk = SecretKey.from_bytes(_b64d(bob_sk_b64))
    alice_pk = PublicKey.from_bytes(_b64d(alice_pk_b64))
    capsule = Capsule.from_bytes(_b64d(capsule_b64))
    ciphertext = _b64d(encrypted_dek_b64)
    bob_pk = bob_sk.public_key()

    if not verifying_pk_b64:
        # Fall back: use alice_pk as the verifying_pk
        # (only works if Alice signed with her main key, not a separate signing key)
        verifying_pk = alice_pk
    else:
        verifying_pk = PublicKey.from_bytes(_b64d(verifying_pk_b64))

    verified_cfrags = []
    for cfrag_b64 in cfrag_b64_list:
        cfrag = CapsuleFrag.from_bytes(_b64d(cfrag_b64))
        verified = cfrag.verify(
            capsule,
            verifying_pk=verifying_pk,
            delegating_pk=alice_pk,
            receiving_pk=bob_pk,
        )
        verified_cfrags.append(verified)

    return decrypt_reencrypted(
        receiving_sk=bob_sk,
        delegating_pk=alice_pk,
        capsule=capsule,
        verified_cfrags=verified_cfrags,
        ciphertext=ciphertext,
    )


# ── Direct decryption (Alice) ──────────────────────────────────────────────────

def pre_decrypt_original_dek(
    alice_sk_b64: str,
    capsule_b64: str,
    encrypted_dek_b64: str,
) -> bytes:
    """
    Alice decrypts the DEK directly (no re-encryption needed).
    Returns plaintext DEK bytes.
    """
    alice_sk = SecretKey.from_bytes(_b64d(alice_sk_b64))
    capsule = Capsule.from_bytes(_b64d(capsule_b64))
    ciphertext = _b64d(encrypted_dek_b64)
    return decrypt_original(delegating_sk=alice_sk, capsule=capsule, ciphertext=ciphertext)
