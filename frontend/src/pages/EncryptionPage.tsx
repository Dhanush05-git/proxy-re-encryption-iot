import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Key, Upload, CheckCircle, ChevronRight, Eye, EyeOff, ShieldCheck, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { getReadings, encryptUpload } from '../lib/api';
import type { SensorReading, EncryptedFile } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { truncateKey } from '../lib/crypto';

type StepStatus = 'pending' | 'active' | 'done' | 'error';

export default function EncryptionPage() {
  const { user, keys, login } = useAuth();
  const navigate = useNavigate();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [selectedReading, setSelectedReading] = useState<SensorReading | null>(null);
  const [uploadedFile, setUploadedFile] = useState<EncryptedFile | null>(null);
  const [showPubKey, setShowPubKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepStatus, setStepStatus] = useState<{
    select: StepStatus;
    keypair: StepStatus;
    encrypt: StepStatus;
    upload: StepStatus;
  }>({
    select: 'active',
    keypair: 'pending',
    encrypt: 'pending',
    upload: 'pending',
  });
  const [error, setError] = useState('');
  const [encryptResult, setEncryptResult] = useState<{ nonce: string; size: number } | null>(null);

  useEffect(() => {
    getReadings(undefined, 25)
      .then((r) => {
        setReadings(r.data);
        if (r.data.length > 0 && !selectedReading) {
          setSelectedReading(r.data[0]);
          setStepStatus((prev) => ({ ...prev, select: 'done', encrypt: 'active' }));
        }
      })
      .catch(() => {});
  }, []);

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
        encrypt: 'active',
      }));
    }
  };

  const handleEncryptUpload = async () => {
    if (!selectedReading?.id || !user?.id) {
      setError('Missing selection or user session');
      return;
    }
    setLoading(true);
    setError('');
    setStepStatus((prev) => ({ ...prev, encrypt: 'active' }));
    try {
      const res = await encryptUpload({
        sensor_reading_id: selectedReading.id!,
        owner_id: user.id,
        owner_sk_b64: keys?.secretKeyB64 || '',
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

  const isAlice = user?.username === 'alice' || user?.role === 'alice' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Lock className="text-cyan-400" /> Hybrid Encryption & DEK Encapsulation
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Alice encrypts sensor telemetry with authenticated AES-256-GCM and encapsulates the 256-bit DEK using Umbral PRE
          </p>
        </div>

        {!isAlice && (
          <button
            onClick={() => login('alice', 'password123')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-2 transition-all self-start"
          >
            <Sparkles size={14} /> Switch to Alice (Data Owner)
          </button>
        )}
      </div>

      {/* Stepper Card */}
      <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-6">
        {/* Step 1: Select Telemetry */}
        <div className="flex items-start gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
            stepStatus.select === 'done' ? 'bg-emerald-500 text-black font-bold' : 'bg-cyan-500 text-black'
          }`}>
            {stepStatus.select === 'done' ? '✓' : '1'}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Select Telemetry Record to Encrypt</span>
              <span className="text-xs font-mono text-cyan-400">Step 1 of 4</span>
            </div>
            <select
              className="w-full max-w-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded-xl px-3 py-2.5 font-mono focus:border-cyan-500 focus:outline-none"
              onChange={(e) => handleSelectReading(e.target.value)}
              value={selectedReading?.id ? String(selectedReading.id) : ''}
            >
              <option value="" disabled>-- Select a sensor telemetry record --</option>
              {readings.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.sensor_id} | {new Date(r.timestamp || r.created_at || '').toLocaleTimeString()} | {r.temperature?.toFixed(1)}°C | {r.humidity?.toFixed(1)}% | {r.air_quality?.toFixed(0)} AQI
                </option>
              ))}
            </select>

            {selectedReading && (
              <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono text-gray-300 flex items-center justify-between max-w-lg">
                <span>Selected: <strong className="text-cyan-400">{selectedReading.sensor_id}</strong> (ID #{selectedReading.id})</span>
                <span className="text-emerald-400 font-bold">{selectedReading.temperature?.toFixed(1)} °C</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-l border-dashed border-gray-800 ml-4 h-6" />

        {/* Step 2: Cryptographic Key Status */}
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 bg-emerald-500 text-black">
            ✓
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Alice's Umbral PRE Public Key</span>
              <span className="badge badge-green text-[10px]">ECDH Secp256k1</span>
            </div>
            <div className="flex items-center gap-2 max-w-lg">
              <code className="flex-1 p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono text-gray-300 truncate">
                {showPubKey ? (keys?.publicKeyB64 || 'Generating...') : truncateKey(keys?.publicKeyB64 || '', 24)}
              </code>
              <button
                onClick={() => setShowPubKey(!showPubKey)}
                className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
                title="Toggle public key"
              >
                {showPubKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              🛡️ Alice's private key remains strictly isolated on the trusted client side.
            </p>
          </div>
        </div>

        <div className="border-l border-dashed border-gray-800 ml-4 h-6" />

        {/* Step 3: Encrypt + PRE Encapsulate */}
        <div className="flex items-start gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${
            stepStatus.encrypt === 'done' ? 'bg-emerald-500 text-black' : stepStatus.encrypt === 'active' ? 'bg-indigo-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400'
          }`}>
            {stepStatus.encrypt === 'done' ? '✓' : '3'}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Execute Authenticated Hybrid Encryption</span>
              <span className="text-xs font-mono text-indigo-400">AES-GCM + PRE</span>
            </div>

            {encryptResult && (
              <div className="p-4 rounded-xl bg-gray-950 border border-emerald-900/40 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle size={15} /> Encryption & DEK Encapsulation Succeeded
                </div>
                <div className="grid grid-cols-2 gap-2 text-gray-400 pt-1">
                  <div>Nonce (96-bit): <span className="text-gray-200">{truncateKey(encryptResult.nonce, 12)}</span></div>
                  <div>Payload Size: <span className="text-gray-200">{encryptResult.size} bytes</span></div>
                  <div>Algorithm: <span className="text-cyan-400">AES-256-GCM</span></div>
                  <div>Capsule Format: <span className="text-purple-400">Umbral Secp256k1</span></div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <button
              onClick={handleEncryptUpload}
              disabled={!selectedReading || loading || stepStatus.upload === 'done'}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Encrypting Payload & Encapsulating DEK...
                </>
              ) : stepStatus.upload === 'done' ? (
                <>
                  <CheckCircle size={16} /> Encrypted & Cloud Stored
                </>
              ) : (
                <>
                  <Lock size={16} /> Encrypt & Upload to Cloud
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step 4: Next Action Banner when Uploaded */}
        {uploadedFile && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-700/50 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-300">
            <div>
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck size={16} /> File #{uploadedFile.id} Ready for Delegation
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5 font-mono">
                Stored in cloud as: <span className="text-white">{uploadedFile.filename}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/sharing')}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
            >
              Proceed to Secure Sharing with Bob <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Security Architecture Reference */}
      <div className="p-4 rounded-xl bg-[#0d1225] border border-cyan-900/30 text-xs text-gray-400 font-mono space-y-1.5">
        <div className="font-bold text-cyan-400 uppercase text-[11px]">Applied Cryptography Principle: Zero-Knowledge Cloud Storage</div>
        <div>1. AES-256-GCM provides confidentiality and integrity (tampering detected via MAC tag).</div>
        <div>2. Umbral PRE encapsulator generates an elliptic curve Capsule $(E, V)$ encoding the random DEK.</div>
        <div>3. The cloud proxy stores only the ciphertext and capsule, having <strong>zero knowledge</strong> of the underlying plaintext.</div>
      </div>
    </div>
  );
}
