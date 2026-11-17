# Threat Model

## Overview

This document formally characterizes the security assumptions, threat actors, attack surfaces, and mitigations for the PRE-IoT system. It follows the STRIDE threat modelling methodology and distinguishes between threats the system is designed to resist, threats that are mitigated by design but require operational discipline, and threats explicitly outside the security model.

---

## Security Assumptions

The following assumptions underlie all security claims made about this system:

| # | Assumption | Justification |
|---|---|---|
| A1 | Elliptic curve discrete logarithm problem (ECDLP) is computationally hard | Standard cryptographic assumption; underlying Umbral PRE security |
| A2 | AES-256 is a secure pseudorandom permutation | NIST-standardized; no known practical attacks |
| A3 | GCM authentication tag forgery probability is ≤ 2^{-128} | Proven in GCM specification |
| A4 | Hash functions used in Umbral (H, KDF) behave as random oracles | Random oracle model; Umbral security proof relies on this |
| A5 | At most t-1 = 1 proxy worker is compromised | Threshold property; ≥2 compromised proxies break proxy non-decryptability |
| A6 | Alice's secret key is not compromised | If sk_A is stolen, all encrypted data is immediately decryptable |
| A7 | Bob's secret key is not compromised | If sk_B is stolen, all data delegated to Bob is immediately decryptable |
| A8 | The network transport provides confidentiality (TLS in production) | Prototype runs HTTP; production must use mTLS |
| A9 | The API server is not fully compromised (data-at-rest attack) | Kfrags are stored in the database; a full DB compromise exposes them |

---

## Threat Actors

### 1. Eavesdropper (Network Attacker)

**Profile**: A passive attacker who intercepts network traffic between clients, the API, and proxy workers.

**Capabilities**:
- Reads all HTTP traffic (in the prototype, which uses plaintext HTTP).
- Cannot modify traffic (passive model).
- Has access to publicly observable capsule, encrypted DEK, and AES ciphertext.

**Goal**: Recover sensor payload plaintext.

**What they observe**: Capsule `(E, V, s)`, `enc_DEK`, AES ciphertext, nonces. All cryptographically opaque without `sk_A` or ≥2 cfrags + `sk_B`.

---

### 2. Malicious Proxy (Single Compromised Worker)

**Profile**: One of the three proxy workers is controlled by an attacker. The attacker knows `kfrag_i` and can run arbitrary code on that worker.

**Capabilities**:
- Knows one kfrag (`kf_i`).
- Sees the capsule for every file it processes.
- Can produce or refuse to produce `cfrag_i`.
- Cannot see other workers' kfrags.

**Goal**: Recover the DEK or plaintext.

**Attack**: Try to derive DEK from `(capsule, kfrag_i)`.

**Why it fails**: By the threshold (t=2, n=3) property of Umbral, a single kfrag provides no information about the DEK. The underlying Shamir scheme is information-theoretically secure for t-1 shares: `kfrag_i` is a point evaluation of a polynomial whose constant term (the re-encryption key) is not derivable from fewer than `t` evaluations.

---

### 3. Colluding Proxies (≥2 Compromised Workers)

**Profile**: Two or more proxy workers are controlled by the same attacker.

**Capabilities**:
- Knows `kfrag_i` and `kfrag_j` (two or more shares).
- Can apply Lagrange interpolation to reconstruct `rk_{A→B}`.

**Goal**: Reconstruct the re-encryption key and use it to convert any of Alice's capsules.

**What they can do**: Reconstruct `rk_{A→B}` and re-encrypt capsules for Bob. They can then give Bob the cfrags, allowing him to decrypt. This is functionally equivalent to the intended behavior—they produce what Alice authorized.

**What they cannot do**: Learn `sk_A` from `rk_{A→B}` (collusion safety of AFGH scheme). They cannot decrypt the DEK themselves without `sk_B`.

**What they can do (beyond spec)**: Re-encrypt for Bob at unauthorized times (e.g., after revocation if they cache kfrags). This is a limitation; production systems should use short-lived kfrags with expiry metadata.

---

### 4. Unauthorized User (Charlie)

**Profile**: A registered user with valid credentials who has not been granted access to a specific file.

**Capabilities**:
- Valid API credentials (can authenticate).
- Has his own keypair `(sk_C, pk_C)`.
- Can read public information (capsule, AES ciphertext, file metadata if the API permits).

**Goal**: Decrypt a file he was not granted access to.

