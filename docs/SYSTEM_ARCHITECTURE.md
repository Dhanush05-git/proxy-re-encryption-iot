# System Architecture

## Overview

The PRE-IoT system is a distributed application composed of four logical tiers:

1. **Client Tier** — Alice's browser/CLI and Bob's browser/CLI.
2. **API Tier** — A stateless FastAPI backend that orchestrates all cryptographic and storage operations.
3. **Proxy Tier** — Three semi-trusted proxy worker functions that perform capsule re-encryption.
4. **Storage Tier** — SQLite database (metadata) and local filesystem (AES ciphertexts).

The defining architectural property is that **no single component can decrypt IoT payload data without cooperation from Alice or Bob**. The API, proxies, and storage layer each see only encrypted data or partial key material.

---

## Trust Boundaries

| Party | What They Know | What They Cannot Learn |
|---|---|---|
| **Alice** | Her own `sk_A`, all DEKs for her files, all kfrags she generated | Bob's `sk_B`, Charlie's keys |
| **Bob** | His own `sk_B`, the DEK after re-encryption, the decrypted payload | Alice's `sk_A`, other users' DEKs |
| **Proxy Worker i** | One kfrag `kf_i`, the capsule (public), `cfrag_i` it produces | The DEK, the AES ciphertext meaning, Alice's or Bob's secret keys |
| **Cloud Storage** | AES ciphertext, nonce, capsule, encrypted DEK (all encrypted) | Plaintext payload, DEK (encrypted under Alice's pk) |
| **API Backend** | Base64-encoded public keys, encrypted file metadata, grant records | Secret keys (never persisted beyond request lifetime if passed ephemerally) |
| **Database** | Hashed passwords, public keys, capsule bytes, kfrags (base64), grant status | Secret keys (not stored), plaintext payloads |
| **Unauthorized User (Charlie)** | Whatever is public (pk_A, pk_B, capsule, AES ciphertext) | DEK, plaintext, re-encryption key |

> [!IMPORTANT] Secret keys (`sk_A`, `sk_B`) must never be transmitted to the backend in a production deployment. In this prototype, keys are stored in the database for demonstration convenience only. The correct architecture uses client-side key generation and in-browser cryptography.

---

## Full System Architecture Diagram

```mermaid
flowchart TD
    subgraph Alice["👩 Alice (Data Owner)"]
        direction TB
        A_GEN[Key Generation\nsk_A, pk_A, sign_sk]
        A_SIM[Sensor Simulator\ntemp, humidity, AQ, energy]
        A_AES[AES-256-GCM\nencrypt payload → ciphertext, nonce, DEK]
        A_PRE[Umbral encrypt\nencrypt DEK → capsule, enc_DEK]
        A_KFRAG[generate_kfrags\nthreshold=2, shares=3\n→ kfrag_1, kfrag_2, kfrag_3]
        A_GEN --> A_SIM --> A_AES --> A_PRE --> A_KFRAG
    end

    subgraph API["🔧 FastAPI Backend"]
        direction TB
        API_USERS[/api/users\nregister, login, list]
        API_SENSOR[/api/sensors\ngenerate, history]
        API_CRYPTO[/api/crypto\nencrypt, grant, reencrypt, decrypt]
        API_AUDIT[/api/audit\nlogs, search]
        API_BENCH[/api/benchmark\nrun, results]
    end

    subgraph DB["💾 SQLite Database"]
        DB_USERS[(Users\nid, username, pk_b64)]
        DB_FILES[(EncryptedFiles\nid, capsule, enc_DEK, path)]
        DB_GRANTS[(AccessGrants\nid, kfrags_json, status)]
        DB_PROXY[(ProxyOperations\nworker_id, cfrag, time_ms)]
        DB_AUDIT[(AuditLog\naction, user, timestamp)]
    end

    subgraph Storage["☁️ Cloud File Storage"]
        S_CT[("AES Ciphertext\n+ 12-byte nonce\n(files/*)")]
    end

    subgraph Proxies["⚙️ Proxy Layer (Semi-Trusted)"]
        direction LR
        PW1["Proxy Worker 1\nreencrypt(capsule, kfrag_1)\n→ cfrag_1"]
        PW2["Proxy Worker 2\nreencrypt(capsule, kfrag_2)\n→ cfrag_2"]
        PW3["Proxy Worker 3\nreencrypt(capsule, kfrag_3)\n→ cfrag_3"]
    end

    subgraph Bob["👨 Bob (Authorized Recipient)"]
        direction TB
        B_COLLECT[Collect cfrag_1 + cfrag_2]
        B_RECON["decrypt_reencrypted\n(sk_B, pk_A, capsule,\n[cfrag_1,cfrag_2], enc_DEK)\n→ DEK"]
        B_AES[AES-256-GCM\ndecrypt(ciphertext, nonce, DEK)\n→ sensor_data]
        B_COLLECT --> B_RECON --> B_AES
    end

    subgraph Charlie["🚫 Charlie (Unauthorized)"]
        C_FAIL[Request blocked\n403 Forbidden\nNo active grant]
    end

    Alice --> API
    API --> DB
    API --> Storage
    API_CRYPTO --> PW1 & PW2 & PW3
    PW1 & PW2 -->|cfrag_1, cfrag_2| Bob
    Storage --> Bob
    Charlie -->|No grant| API_CRYPTO --> C_FAIL
```

---

## Component Descriptions

### Alice's Client

Alice's client is responsible for all sensitive cryptographic operations involving her secret key:
- **Key Generation**: Creates `sk_A`, `pk_A`, signing key pair. Only `pk_A` and signing verification key are shared publicly.
- **Sensor Simulation**: Generates synthetic IoT readings (temperature 15–45°C, humidity 20–95%, air quality 0–500 AQI, pressure 980–1030 hPa, energy 0.1–5.0 kW).
- **Encryption**: Runs AES-256-GCM and Umbral encapsulation locally (in the prototype, via the API).
- **kfrag Generation**: Alice calls `generate_kfrags` only after verifying Bob's public key. The signing key authenticates each kfrag.

### FastAPI Backend

A stateless, async REST API built with FastAPI 0.115+. It:
- Validates all requests with Pydantic v2 schemas.
- Routes cryptographic calls to the `crypto/` module.
- Persists metadata (never raw plaintext) to SQLite via SQLAlchemy async.
- Records every significant action to the `AuditLog` table.
- Returns standardized JSON responses with HTTP status codes.

### SQLite Database

Stores all application state. Schema:
- **Users**: `id`, `username`, `email`, `role` (alice/bob/admin), `public_key_b64`, `signing_pk_b64`, `hashed_password`, `created_at`.
- **EncryptedFiles**: `id`, `filename`, `sensor_id`, `owner_id`, `capsule_b64`, `encrypted_dek_b64`, `nonce_b64`, `file_size`, `storage_path`, `created_at`.
- **AccessGrants**: `id`, `file_id`, `granter_id`, `grantee_id`, `kfrags_b64_json` (JSON array of 3 base64 kfrags), `threshold`, `shares`, `status`, `expires_at`, `created_at`.
- **ProxyOperations**: `id`, `grant_id`, `worker_id`, `cfrag_b64`, `processing_time_ms`, `status`, `created_at`.
- **AuditLog**: `id`, `action`, `user_id`, `details_json`, `ip_address`, `created_at`.

### Cloud File Storage

A local `storage/` directory (simulating cloud object storage) containing AES-GCM ciphertexts named by file UUID. The nonce is stored in the database alongside the capsule and encrypted DEK. Only the AES ciphertext is in the filesystem; all metadata needed for decryption is in the database.

### Proxy Workers

Three Python functions within `proxy_service.py` simulate independent proxy nodes. In a production deployment, these would be separate microservices or cloud functions with separate key stores. Each worker:
1. Receives `(capsule_b64, kfrag_b64)` from the API.
2. Deserializes both using `Capsule.from_bytes()` and `VerifiedKeyFrag.from_bytes()` (after signature verification).
3. Calls `reencrypt(capsule, kfrag)` → `VerifiedCapsuleFrag`.
4. Serializes and returns `cfrag_b64`, recording processing time in milliseconds.

### Bob's Client

Bob collects ≥2 cfrags from the proxy workers and his own decryption inputs:
- `sk_B` (never transmitted; Bob holds this locally).
- `pk_A` (Alice's public key; retrieved from the API).
- `capsule` and `encrypted_dek` (from the database via the API).
- `[cfrag_1, cfrag_2]` (from the proxy workers via the API).

Bob then calls `decrypt_reencrypted(...)` to obtain the DEK and decrypts the AES ciphertext.

---

## Data Flow Table

| Step | From | To | Data | Encrypted? |
|---|---|---|---|---|
| 1 | Alice | API | Sensor JSON payload + pk_A | No (local call) |
| 2 | API | Storage | AES ciphertext + nonce | Yes (AES-256-GCM) |
| 3 | API | DB | capsule_b64, enc_DEK_b64, file metadata | Capsule/DEK encrypted |
| 4 | Alice | API | grant request (file_id, bob_pk) | Transport (HTTPS in prod) |
| 5 | API | DB | kfrags_b64_json (3 kfrags) | kfrags are sensitive but not encrypted at rest |
| 6 | API | Proxy_i | capsule_b64, kfrag_i_b64 | Transport only |
| 7 | Proxy_i | API | cfrag_i_b64 | Transport only |
| 8 | API | DB | cfrag records in ProxyOperations | Stored as b64 |
| 9 | API | Bob | capsule_b64, enc_DEK_b64, [cfrag_1, cfrag_2] | As stored |
| 10 | Bob (local) | — | DEK (after decrypt_reencrypted) | Never transmitted |
| 11 | Bob (local) | — | Sensor plaintext (after AES decrypt) | Never transmitted |

---

## Security Properties Guaranteed

| Property | Mechanism | Guarantee |
|---|---|---|
| **Payload Confidentiality** | AES-256-GCM | Cloud and proxy see only ciphertext |
| **DEK Confidentiality** | Umbral ECIES | Proxy sees only capsule; cannot derive DEK |
| **Integrity** | GCM authentication tag | Any ciphertext modification detected at decryption |
| **Proxy Non-decryptability** | Threshold (t=2, n=3): 1 kfrag insufficient | No single proxy can re-encrypt |
| **Delegation Authenticity** | kfrag signed by Alice's signing key | Proxy verifies kfrag is from Alice |
| **Unidirectionality** | AFGH scheme property | `rk_{A→B}` cannot compute `rk_{B→A}` |
| **Collusion Safety** | AFGH scheme proof | `rk_{A→B}` + `sk_B` does not reveal `sk_A` |
| **Unauthorized Access Denial** | Grant status check before re-encryption | Charlie (no grant) gets 403 |
| **Audit Trail** | Immutable AuditLog table | Every access event is recorded |
| **Revocation** | Grant status set to `revoked` | No new cfrags generated post-revocation |
