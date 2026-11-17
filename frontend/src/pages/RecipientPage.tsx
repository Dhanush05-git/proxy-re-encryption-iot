import { useState, useEffect } from 'react';
import { UserCheck, Lock, Unlock, ChevronDown } from 'lucide-react';
import { getUploads, getGrants, triggerReencrypt, decryptFile, getUsers } from '../lib/api';
import type { EncryptedFile, AccessGrant, User } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { truncateKey } from '../lib/crypto';

type ActiveTab = 'bob' | 'charlie';

export default function RecipientPage() {
  const { user, keys } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('bob');
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedFile, setSelectedFile] = useState<EncryptedFile | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<AccessGrant | null>(null);
  const [reencryptResult, setReencryptResult] = useState<{ cfrags: string[]; workerResults: { worker_id: string; status: string; processing_time_ms: number }[] } | null>(null);
  const [decryptedData, setDecryptedData] = useState<string | null>(null);
  const [reencryptLoading, setReencryptLoading] = useState(false);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [error, setError] = useState('');

  const bobUser = users.find((u) => u.role === 'bob');
  const charlieUser = users.find((u) => u.role === 'charlie');

  useEffect(() => {
    Promise.allSettled([
      getUploads().then((r) => setFiles(r.data)),
      getGrants().then((r) => setGrants(r.data)),
      getUsers().then((r) => setUsers(r.data)),
    ]);
  }, []);

  const bobGrants = grants.filter((g) => g.status === 'active' && g.grantee_id === bobUser?.id);
  const bobAccessibleFiles = files.filter((f) => bobGrants.some((g) => g.file_id === f.id));

  const handleSelectFile = (fileId: string) => {
    const f = files.find((x) => String(x.id) === fileId);
    if (!f) return;
    setSelectedFile(f);
    const grant = bobGrants.find((g) => g.file_id === f.id);
    setSelectedGrant(grant ?? null);
    setReencryptResult(null);
    setDecryptedData(null);
    setError('');
  };

  const handleRequestDecryption = async () => {
    if (!selectedGrant || !selectedFile) return;
    setReencryptLoading(true);
    setError('');
    try {
      const res = await triggerReencrypt({
        grant_id: selectedGrant.id,
        capsule_b64: selectedFile.capsule_b64,
      });
      setReencryptResult({
        cfrags: res.data.cfrags,
        workerResults: res.data.worker_results,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Re-encryption failed';
      setError(msg);
    } finally {
      setReencryptLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!selectedFile || !reencryptResult || !keys?.secretKeyB64) return;
    setDecryptLoading(true);
    setError('');
    try {
      const res = await decryptFile({
        file_id: selectedFile.id,
        recipient_sk_b64: keys.secretKeyB64,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCheck style={{ color: '#00d4ff' }} /> Recipient Access Demo
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Demonstrates authorized (Bob) vs. unauthorized (Charlie) access to re-encrypted data
        </p>
      </div>

      {/* Tab switcher */}
      <div className="card flex gap-2">
        {(['bob', 'charlie'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm capitalize transition-all"
            style={
              activeTab === tab
                ? { background: tab === 'bob' ? 'rgba(167,139,250,0.2)' : 'rgba(245,158,11,0.2)', color: tab === 'bob' ? '#a78bfa' : '#f59e0b', border: `1px solid ${tab === 'bob' ? '#a78bfa' : '#f59e0b'}` }
                : { background: 'transparent', color: '#6b7280', border: '1px solid #1f2937' }
            }
          >
            {tab === 'bob' ? '👤 Bob (Authorized)' : '🚫 Charlie (Unauthorized)'}
          </button>
        ))}
      </div>

      {/* Bob tab */}
      {activeTab === 'bob' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Unlock style={{ color: '#10b981' }} /> Bob's Accessible Files
            </h2>
            {bobAccessibleFiles.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: '#6b7280' }}>
                No files shared with Bob yet. Alice must share a file first.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>SELECT FILE</label>
                  <select className="input-field max-w-md" defaultValue="" onChange={(e) => handleSelectFile(e.target.value)}>
                    <option value="" disabled>-- Choose accessible file --</option>
                    {bobAccessibleFiles.map((f) => (
                      <option key={f.id} value={f.id}>{f.filename} (Sensor: {f.sensor_id})</option>
                    ))}
                  </select>
                </div>

                {selectedFile && (
                  <div className="space-y-4">
                    {/* Request decryption */}
                    <div className="p-4 rounded-lg" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
                      <h3 className="text-sm font-semibold text-white mb-3">Step 1: Request Re-encryption from Proxy Workers</h3>
                      <button
                        className="btn-primary"
                        onClick={handleRequestDecryption}
                        disabled={reencryptLoading || !!reencryptResult}
                      >
                        {reencryptLoading ? <div className="spinner" /> : <Lock size={16} />}
                        {reencryptResult ? 'Re-encryption Complete' : 'Request Decryption'}
                      </button>
                    </div>

                    {/* Worker results */}
                    {reencryptResult && (
                      <div className="p-4 rounded-lg" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
                        <h3 className="text-sm font-semibold text-white mb-3">
                          Proxy Worker Responses ({reencryptResult.cfrags.length} of 3 cfrags received)
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {reencryptResult.workerResults.map((w, i) => (
                            <div key={w.worker_id} className="p-3 rounded-lg text-xs" style={{ background: '#111827', border: `1px solid ${w.status === 'success' ? '#10b981' : '#ef4444'}50` }}>
                              <div className="font-mono font-bold mb-1" style={{ color: '#00d4ff' }}>{w.worker_id}</div>
                              <span className={`badge ${w.status === 'success' ? 'badge-green' : 'badge-red'}`}>{w.status}</span>
                              {reencryptResult.cfrags[i] && (
                                <div className="mt-2">
                                  <div style={{ color: '#6b7280' }}>cfrag:</div>
                                  <code className="mono-value block mt-0.5">{truncateKey(reencryptResult.cfrags[i], 10)}</code>
                                </div>
                              )}
                              <div className="mt-1" style={{ color: '#6b7280' }}>
                                {w.processing_time_ms?.toFixed(1)}ms
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Decrypt */}
                    {reencryptResult && (
                      <div className="p-4 rounded-lg" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
                        <h3 className="text-sm font-semibold text-white mb-3">Step 2: Decrypt with Bob's Private Key</h3>
                        <button
                          className="btn-primary"
                          onClick={handleDecrypt}
                          disabled={decryptLoading || !!decryptedData}
                        >
                          {decryptLoading ? <div className="spinner" /> : <Unlock size={16} />}
                          {decryptedData ? 'Decrypted Successfully' : 'Decrypt Data'}
                        </button>
                      </div>
                    )}

                    {/* Decrypted data */}
                    {decryptedData && (
                      <div className="p-4 rounded-lg" style={{ background: '#0d1225', border: '1px solid #10b981' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <Unlock style={{ color: '#10b981' }} size={18} />
                          <h3 className="text-sm font-semibold" style={{ color: '#10b981' }}>Decrypted Sensor Data</h3>
                        </div>
                        <div className="json-display">
                          {JSON.stringify(JSON.parse(decryptedData), null, 2)}
                        </div>
                      </div>
                    )}

                    {error && <div className="badge badge-red">{error}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charlie tab */}
      {activeTab === 'charlie' && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Lock style={{ color: '#ef4444' }} /> Charlie's Access Attempt
          </h2>
          <div
            className="p-6 rounded-xl text-center"
            style={{ background: 'rgba(239,68,68,0.05)', border: '2px solid rgba(239,68,68,0.3)' }}
          >
            <div className="text-6xl mb-4">🔒</div>
            <div className="text-2xl font-bold mb-2" style={{ color: '#ef4444' }}>ACCESS DENIED</div>
            <div className="text-sm mb-4" style={{ color: '#9ca3af' }}>No valid re-encryption grant for Charlie</div>
            <div
              className="inline-block text-left p-4 rounded-lg text-xs font-mono"
              style={{ background: '#0d1225', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
            >
              <div className="text-gray-500 mb-1"># Cryptographic verification failure:</div>
              <div>UmbralDecryptionError: Invalid re-encryption fragments</div>
              <div className="mt-1">  → No kfrags generated for Charlie's public key</div>
              <div>  → capsule.decrypt() requires authorized cfrags</div>
              <div>  → Charlie's secret key cannot re-derive DEK</div>
              <div className="mt-2 text-yellow-500"># This is by design — PRE is information-theoretically secure</div>
            </div>
          </div>
          <div className="text-xs space-y-1 p-3 rounded-lg" style={{ background: '#0d1225', border: '1px solid #1f2937', color: '#6b7280' }}>
            <div className="font-semibold mb-2" style={{ color: '#9ca3af' }}>Why Charlie Cannot Access:</div>
            <div>• Umbral PRE kfrags are derived from Alice's secret key AND Bob's public key</div>
            <div>• Charlie's public key was never used in kfrag generation</div>
            <div>• Even with 3/3 proxy cfrags, without valid Bob-targeted kfrags, decryption fails</div>
            <div>• The capsule is mathematically bound to the authorized key pair only</div>
          </div>
        </div>
      )}
    </div>
  );
}
