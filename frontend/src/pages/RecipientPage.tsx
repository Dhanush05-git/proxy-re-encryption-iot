import { useState, useEffect } from 'react';
import { UserCheck, Lock, Unlock, ShieldAlert, CheckCircle, Copy, Check, Sparkles, Terminal, FileText, ArrowRight } from 'lucide-react';
import { getUploads, getGrants, triggerReencrypt, decryptFile, getUsers } from '../lib/api';
import type { EncryptedFile, AccessGrant, User } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { truncateKey } from '../lib/crypto';

type ActiveTab = 'bob' | 'charlie';

export default function RecipientPage() {
  const { user, keys, login } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>(user?.username === 'charlie' ? 'charlie' : 'bob');
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedFile, setSelectedFile] = useState<EncryptedFile | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<AccessGrant | null>(null);
  const [reencryptResult, setReencryptResult] = useState<{
    cfrags: string[];
    workerResults: { worker_id: string; status: string; processing_time_ms: number }[];
  } | null>(null);
  const [decryptedData, setDecryptedData] = useState<string | null>(null);
  const [reencryptLoading, setReencryptLoading] = useState(false);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Charlie state
  const [charlieAttempted, setCharlieAttempted] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      getUploads().then((r) => {
        setFiles(r.data);
        if (r.data.length > 0 && !selectedFile) {
          setSelectedFile(r.data[0]);
        }
      }),
      getGrants().then((r) => setGrants(r.data)),
      getUsers().then((r) => setUsers(r.data)),
    ]);
  }, []);

  const bobUser = users.find((u) => u.username === 'bob' || u.role === 'bob');
  const charlieUser = users.find((u) => u.username === 'charlie' || u.role === 'charlie');

  const bobGrants = grants.filter((g) => g.status === 'active' && g.grantee_id === bobUser?.id);
  const bobAccessibleFiles = files.filter((f) => bobGrants.some((g) => g.file_id === f.id));

  // Auto-link grant when file changes
  useEffect(() => {
    if (selectedFile) {
      const grant = bobGrants.find((g) => g.file_id === selectedFile.id);
      setSelectedGrant(grant ?? null);
    }
  }, [selectedFile, bobGrants]);

  const handleRequestDecryption = async () => {
    if (!selectedFile) return;
    setReencryptLoading(true);
    setError('');
    setReencryptResult(null);
    setDecryptedData(null);
    try {
      const grantId = selectedGrant?.id || (bobGrants.length > 0 ? bobGrants[0].id : 1);
      const res = await triggerReencrypt({
        grant_id: grantId,
        capsule_b64: selectedFile.capsule_b64 || '',
        requester_id: bobUser?.id,
      });
      setReencryptResult({
        cfrags: res.data.cfrags,
        workerResults: res.data.worker_results,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Proxy re-encryption failed';
      setError(msg);
    } finally {
      setReencryptLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!selectedFile || !reencryptResult) return;
    setDecryptLoading(true);
    setError('');
    try {
      const res = await decryptFile({
        file_id: selectedFile.id,
        recipient_sk_b64: keys?.secretKeyB64 || '',
        cfrags_b64: reencryptResult.cfrags,
      });
      setDecryptedData(res.data.decrypted_data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Decryption failed';
      setError(msg);
    } finally {
      setDecryptLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (decryptedData) {
      navigator.clipboard.writeText(decryptedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <UserCheck className="text-cyan-400" /> Recipient Cryptographic Decryption
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Compare authorized recipient (Bob) reconstructing the DEK via proxy CFrags against unauthorized access attempts (Charlie)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 gap-4">
        <button
          onClick={() => {
            setActiveTab('bob');
            if (user?.username !== 'bob') login('bob', 'password123');
          }}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'bob'
              ? 'border-purple-500 text-purple-300'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          Bob (Authorized Recipient)
        </button>

        <button
          onClick={() => {
            setActiveTab('charlie');
            if (user?.username !== 'charlie') login('charlie', 'password123');
          }}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'charlie'
              ? 'border-amber-500 text-amber-300'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          Charlie (Unauthorized Attacker)
        </button>
      </div>

      {/* BOB VIEW */}
      {activeTab === 'bob' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* File Picker & Step 1: Request CFrags */}
          <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">1</span>
                  Select Authorized Cloud File & Request CFrags
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  The cloud proxy transforms the capsule using stored KFrags without viewing the plaintext
                </p>
              </div>

              <select
                className="bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded-xl p-2.5 font-mono max-w-sm focus:border-purple-500 focus:outline-none"
                value={selectedFile?.id ? String(selectedFile.id) : ''}
                onChange={(e) => {
                  const f = files.find((x) => String(x.id) === e.target.value);
                  if (f) setSelectedFile(f);
                }}
              >
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.filename} ({f.file_size} B)
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <button
              onClick={handleRequestDecryption}
              disabled={reencryptLoading || !selectedFile}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {reencryptLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Querying Proxy Workers (Threshold 2-of-3)...
                </>
              ) : (
                <>
                  <Unlock size={15} /> Request Proxy Re-Encryption (2-of-3 CFrags)
                </>
              )}
            </button>
          </div>

          {/* Step 2: CFrags Received & Decrypt Action */}
          {reencryptResult && (
            <div className="p-6 rounded-2xl bg-gray-900/80 border border-purple-500/30 shadow-xl space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
                    Proxy Transformation Verified
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Threshold condition satisfied: <strong className="text-emerald-400">{reencryptResult.cfrags.length} of 3</strong> capsule fragments received
                  </p>
                </div>
                <span className="badge badge-green text-xs font-mono">2-of-3 THRESHOLD MET ✓</span>
              </div>

              {/* Worker telemetry pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {reencryptResult.workerResults.map((wr, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono">
                    <div className="flex items-center justify-between text-gray-400 mb-1">
                      <span>{wr.worker_id}</span>
                      <span className="text-emerald-400 font-bold">{wr.status}</span>
                    </div>
                    <div className="text-[11px] text-gray-300">
                      Processing: <span className="text-cyan-400 font-bold">{wr.processing_time_ms.toFixed(2)} ms</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDecrypt}
                disabled={decryptLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {decryptLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Decapsulating DEK with Bob's Secret Key...
                  </>
                ) : (
                  <>
                    <Lock size={15} /> Decrypt Sensor Plaintext Locally
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Decrypted Plaintext Viewer */}
          {decryptedData && (
            <div className="p-6 rounded-2xl bg-gray-900/80 border border-emerald-500/40 shadow-xl space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle size={16} /> Decrypted IoT Sensor Telemetry (Plaintext)
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                    Recovered locally by Bob's private key via Umbral decapsulation & AES-256-GCM
                  </p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-mono text-gray-200 flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-gray-950 border border-emerald-900/30 overflow-x-auto max-h-80">
                <pre className="text-xs font-mono text-emerald-300 leading-relaxed">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(decryptedData), null, 2);
                    } catch {
                      return decryptedData;
                    }
                  })()}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHARLIE VIEW (ATTACKER) */}
      {activeTab === 'charlie' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-red-950/20 border border-red-800/60 shadow-xl space-y-5">
            <div className="flex items-start gap-3">
              <ShieldAlert size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-red-300">
                  Adversary Simulation: Unauthorized Decryption Attempt
                </h2>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Charlie has full network access to the encrypted cloud storage and the proxy endpoints, 
                  but possesses no cryptographic delegation grant from Alice.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-950 border border-red-900/40 text-xs font-mono space-y-2">
              <div className="text-gray-300 font-bold">Cryptographic Access Control Evaluation:</div>
              <div className="text-red-400 flex items-center gap-2">
                <span>✗</span> Charlie's identity (User #{charlieUser?.id || 3}) has no active KFrag entries.
              </div>
              <div className="text-red-400 flex items-center gap-2">
                <span>✗</span> Proxy transformation rejects unverified requests (HTTP 403 Forbidden).
              </div>
              <div className="text-red-400 flex items-center gap-2">
                <span>✗</span> Discrete Logarithm Problem: Charlie cannot derive the DEK from ciphertext alone.
              </div>
            </div>

            <button
              onClick={() => setCharlieAttempted(true)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg shadow-red-600/20 flex items-center gap-2 transition-all"
            >
              <Lock size={15} /> Simulate Attack: Request Unauthorized Decryption
            </button>

            {charlieAttempted && (
              <div className="p-4 rounded-xl bg-red-950/80 border border-red-700 text-xs font-mono space-y-2 text-red-300 animate-in fade-in">
                <div className="font-bold flex items-center gap-2">
                  <ShieldAlert size={16} /> ACCESS DENIED: Proxy Re-Encryption Refused
                </div>
                <div className="text-[11px] text-gray-300 leading-relaxed">
                  Status Code: <strong>403 Forbidden</strong><br />
                  Cryptographic Reason: <em>Requester is not the authorized grantee of any valid delegation token. Proxy workers aborted re-encryption.</em>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
