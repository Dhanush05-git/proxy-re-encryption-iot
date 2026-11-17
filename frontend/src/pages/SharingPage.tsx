import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Users, FileText, Clock, Trash2, CheckCircle, ArrowRight, Shield, Sparkles, Server } from 'lucide-react';
import { getUploads, getUsers, createGrant, getGrants, revokeGrant } from '../lib/api';
import type { EncryptedFile, User, AccessGrant } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { truncateKey } from '../lib/crypto';

export default function SharingPage() {
  const { user, keys, login } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
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
      getUploads().then((r) => {
        setFiles(r.data);
        if (r.data.length > 0 && !selectedFile) {
          setSelectedFile(r.data[0]);
        }
      }),
      getUsers().then((r) => {
        setUsers(r.data);
        const bob = r.data.find((u) => u.username === 'bob' || u.role === 'bob');
        if (bob && !selectedRecipient) {
          setSelectedRecipient(bob);
        }
      }),
      getGrants().then((r) => setGrants(r.data)),
    ]);
  }, []);

  const handleGenerateKfrags = async () => {
    if (!selectedFile || !selectedRecipient || !user?.id) {
      setError('Please select a file and a recipient first');
      return;
    }
    setLoading(true);
    setError('');
    setKfragProgress(0);

    const interval = setInterval(() => {
      setKfragProgress((prev) => Math.min(prev + 20, 90));
    }, 150);

    try {
      const res = await createGrant({
        file_id: selectedFile.id,
        granter_id: user.id,
        grantee_id: selectedRecipient.id,
        granter_sk_b64: keys?.secretKeyB64 || '',
        threshold: 2,
        shares: 3,
        expires_hours: expiryHours,
      });
      clearInterval(interval);
      setKfragProgress(100);
      setGrantResult(res.data);
      setGrants((prev) => [res.data, ...prev]);
    } catch (err: unknown) {
      clearInterval(interval);
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Sharing grant failed';
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
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  };

  const handleProceedAsBob = async () => {
    await login('bob', 'password123');
    navigate('/recipient');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Share2 className="text-purple-400" /> Threshold Proxy Re-Encryption Sharing
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Alice delegates access to Bob by generating 3 Re-Encryption Key Fragments ($N=3$) with a $M=2$ threshold
        </p>
      </div>

      {/* Sharing Configuration Wizard Card */}
      <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* File Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-cyan-400" /> Target Encrypted File
            </label>
            <select
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded-xl p-2.5 font-mono focus:border-cyan-500 focus:outline-none"
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

          {/* Recipient Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} className="text-purple-400" /> Authorized Recipient
            </label>
            <select
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded-xl p-2.5 font-mono focus:border-purple-500 focus:outline-none"
              value={selectedRecipient?.id ? String(selectedRecipient.id) : ''}
              onChange={(e) => {
                const u = users.find((x) => String(x.id) === e.target.value);
                if (u) setSelectedRecipient(u);
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role}) — ID #{u.id}
                </option>
              ))}
            </select>
          </div>

          {/* Expiry Hours */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-400" /> Access Validity
            </label>
            <select
              className="w-full bg-gray-950 border border-gray-800 text-xs text-gray-200 rounded-xl p-2.5 font-mono focus:border-emerald-500 focus:outline-none"
              value={expiryHours}
              onChange={(e) => setExpiryHours(Number(e.target.value))}
            >
              <option value={1}>1 Hour (Short session)</option>
              <option value={24}>24 Hours (Standard)</option>
              <option value={168}>7 Days (Extended research)</option>
            </select>
          </div>
        </div>

        {/* Threshold Proxy Topology Diagram */}
        <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Threshold Topology: Shamir Secret Sharing (2-of-3)</span>
            <span className="text-purple-400 font-bold">M = 2, N = 3</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-gray-900 border border-gray-800 flex items-center gap-3">
              <Server size={18} className="text-cyan-400 flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-xs">Proxy Worker 1</div>
                <div className="text-[10px] text-gray-500">Receives KFrag #1</div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-gray-900 border border-gray-800 flex items-center gap-3">
              <Server size={18} className="text-indigo-400 flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-xs">Proxy Worker 2</div>
                <div className="text-[10px] text-gray-500">Receives KFrag #2</div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-gray-900 border border-gray-800 flex items-center gap-3">
              <Server size={18} className="text-purple-400 flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-xs">Proxy Worker 3</div>
                <div className="text-[10px] text-gray-500">Receives KFrag #3</div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        {/* Generate Button & Progress */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <button
            onClick={handleGenerateKfrags}
            disabled={loading || !selectedFile || !selectedRecipient}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating KFrags ({kfragProgress}%)...
              </>
            ) : (
              <>
                <Share2 size={16} /> Generate 3 KFrags & Authorize Proxy
              </>
            )}
          </button>

          {grantResult && (
            <button
              onClick={handleProceedAsBob}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all animate-in fade-in"
            >
              <Sparkles size={14} /> Switch to Bob & Decrypt <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Active Grants List */}
      <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          Active Sharing Permissions ({grants.length})
        </h2>

        {grants.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No active delegation grants yet. Create a grant using the wizard above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Grant ID</th>
                  <th className="pb-3">File</th>
                  <th className="pb-3">Grantee</th>
                  <th className="pb-3">Threshold</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Expires</th>
                  <th className="pb-3 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {grants.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 pl-2 font-bold text-purple-400">#{g.id}</td>
                    <td className="py-3 text-white">{g.filename || `File #${g.file_id}`}</td>
                    <td className="py-3 text-cyan-300 font-semibold">{g.grantee_username || `User #${g.grantee_id}`}</td>
                    <td className="py-3 text-gray-300">{g.threshold} of {g.shares} Workers</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        g.status === 'active' ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' : 'bg-red-950 border border-red-800 text-red-400'
                      }`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-[11px]">
                      {g.expires_at ? new Date(g.expires_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 text-right pr-2">
                      {g.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(g.id)}
                          disabled={revoking === g.id}
                          className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 font-sans text-xs flex items-center gap-1.5 ml-auto transition-colors"
                        >
                          <Trash2 size={12} /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
