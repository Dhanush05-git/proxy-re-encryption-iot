# Demonstration Guide
## Proxy Re-Encryption for Secure IoT Cloud Data Sharing

---

## Pre-Demo Checklist

- [ ] Python 3.13+ installed
- [ ] Node.js 18+ installed
- [ ] `.venv` created and `umbral==0.3.0` installed
- [ ] Backend starts: `cd backend && ../.venv/bin/uvicorn app.main:app --port 8000`
- [ ] Frontend starts: `cd frontend && npm run dev`
- [ ] Browser open at `http://localhost:5173`
- [ ] Demo users seeded: alice / bob / charlie (password: `password123`)

---

## 15-Step Live Demonstration

### Step 1 — Alice Logs In
**Action:** Open `http://localhost:5173`, click Login, enter `alice` / `password123`.

**Show:** Alice's role badge, her PRE public key (truncated hex), dashboard statistics.

**Talking point:** "Alice represents the IoT data owner. Her private key was generated and stored locally. The backend only holds her public key."

---

### Step 2 — Sensor Data Generation
**Action:** Navigate to **Sensor Management** → click **Generate Batch (10 readings)**.

**Show:** Live table of sensor readings — temperature, humidity, air quality, pressure, energy consumption, timestamps, sensor IDs.

**Talking point:** "We simulate IoT devices in software. No physical hardware is needed. Each reading has realistic values generated with normal distribution."

---

### Step 3 — Encrypt Sensor Data (Alice)
**Action:** Navigate to **Encryption Dashboard** → select a sensor reading → click **Encrypt & Upload**.

**Show the 5-step workflow:**
1. ✅ Sensor data selected (shown as JSON)
2. ✅ AES-256-GCM key generated (32 random bytes, DEK — not shown)
3. ✅ Data encrypted (ciphertext displayed in hex/base64)
4. ✅ DEK encapsulated via PRE capsule (Umbral)
5. ✅ Encrypted file uploaded to cloud storage

**Talking point:** "The raw DEK is never stored. It is immediately encapsulated using Alice's public key through the Umbral PRE scheme. Only the capsule and encrypted DEK are stored server-side."

---

### Step 4 — View Cloud Storage
**Action:** Navigate to **Cloud Storage**.

**Show:** Encrypted file entry — filename, sensor ID, file size, upload time, `AES-256-GCM ✓` badge.

**Click Inspect Metadata:** Show the capsule_b64 (looks like random bytes), nonce, file size. No plaintext visible.

**Talking point:** "The cloud proxy stores only encrypted data. It cannot read the sensor values without the DEK, which it has never seen."

---

### Step 5 — Alice Grants Bob Access
**Action:** Navigate to **Secure Sharing** → Select Bob as recipient → Select the encrypted file → Set expiry (24 hours) → Click **Grant Access**.

**Show:**
- Bob's public key fetched from server
- 3 kfrags generated (2-of-3 threshold)
- Each kfrag distributed to PROXY_WORKER_1, PROXY_WORKER_2, PROXY_WORKER_3

**Talking point:** "Alice generates re-encryption key fragments using her private key and Bob's public key. Each fragment goes to a different proxy worker. Alice's private key NEVER leaves her client."

---

### Step 6 — Proxy Workers Process Re-Encryption
**Action:** Navigate to **Proxy Dashboard** → Click **Trigger Re-Encryption** for Bob's grant.

**Show all 3 proxy worker cards:**
- Worker 1: PROCESSING → DONE (cfrag_b64 shown, processing time ~2ms)
- Worker 2: PROCESSING → DONE
- Worker 3: PROCESSING → DONE

**Talking point:** "Each proxy worker independently re-encrypts the capsule using its kfrag. The result is a capsule fragment (cfrag) — transformed key material that only Bob can use with his private key."

---

### Step 7 — Bob Receives 2 Capsule Fragments (Threshold Met)
**Action:** Log in as **Bob** (password: `password123`) → Navigate to **Recipient Dashboard**.

**Show:** Bob's authorized files, the capsule fragments (2 of 3 collected), threshold indicator `2/3 ✓`.

**Talking point:** "Bob only needs 2 of the 3 proxy workers to respond. This is the 2-of-3 threshold scheme. Even if one proxy worker is offline, Bob can still decrypt."

---

### Step 8 — Bob Decrypts the Sensor Data
**Action:** Click **Decrypt Data** on the authorized file.

**Show:**
1. Bob sends his private key + cfrags to the backend decrypt endpoint
2. Backend verifies each cfrag cryptographically
3. DEK recovered via `decrypt_reencrypted()`
4. AES-256-GCM file decrypted
5. Original sensor JSON displayed in browser

**Talking point:** "Bob uses his private key and 2 valid cfrags to recover the DEK through the Umbral PRE decryption algorithm. He then decrypts the file with AES-256-GCM. At no point did Alice's private key or the raw DEK touch the cloud proxy."