**Attack**: Call `POST /api/crypto/reencrypt {grant_id}` for a grant that doesn't belong to him.

**Mitigation**: The API checks that:
1. A grant exists for the requesting user (`grantee_id == Charlie`) — which it does not.
2. The grant status is `active`.
If either check fails, the API returns `403 Forbidden`. No kfrags are accessed.

---

### 5. Insider Attacker (Compromised API Server)

**Profile**: An attacker with read access to the SQLite database or API server filesystem.

**Capabilities**:
- Can read all database records, including `kfrags_b64_json` from active grants.
- Can read AES ciphertexts from the `storage/` directory.
- Can read capsules and encrypted DEKs.

**Goal**: Decrypt stored sensor data.

**Attack vector 1 — Use stolen kfrags**: The attacker has all 3 kfrags for a grant. She reconstructs `rk_{A→B}` via Lagrange interpolation, re-encrypts capsules, and needs `sk_B` to complete decryption.

**Why it fails (partially)**: The insider gets the cfrags from re-encryption but still needs Bob's secret key to decrypt the DEK. If Bob's secret key is not in the database (correct design), the insider cannot complete decryption.

**Attack vector 2 — Full key compromise**: If Alice's secret key is stored in the database (prototype behavior), the insider can call `decrypt_original(sk_A, capsule, enc_DEK)` → DEK → decrypt payload.

> [!CAUTION] In the prototype, secret keys are stored in the database for demonstration convenience. This is **NOT acceptable for production**. Production systems must use client-side key generation with the secret key never leaving the owner's device (use WebCrypto API in the browser or a hardware security module).

---

### 6. Bob Colludes with a Proxy

**Profile**: An authorized recipient (Bob) colludes with one or more proxy workers to try to recover Alice's secret key.

**What they have**: `sk_B`, ≥1 kfrags, all cfrags produced for Bob, the capsule.

**Goal**: Derive `sk_A` to decrypt files not granted to Bob, or to generate new re-encryption grants.

**Why it fails**: The AFGH PRE scheme is proven collusion-safe: `rk_{A→B}` and `sk_B` together do not reveal `sk_A`. Even with all kfrags reconstructed and `sk_B`, the attacker cannot compute `sk_A` without solving the ECDLP.

---

## Threats and Mitigations Table

| Threat | STRIDE Category | Threat Actor | Mitigation | Residual Risk |
|---|---|---|---|---|
| Eavesdrop on ciphertext | Information Disclosure | Network Attacker | AES-256-GCM encryption | Low (requires key) |
| Tamper with ciphertext | Tampering | Network Attacker | GCM authentication tag | Low (detected at decrypt) |
| Single proxy learns DEK | Information Disclosure | Malicious Proxy | Threshold (t=2): 1 kfrag insufficient | None (information-theoretic) |
| Unauthorized re-encryption | Elevation of Privilege | Charlie | Grant check (grantee_id match) | Low (API enforces) |
| Colluding proxies bypass threshold | Information Disclosure | ≥2 Compromised Proxies | Still need sk_B to decrypt | Medium (get valid cfrags, need Bob) |
| Insider DB read + kfrags | Information Disclosure | Insider | Secret keys not in DB (production) | High if prototype DB exposed |
| kfrag forgery | Spoofing | Malicious Actor | kfrags signed by Alice's signing key | Low (ECDSA forgery hard) |
| Replay re-encryption request | Repudiation | Attacker with access | Grant ID validation, audit log | Medium (rate limit in production) |
| DoS on proxy workers | Denial of Service | Attacker | 2-of-3 threshold: 1 worker down = OK | Low (threshold provides redundancy) |
| Revocation bypass (cached cfrags) | Elevation of Privilege | Bob | Revocation prevents new cfrags only | Medium (forward secrecy limitation) |
| Bob derives sk_A | Information Disclosure | Bob + Proxies | AFGH collusion safety | None (cryptographic guarantee) |
| Clock skew expiry bypass | Elevation of Privilege | Attacker | Server-side expiry check (UTC) | Low |
| SQL injection | Tampering | Attacker | SQLAlchemy ORM (parameterized queries) | Low |

---

## What the System Protects Against

