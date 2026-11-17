import { useEffect, useState } from 'react';
import {
  Cpu, Lock, Share2, Users, Server, Activity,
  RefreshCw, TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getDashboardStats, getReadings } from '../lib/api';
import type { AuditLog, SensorReading } from '../lib/api';

interface Stats {
  sensor_count: number;
  file_count: number;
  grant_count: number;
  user_count: number;
  proxy_op_count: number;
  recent_audit_logs: AuditLog[];
}

const statCards = [
  { key: 'sensor_count', label: 'Sensor Readings', icon: Cpu, color: '#00d4ff', glow: 'rgba(0,212,255,0.2)' },
  { key: 'file_count', label: 'Encrypted Files', icon: Lock, color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
  { key: 'grant_count', label: 'Active Grants', icon: Share2, color: '#7c3aed', glow: 'rgba(124,58,237,0.2)' },
  { key: 'user_count', label: 'Registered Users', icon: Users, color: '#f59e0b', glow: 'rgba(245,158,11,0.2)' },
  { key: 'proxy_op_count', label: 'Proxy Operations', icon: Server, color: '#a78bfa', glow: 'rgba(167,139,250,0.2)' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs" style={{ border: '1px solid #1f2937' }}>
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed(1)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [sRes, rRes] = await Promise.allSettled([
        getDashboardStats(),
        getReadings(undefined, 24),
      ]);
      if (sRes.status === 'fulfilled') setStats(sRes.value.data);
      if (rRes.status === 'fulfilled') setReadings(rRes.value.data.slice(-24));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  const chartData = readings.map((r, i) => ({
    time: `T-${readings.length - i}`,
    temperature: r.temperature,
    humidity: r.humidity,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            System Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Real-time overview of PRE-IoT security operations
          </p>
        </div>
        <button className="btn-secondary" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse" style={{ height: 100 }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            const val = stats ? (stats as unknown as Record<string, number>)[card.key] : 0;
            return (
              <div
                key={card.key}
                className="card"
                style={{ border: `1px solid ${card.glow}` }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: card.glow }}
                >
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {val ?? 0}
                </div>
                <div className="text-xs font-medium" style={{ color: '#6b7280' }}>
                  {card.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart + Audit logs */}
      <div className="grid grid-cols-3 gap-6">
        {/* Chart */}
        <div className="card col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} style={{ color: '#00d4ff' }} />
            <h2 className="font-semibold text-white">Sensor Data Trend (Last 24 Readings)</h2>
          </div>
          {readings.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#6b7280' }}>
              No sensor data yet — go to Sensors to generate readings
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="temperature" stroke="#00d4ff" strokeWidth={2} dot={false} name="Temp (°C)" />
                <Line type="monotone" dataKey="humidity" stroke="#7c3aed" strokeWidth={2} dot={false} name="Humidity (%)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Audit logs */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} style={{ color: '#10b981' }} />
            <h2 className="font-semibold text-white">Recent Audit Logs</h2>
          </div>
          <div className="space-y-2">
            {stats?.recent_audit_logs?.length ? (
              stats.recent_audit_logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-lg text-xs"
                  style={{ background: '#0d1225', border: '1px solid #1f2937' }}
                >
                  <div className="font-semibold" style={{ color: '#10b981' }}>
                    {log.action}
                  </div>
                  <div style={{ color: '#6b7280' }} className="mt-0.5 truncate">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs" style={{ color: '#6b7280' }}>
                No audit logs yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System status */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">System Status</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Umbral PRE', status: 'ACTIVE', color: 'green' },
            { label: 'AES-256-GCM', status: 'ACTIVE', color: 'green' },
            { label: 'Proxy Workers', status: '3/3 ONLINE', color: 'cyan' },
            { label: 'Key Management', status: 'SECURE', color: 'cyan' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: '#0d1225', border: '1px solid #1f2937' }}
            >
              <span className={`pulse-dot ${s.color}`} />
              <div>
                <div className="text-xs font-semibold text-white">{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{s.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