---

### Step 9 — Charlie Attempts Unauthorized Access
**Action:** Log in as **Charlie** (password: `password123`) → Navigate to **Recipient Dashboard** → Charlie tab.

**Show:** "ACCESS DENIED — No valid grant" in red. API returns HTTP 403.

**Talking point:** "Charlie has no kfrags. Without them, the proxy cannot re-encrypt the capsule for Charlie. Even if Charlie intercepts the encrypted file, he cannot recover the DEK."

---

### Step 10 — Tamper Attack Demonstration
**Action:** Navigate to **Security Tests** → Click **Run All Security Tests** → Highlight **AES-GCM Tamper Detection**.

**Show:** The test flips one byte in the ciphertext. AES-GCM authentication fails. Result: `PASS (tamper correctly detected)`.

**Talking point:** "AES-256-GCM provides authenticated encryption. Any modification to the ciphertext — even a single bit flip — causes decryption to fail with an authentication tag mismatch."

---

### Step 11 — Threshold Failure Demonstration
**Action:** In **Security Tests** → Highlight **PRE Threshold Fail (1-of-3)** test.

**Show:** Test attempts decryption with only 1 cfrag. Result: `PASS (threshold not met, decryption failed)`.

**Talking point:** "With a 2-of-3 threshold, one cfrag alone is not sufficient to recover the DEK. This prevents a single compromised proxy from leaking data."

---

### Step 12 — Wrong Key Rejection
**Action:** In **Security Tests** → Highlight **PRE Wrong Receiver Key** test.

**Show:** Test uses Charlie's private key to decrypt Bob's cfrags. Result: `PASS (wrong receiver correctly rejected)`.

**Talking point:** "The cfrags are mathematically bound to Bob's public key. Only Bob's corresponding private key can recover the DEK."

---

### Step 13 — Access Revocation
**Action:** Log in as Alice → Navigate to **Secure Sharing** → Find Bob's active grant → Click **Revoke**.

**Show:** Grant status changes to `revoked`. Proxy refuses future re-encryption requests for this grant.

**Talking point:** "Revocation prevents the proxy from processing future re-encryption requests. However, cfrags already issued remain valid — this is a known limitation. Full revocation requires re-encrypting the data with a new DEK."

---

### Step 14 — Security Test Results
**Action:** Navigate to **Security Tests** → Click **Run All Security Tests**.

**Show the full results table (9/9 PASS):**
| Test | Result |
|------|--------|
| AES-256-GCM Round-Trip | ✅ PASS |
| AES Wrong Key Rejection | ✅ PASS |
| AES-GCM Tamper Detection | ✅ PASS |
| PRE Full Workflow | ✅ PASS |
| PRE Threshold Pass (2-of-3) | ✅ PASS |
| PRE Threshold Fail (1-of-3) | ✅ PASS |
| PRE Wrong Receiver Key | ✅ PASS |
| PRE Original Owner Decryption | ✅ PASS |
| PRE Revocation Enforcement | ✅ PASS |

---

### Step 15 — Performance Benchmarks
**Action:** Navigate to **Performance** → Click **Run Benchmark**.

**Show:**
- Key generation time (~1ms)
- AES encryption vs file size (linear, ~1ms/MB)
- PRE encapsulation (constant ~2ms regardless of file size — only 32 bytes!)
- kfrag generation (~3ms)
- Proxy re-encryption per worker (~1ms)
- DEK recovery time (~1ms)
- AES decryption vs file size (linear)

**Talking point:** "The core insight is that PRE only re-encrypts the 32-byte DEK, not the actual file. PRE processing time is constant regardless of file size. This makes PRE ideal for large IoT datasets."

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Backend won't start | Run `.venv/bin/pip install bcrypt==4.0.1` |
| `ModuleNotFoundError: umbral` | Run `.venv/bin/pip install umbral` |
| Frontend build fails | Run `npm install` in `frontend/` |
| DB locked error | Delete `backend/pre_iot.db` and restart |
| Port 8000 in use | `lsof -ti:8000 \| xargs kill` |
| CORS error in browser | Ensure backend runs on port 8000 |

---

## Key Academic Points to Emphasize

1. **PRE is not ordinary re-encryption** — Alice never downloads and re-encrypts the file.
2. **The proxy is semi-trusted** — it can transform ciphertext but cannot read plaintext.
3. **Hybrid encryption** — AES-256-GCM for the data, PRE for the key.
4. **Threshold cryptography** — single-point-of-failure avoidance.
5. **Forward secrecy limitation** — revocation does not invalidate already-issued cfrags.
6. **This is an academic demo** — production systems would add HSM key storage, TLS, audit trails, and hardware-bound key protection.