1. **Payload confidentiality from the cloud**: AES-256-GCM ensures the cloud provider reads only ciphertext.
2. **DEK confidentiality from individual proxies**: Threshold PRE ensures one proxy cannot re-encrypt alone.
3. **Unauthorized access**: API-level grant authorization prevents ungranted users from obtaining cfrags.
4. **Ciphertext tampering detection**: GCM authentication tag detects any modification to the AES ciphertext.
5. **kfrag forgery**: ECDSA signatures on kfrags prevent proxy injection attacks.
6. **Single-proxy disclosure**: 1 of 3 proxy workers is compromised → no information about DEK leaks.
7. **Alice's key derivation by Bob**: AFGH collusion safety provides a cryptographic guarantee.

---

## Known Limitations and What the System Does NOT Protect Against

> [!WARNING] The following are out-of-scope or unmitigated risks. Document them clearly when presenting or deploying this system.

| Limitation | Description |
|---|---|
| **No forward secrecy** | Cfrags already delivered to Bob before revocation remain permanently valid. Post-revocation, Bob can still decrypt files using those cfrags. |
| **Prototype key storage** | Secret keys are stored in SQLite for demo convenience. This violates the security model; a compromised database exposes all data. |
| **No quantum resistance** | Umbral is based on ECDLP. A cryptographically relevant quantum computer running Shor's algorithm would break the scheme. |
| **≥2 colluding proxies** | Two colluding proxies can reconstruct rk_{A→B}, producing cfrags at will (though they still need sk_B to decrypt). |
| **No TLS in development** | All traffic is plaintext HTTP. Production must enforce TLS 1.3 with certificate pinning. |
| **No rate limiting** | The API has no rate limiting in the prototype; a DoS attack could exhaust database connections. |
| **SQLite single-writer** | Concurrent write operations may queue; not suitable for high-throughput production. |
| **Static kfrag lifetime** | Kfrags have no cryptographic expiry; revocation is purely a database flag that could be bypassed with DB write access. |

---

## Revocation Limitations and Forward Secrecy

**Current behavior**: Revocation sets `grant.status = 'revoked'` in the database. Proxy workers check this status before re-encrypting. This prevents *new* cfrags from being generated.

**What cannot be revoked**: Cfrags already delivered to Bob. These are computed values derived from the capsule and kfrag—they are not stored in a central location that can be deleted. If Bob saved his cfrags locally, he can continue to use them to decrypt the DEK even after revocation.

**Forward secrecy mitigation options** (not implemented in prototype):
1. **Per-file session keys with key rotation**: After revocation, Alice re-encrypts the file with a new DEK under a new capsule. Future accesses must use the new capsule. Bob's old cfrags are useless for the new capsule.
2. **Short-lived cfrags with expiry**: Include a time-bound in the cfrag commitment. Bob's application discards expired cfrags. Requires synchronized clocks.
3. **Blind decryption service**: Replace Bob's local decryption with a trusted execution environment (TEE) that checks revocation status before decrypting, even with valid cfrags.

---

## Key Compromise Scenarios

### Alice's Secret Key Compromised

If `sk_A` is leaked:
- Attacker can call `decrypt_original(sk_A, capsule, enc_DEK)` to recover any DEK.
- Attacker can generate new kfrags for any recipient.
- **Mitigation**: Alice must rotate all her keypairs, re-encrypt all stored files with a new DEK under a new capsule, and revoke all grants. This is an O(n) operation over all files.

### Bob's Secret Key Compromised

If `sk_B` is leaked:
- Attacker can decrypt any DEK that has been re-encrypted for Bob (has valid cfrags).
- Attacker cannot generate new grants or access files not granted to Bob.
- **Mitigation**: Bob rotates his keypair. Alice revokes the grant and re-issues a new one using Bob's new public key. Only files re-granted are newly exposed.

### Proxy Worker kfrag Leaked (Single)

If one kfrag `kf_i` is leaked:
- Attacker knows one point evaluation of the re-encryption polynomial.
- With fewer than t=2 kfrags, no information about the re-encryption key is revealed (information-theoretic security of Shamir sharing).
- **Mitigation**: Revoke the grant, generate a new kfrag set.

### Database Fully Compromised

If the SQLite database is exfiltrated:
- Attacker has all 3 kfrags per grant, all capsules, all encrypted DEKs, all AES ciphertexts.
- Attacker can reconstruct `rk_{A→B}` from 3 kfrags, produce cfrags, but needs Bob's `sk_B` to decrypt.
- If prototype stores `sk_B` in DB, all data is fully compromised.
- **Mitigation**: Ensure secret keys are never persisted. Use encryption at rest for the database. Rotate all keys immediately after confirmed breach.
