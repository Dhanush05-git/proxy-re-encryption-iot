import { useState, useEffect } from 'react';
import { Lock, Key, Upload, CheckCircle, Circle, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { getReadings, encryptUpload, generateKeyPair } from '../lib/api';
import type { SensorReading, EncryptedFile } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { truncateKey } from '../lib/crypto';

type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface StepState {
  select: StepStatus;
  keypair: StepStatus;
  encrypt: StepStatus;
  upload: StepStatus;
}

export default function EncryptionPage() {
  const { user, keys } = useAuth();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [selectedReading, setSelectedReading] = useState<SensorReading | null>(null);
  const [uploadedFile, setUploadedFile] = useState<EncryptedFile | null>(null);
  const [showPubKey, setShowPubKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepStatus, setStepStatus] = useState<StepState>({
    select: 'active',
    keypair: 'pending',
    encrypt: 'pending',
    upload: 'pending',
  });
  const [error, setError] = useState('');
  const [encryptResult, setEncryptResult] = useState<{ nonce: string; size: number } | null>(null);

  useEffect(() => {
    getReadings(undefined, 20)
      .then((r) => setReadings(r.data))
      .catch(() => {});
  }, []);

  // Auto-advance to keypair step
  useEffect(() => {
    if (keys?.publicKeyB64) {
      setStepStatus((prev) => ({ ...prev, keypair: 'done' }));
    }
  }, [keys]);

  const handleSelectReading = (id: string) => {
    const r = readings.find((x) => String(x.id) === id);
    if (r) {
      setSelectedReading(r);
      setStepStatus((prev) => ({
        ...prev,
        select: 'done',
        keypair: keys?.publicKeyB64 ? 'done' : 'active',
        encrypt: keys?.publicKeyB64 ? 'active' : 'pending',
      }));
    }
  };

  const handleEncryptUpload = async () => {
    if (!selectedReading?.id || !user?.id || !keys?.secretKeyB64) {
      setError('Missing selection or keys');
      return;
    }
    setLoading(true);
    setError('');
    setStepStatus((prev) => ({ ...prev, encrypt: 'active' }));
    try {
      const res = await encryptUpload({
        sensor_reading_id: selectedReading.id!,
        owner_id: user.id,
        owner_sk_b64: keys.secretKeyB64,
      });
      setUploadedFile(res.data);
      setEncryptResult({ nonce: res.data.nonce_b64, size: res.data.file_size });
      setStepStatus({ select: 'done', keypair: 'done', encrypt: 'done', upload: 'done' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Encryption failed';
      setError(msg);
      setStepStatus((prev) => ({ ...prev, encrypt: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  const getStepNum = (status: StepStatus, num: number) => {
    if (status === 'done') return <CheckCircle size={18} style={{ color: '#10b981' }} />;
    if (status === 'error') return <span style={{ color: '#ef4444' }}>✗</span>;
    if (status === 'active') return <span style={{ color: '#00d4ff', fontWeight: 700 }}>{num}</span>;
    return <span style={{ color: '#6b7280' }}>{num}</span>;
  };

  if (user?.role !== 'alice' && user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Lock size={48} style={{ color: '#ef4444' }} className="mx-auto mb-3" />
          <div className="text-xl font-bold text-white">Access Restricted</div>
          <div className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Only Alice (data owner) can encrypt sensor data
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Lock style={{ color: '#00d4ff' }} /> Data Encryption Workflow
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Encrypt IoT sensor data with AES-256-GCM and encapsulate DEK using Umbral PRE
        </p>
      </div>

      {/* Stepper */}
      <div className="card space-y-6">
        {/* Step 1: Select */}
        <div className="step-item">
          <div className="step-num" style={{
            background: stepStatus.select === 'done' ? '#10b981' : stepStatus.select === 'active' ? '#00d4ff' : '#1f2937',
            color: stepStatus.select === 'pending' ? '#6b7280' : '#0a0e1a'
          }}>
            {stepStatus.select === 'done' ? '✓' : '1'}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-1">Select Sensor Reading</div>
            <select
              className="input-field max-w-sm"
              onChange={(e) => handleSelectReading(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>-- Choose a reading --</option>
              {readings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.sensor_id} — {new Date(r.timestamp).toLocaleString()} — {r.temperature?.toFixed(1)}°C
                </option>
              ))}
            </select>
            {readings.length === 0 && (
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                No readings available. Go to Sensors and generate some first.
              </p>
            )}
          </div>
        </div>

        <div style={{ borderLeft: '1px dashed #1f2937', marginLeft: '15px', height: 20 }} />

        {/* Step 2: Keypair */}
        <div className="step-item">
          <div className="step-num" style={{
            background: stepStatus.keypair === 'done' ? '#10b981' : stepStatus.keypair === 'active' ? '#00d4ff' : '#1f2937',
            color: stepStatus.keypair === 'pending' ? '#6b7280' : '#0a0e1a'
          }}>
            {stepStatus.keypair === 'done' ? '✓' : '2'}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-1">Cryptographic Key Pair</div>
            {keys?.publicKeyB64 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="badge badge-green">Key Pair Ready</span>
                  <span className="badge badge-cyan">Umbral PRE</span>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: '#6b7280' }}>PUBLIC KEY</div>
                  <div className="flex items-center gap-2">
                    <code className="mono-value flex-1">
                      {showPubKey ? keys.publicKeyB64 : truncateKey(keys.publicKeyB64)}
                    </code>
                    <button onClick={() => setShowPubKey(!showPubKey)} style={{ color: '#6b7280' }}>
                      {showPubKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="text-xs" style={{ color: '#6b7280' }}>
                  <Key size={12} className="inline mr-1" />
                  Private key is stored securely and never transmitted
                </div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: '#6b7280' }}>Register with the system to generate a key pair</div>
            )}
          </div>
        </div>

        <div style={{ borderLeft: '1px dashed #1f2937', marginLeft: '15px', height: 20 }} />

        {/* Step 3: Encrypt + Upload */}
        <div className="step-item">
          <div className="step-num" style={{
            background: stepStatus.encrypt === 'done' ? '#10b981' : stepStatus.encrypt === 'active' ? '#00d4ff' : stepStatus.encrypt === 'error' ? '#ef4444' : '#1f2937',
            color: stepStatus.encrypt === 'pending' ? '#6b7280' : '#0a0e1a'
          }}>
            {stepStatus.encrypt === 'done' ? '✓' : stepStatus.encrypt === 'error' ? '✗' : '3'}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-2">Encrypt & PRE Encapsulate DEK</div>
            {selectedReading && (
              <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
                <div className="text-gray-400 mb-1">Selected data:</div>
                <code className="text-green-400">
                  {JSON.stringify({
                    sensor_id: selectedReading.sensor_id,
                    temperature: selectedReading.temperature,
                    humidity: selectedReading.humidity,
                    timestamp: selectedReading.timestamp,
                  }, null, 2)}
                </code>
              </div>
            )}
            {encryptResult && (
              <div className="mb-3 space-y-2">
                <div className="flex gap-3 flex-wrap">
                  <span className="badge badge-green">AES-256-GCM ✓</span>
                  <span className="badge badge-cyan">PRE Capsule ✓</span>
                  <span className="badge badge-purple">Uploaded ✓</span>
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span style={{ color: '#6b7280' }}>Nonce: </span>
                    <code className="mono-value">{truncateKey(encryptResult.nonce, 16)}</code>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>File size: </span>
                    <span style={{ color: '#10b981' }}>{encryptResult.size} bytes</span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="mb-3 badge badge-red">{error}</div>
            )}
            <button
              className="btn-primary"
              onClick={handleEncryptUpload}
              disabled={!selectedReading || !keys?.secretKeyB64 || loading || stepStatus.upload === 'done'}
            >
              {loading ? <div className="spinner" /> : <Lock size={16} />}
              {stepStatus.upload === 'done' ? 'Encrypted & Uploaded' : 'Encrypt + Upload to Cloud'}
            </button>
          </div>
        </div>

        <div style={{ borderLeft: '1px dashed #1f2937', marginLeft: '15px', height: 20 }} />

        {/* Step 4: Done */}
        <div className="step-item">
          <div className="step-num" style={{
            background: stepStatus.upload === 'done' ? '#10b981' : '#1f2937',
            color: stepStatus.upload === 'done' ? '#0a0e1a' : '#6b7280'
          }}>
            {stepStatus.upload === 'done' ? '✓' : '4'}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white mb-1">Stored in Cloud</div>
            {uploadedFile ? (
              <div className="space-y-2">
                <div className="badge badge-green">Successfully uploaded</div>
                <div className="text-xs space-y-1">
                  <div><span style={{ color: '#6b7280' }}>File: </span><span style={{ color: '#fff' }}>{uploadedFile.filename}</span></div>
                  <div><span style={{ color: '#6b7280' }}>Capsule: </span><code className="mono-value">{truncateKey(uploadedFile.capsule_b64, 20)}</code></div>
                </div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: '#6b7280' }}>Awaiting encryption…</div>
            )}
          </div>
        </div>
      </div>

      {/* Security notice */}
      <div className="card" style={{ border: '1px solid rgba(0,212,255,0.2)' }}>
        <div className="text-xs space-y-1" style={{ color: '#6b7280' }}>
          <div className="font-semibold mb-2" style={{ color: '#00d4ff' }}>Security Model</div>
          <div>• DEK (Data Encryption Key) generated randomly per file — never reused</div>
          <div>• DEK encrypted using Umbral PRE capsule (Alice's public key)</div>
          <div>• Only Alice (or authorized recipients via PRE) can recover the DEK</div>
          <div>• File content encrypted with AES-256-GCM using the DEK</div>
          <div>• ⚠️ Demo: private key transmitted to backend for PRE ops. Production: keys stay client-side.</div>
        </div>
      </div>
    </div>
  );
}
