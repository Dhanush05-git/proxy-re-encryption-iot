import { useState, useEffect } from 'react';
import { Server, RefreshCw, Zap } from 'lucide-react';
import { getProxyOperations, triggerReencrypt, getGrants } from '../lib/api';
import type { ProxyOperation, AccessGrant } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { truncateKey } from '../lib/crypto';

interface WorkerState {
  id: string;
  status: 'IDLE' | 'PROCESSING' | 'DONE' | 'ERROR';
  lastCfrag: string | null;
  lastCapsule: string | null;
  processingMs: number | null;
}

const initWorkers: WorkerState[] = [
  { id: 'PROXY_WORKER_1', status: 'IDLE', lastCfrag: null, lastCapsule: null, processingMs: null },
  { id: 'PROXY_WORKER_2', status: 'IDLE', lastCfrag: null, lastCapsule: null, processingMs: null },
  { id: 'PROXY_WORKER_3', status: 'IDLE', lastCfrag: null, lastCapsule: null, processingMs: null },
];

const workerColors = ['#00d4ff', '#a78bfa', '#10b981'];

export default function ProxyPage() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<WorkerState[]>(initWorkers);
  const [operations, setOperations] = useState<ProxyOperation[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<AccessGrant | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [opsRes, grantsRes] = await Promise.allSettled([
        getProxyOperations(),
        getGrants(),
      ]);
      if (opsRes.status === 'fulfilled') setOperations(opsRes.value.data);
      if (grantsRes.status === 'fulfilled') {
        const activeGrants = grantsRes.value.data.filter((g) => g.status === 'active');
        setGrants(activeGrants);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleTrigger = async () => {
    if (!selectedGrant) return;
    setTriggering(true);
    setWorkers(initWorkers.map((w) => ({ ...w, status: 'PROCESSING' as const })));
    try {
      // We need a capsule — get from the file (via grant)
      const res = await triggerReencrypt({
        grant_id: selectedGrant.id,
        capsule_b64: '', // backend will look up from grant's file
      });
      const workerResults = res.data.worker_results;
      setWorkers(initWorkers.map((w, i) => {
        const result = workerResults.find((r) => r.worker_id === w.id) ?? workerResults[i];
        return {
          ...w,
          status: result?.status === 'success' ? 'DONE' : 'ERROR',
          lastCfrag: result?.cfrag_b64 ?? null,
          lastCapsule: selectedGrant ? `capsule_${selectedGrant.file_id}` : null,
          processingMs: result?.processing_time_ms ?? null,
        };
      }));
      await fetchData();
    } catch {
      setWorkers(initWorkers.map((w) => ({ ...w, status: 'ERROR' as const })));
    } finally {
      setTriggering(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'IDLE') return '#6b7280';
    if (s === 'PROCESSING') return '#f59e0b';
    if (s === 'DONE') return '#10b981';
    return '#ef4444';
  };

  const statusBadge = (s: string) => {
    if (s === 'IDLE') return 'badge-gray';
    if (s === 'PROCESSING') return 'badge-yellow';
    if (s === 'DONE') return 'badge-green';
    return 'badge-red';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server style={{ color: '#00d4ff' }} /> Proxy Worker Network
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          3-of-3 proxy workers perform re-encryption; 2-of-3 threshold required for success
        </p>
      </div>

      {/* Worker cards */}
      <div className="grid grid-cols-3 gap-4">
        {workers.map((w, i) => (
          <div
            key={w.id}
            className="card"
            style={{ border: `1px solid ${w.status === 'IDLE' ? '#1f2937' : workerColors[i] + '50'}` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <code className="text-xs font-bold" style={{ color: workerColors[i] }}>{w.id}</code>
              <span className={`badge ${statusBadge(w.status)}`}>
                {w.status === 'PROCESSING' && <div className="spinner" style={{ width: 10, height: 10 }} />}
                {w.status}
              </span>
            </div>

            {/* Status indicator */}
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{
                background: `${workerColors[i]}15`,
                border: `2px solid ${statusColor(w.status)}`,
              }}
            >
              <Server size={28} style={{ color: workerColors[i] }} />
            </div>

            {/* Stats */}
            {w.lastCfrag && (
              <div className="space-y-2 text-xs">
                <div>
                  <div style={{ color: '#6b7280' }}>Capsule In:</div>
                  <code className="mono-value block mt-0.5">{truncateKey(w.lastCapsule ?? '', 10)}</code>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>cfrag Out:</div>
                  <code className="mono-value block mt-0.5">{truncateKey(w.lastCfrag, 10)}</code>
                </div>
                {w.processingMs !== null && (
                  <div style={{ color: '#6b7280' }}>
                    Processing: <strong style={{ color: '#00d4ff' }}>{w.processingMs.toFixed(1)}ms</strong>
                  </div>
                )}
              </div>
            )}

            {w.status === 'IDLE' && (
              <div className="text-center text-xs mt-2" style={{ color: '#374151' }}>Waiting for capsule...</div>
            )}
          </div>
        ))}
      </div>

      {/* Trigger controls */}
      <div className="card flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>SELECT GRANT</label>
          <select className="input-field" defaultValue="" onChange={(e) => {
            const g = grants.find((x) => String(x.id) === e.target.value);
            setSelectedGrant(g ?? null);
          }}>
            <option value="" disabled>-- Choose active grant --</option>
            {grants.map((g) => (
              <option key={g.id} value={g.id}>Grant #{g.id} — File #{g.file_id} → User #{g.grantee_id}</option>
            ))}
          </select>
        </div>
        <div className="mt-5">
          <button
            className="btn-primary"
            onClick={handleTrigger}
            disabled={!selectedGrant || triggering}
          >
            {triggering ? <div className="spinner" /> : <Zap size={16} />}
            Trigger Re-encryption
          </button>
        </div>
        <div className="mt-5">
          <button className="btn-secondary" onClick={fetchData}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Operation history */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Operation History</h2>
        {loading ? (
          <div className="flex items-center gap-2 justify-center py-6">
            <div className="spinner" /><span style={{ color: '#6b7280' }}>Loading...</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Op ID</th>
                <th>Worker</th>
                <th>Grant</th>
                <th>Status</th>
                <th>Time (ms)</th>
                <th>cfrag</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {operations.slice(0, 20).map((op) => (
                <tr key={op.id}>
                  <td className="font-mono text-xs" style={{ color: '#6b7280' }}>#{op.id}</td>
                  <td><code className="text-xs" style={{ color: '#00d4ff' }}>{op.worker_id}</code></td>
                  <td>#{op.grant_id}</td>
                  <td><span className={`badge ${op.status === 'success' ? 'badge-green' : 'badge-red'}`}>{op.status}</span></td>
                  <td style={{ color: '#10b981' }}>{op.processing_time_ms?.toFixed(1)}</td>
                  <td><code className="mono-value">{truncateKey(op.cfrag_b64 ?? '', 12)}</code></td>
                  <td className="text-xs" style={{ color: '#6b7280' }}>{new Date(op.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {operations.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6" style={{ color: '#6b7280' }}>No operations yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
