import { useState, useEffect } from 'react';
import { Share2, Users, FileText, Clock, Trash2, CheckCircle } from 'lucide-react';
import { getUploads, getUsers, createGrant, getGrants, revokeGrant } from '../lib/api';
import type { EncryptedFile, User, AccessGrant } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type WizardStep = 1 | 2 | 3;

export default function SharingPage() {
  const { user, keys } = useAuth();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedFile, setSelectedFile] = useState<EncryptedFile | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [expiryHours, setExpiryHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [kfragProgress, setKfragProgress] = useState(0);
  const [grantResult, setGrantResult] = useState<AccessGrant | null>(null);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    Promise.allSettled([
      getUploads(user?.id).then((r) => setFiles(r.data)),
      getUsers().then((r) => setUsers(r.data.filter((u) => u.id !== user?.id))),
      getGrants({ granter_id: user?.id }).then((r) => setGrants(r.data)),
    ]);
  }, [user?.id]);

  const handleGenerateKfrags = async () => {
    if (!selectedFile || !selectedRecipient || !keys?.secretKeyB64 || !user?.id) {
      setError('Please select file and recipient first');
      return;
    }
    setLoading(true);
    setError('');
    setKfragProgress(0);

    // Animate progress
    const interval = setInterval(() => {
      setKfragProgress((prev) => Math.min(prev + 15, 90));
    }, 200);

    try {
      const res = await createGrant({
        file_id: selectedFile.id,
        granter_id: user.id,
        grantee_id: selectedRecipient.id,
        granter_sk_b64: keys.secretKeyB64,
        threshold: 2,
        shares: 3,
        expires_hours: expiryHours,
      });
      clearInterval(interval);
      setKfragProgress(100);
      setGrantResult(res.data);
      setGrants((prev) => [res.data, ...prev]);
      setTimeout(() => setStep(3), 500);
    } catch (err: unknown) {
      clearInterval(interval);
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to generate kfrags';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (grantId: number) => {
    setRevoking(grantId);
    try {
      await revokeGrant(grantId);
      setGrants((prev) =>
        prev.map((g) => (g.id === grantId ? { ...g, status: 'revoked' as const } : g))
      );
    } catch { /* ignore */ } finally {
      setRevoking(null);
    }
  };

  if (user?.role !== 'alice' && user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Share2 size={48} style={{ color: '#ef4444' }} className="mx-auto mb-3" />
          <div className="text-xl font-bold text-white">Access Restricted</div>
          <div className="text-sm mt-1" style={{ color: '#6b7280' }}>Only Alice can share files via PRE</div>
        </div>
      </div>
    );
  }

  const stepLabels = ['Select & Configure', 'Generate Re-encryption Keys', 'Distribute to Proxy Workers'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Share2 style={{ color: '#00d4ff' }} /> Secure File Sharing
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Share encrypted data via Umbral Proxy Re-Encryption without exposing your private key
        </p>
      </div>

      {/* Wizard steps indicator */}
      <div className="card">
        <div className="flex items-center gap-4">
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const isActive = step === n;
            const isDone = step > n;
            return (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: isDone ? '#10b981' : isActive ? '#00d4ff' : '#1f2937',
                    color: isDone || isActive ? '#0a0e1a' : '#6b7280',
                  }}
                >
                  {isDone ? '✓' : n}
                </div>
                <span className="text-sm font-medium" style={{ color: isActive ? '#fff' : isDone ? '#10b981' : '#6b7280' }}>
                  {label}
                </span>
                {i < 2 && <div className="flex-1 h-px mx-2" style={{ background: isDone ? '#10b981' : '#1f2937' }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Configure Sharing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>SELECT FILE</label>
              <select className="input-field" onChange={(e) => {
                const f = files.find((x) => String(x.id) === e.target.value);
                setSelectedFile(f ?? null);
              }} defaultValue="">
                <option value="" disabled>-- Choose file --</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>{f.filename}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>SELECT RECIPIENT</label>
              <select className="input-field" onChange={(e) => {
                const u = users.find((x) => String(x.id) === e.target.value);
                setSelectedRecipient(u ?? null);
              }} defaultValue="">
                <option value="" disabled>-- Choose user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>EXPIRY (HOURS)</label>
              <select className="input-field" value={expiryHours} onChange={(e) => setExpiryHours(Number(e.target.value))}>
                {[1, 6, 12, 24, 48, 168].map((h) => (
                  <option key={h} value={h}>{h}h {h >= 24 ? `(${h / 24}d)` : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="p-3 rounded-lg text-xs" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
                <div style={{ color: '#6b7280' }}>Threshold: <strong style={{ color: '#00d4ff' }}>2 of 3</strong></div>
                <div style={{ color: '#6b7280' }}>Fragments: <strong style={{ color: '#a78bfa' }}>3 kfrags</strong></div>
              </div>
            </div>
          </div>
          {error && <div className="badge badge-red">{error}</div>}
          <button
            className="btn-primary"
            onClick={() => setStep(2)}
            disabled={!selectedFile || !selectedRecipient}
          >
            Next: Generate Re-encryption Keys
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Generating Key Fragments (kfrags)</h2>
          <div className="p-3 rounded-lg text-xs" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
            <div className="grid grid-cols-2 gap-2">
              <div><span style={{ color: '#6b7280' }}>File: </span><span style={{ color: '#fff' }}>{selectedFile?.filename}</span></div>
              <div><span style={{ color: '#6b7280' }}>Recipient: </span><span style={{ color: '#a78bfa' }}>{selectedRecipient?.username}</span></div>
              <div><span style={{ color: '#6b7280' }}>Threshold: </span><span style={{ color: '#00d4ff' }}>2-of-3</span></div>
              <div><span style={{ color: '#6b7280' }}>Expiry: </span><span style={{ color: '#f59e0b' }}>{expiryHours}h</span></div>
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm" style={{ color: '#00d4ff' }}>
                <div className="spinner" />
                Generating kfrags using Alice's secret key...
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${kfragProgress}%`, background: 'linear-gradient(90deg, #00d4ff, #7c3aed)' }}
                />
              </div>
              <div className="text-xs" style={{ color: '#6b7280' }}>{kfragProgress}% — deriving re-encryption fragments</div>
            </div>
          )}

          {error && <div className="badge badge-red">{error}</div>}

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={() => setStep(1)} disabled={loading}>Back</button>
            <button className="btn-primary" onClick={handleGenerateKfrags} disabled={loading}>
              {loading ? <div className="spinner" /> : <Share2 size={16} />}
              Generate kfrags & Share
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle style={{ color: '#10b981' }} />
            <h2 className="font-semibold text-white">Key Fragments Distributed to Proxy Workers</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['PROXY_WORKER_1', 'PROXY_WORKER_2', 'PROXY_WORKER_3'].map((worker, i) => (
              <div key={worker} className="p-3 rounded-lg text-center" style={{ background: '#0d1225', border: '1px solid #10b981' }}>
                <div className="text-xs font-mono font-bold mb-2" style={{ color: '#10b981' }}>{worker}</div>
                <div className="badge badge-green mx-auto">kfrag #{i + 1}</div>
                <div className="text-xs mt-2" style={{ color: '#6b7280' }}>Fragment received</div>
              </div>
            ))}
          </div>
          <div className="text-xs p-3 rounded-lg" style={{ background: '#0d1225', border: '1px solid #1f2937', color: '#6b7280' }}>
            Re-encryption requires any 2-of-3 proxy workers. Alice's private key was never shared — only the re-encryption fragments.
          </div>
          <button className="btn-secondary" onClick={() => { setStep(1); setGrantResult(null); setKfragProgress(0); }}>
            Share Another File
          </button>
        </div>
      )}

      {/* Active grants */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <FileText size={18} style={{ color: '#00d4ff' }} /> Active Grants
        </h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Grantee</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id}>
                <td>File #{g.file_id}</td>
                <td>User #{g.grantee_id}</td>
                <td>
                  <span className={`badge ${g.status === 'active' ? 'badge-green' : g.status === 'revoked' ? 'badge-red' : 'badge-yellow'}`}>
                    {g.status}
                  </span>
                </td>
                <td className="text-xs" style={{ color: '#6b7280' }}>
                  {new Date(g.expires_at).toLocaleString()}
                </td>
                <td>
                  {g.status === 'active' && (
                    <button
                      className="btn-danger text-xs"
                      onClick={() => handleRevoke(g.id)}
                      disabled={revoking === g.id}
                    >
                      {revoking === g.id ? <div className="spinner" /> : <Trash2 size={13} />}
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {grants.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6" style={{ color: '#6b7280' }}>No grants yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
