import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Lock, Share2, Users, Server, Activity,
  RefreshCw, TrendingUp, ArrowRight, ShieldCheck, ShieldAlert,
  Zap, Database, Eye
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getDashboardStats, getReadings } from '../lib/api';
import type { AuditLog, SensorReading } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  sensor_count: number;
  file_count: number;
  grant_count: number;
  user_count: number;
  proxy_op_count: number;
  recent_audit_logs: AuditLog[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-xs font-mono">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }} className="flex justify-between gap-4 py-0.5">
          <span>{p.name}:</span>
          <span className="font-bold">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [sRes, rRes] = await Promise.allSettled([
        getDashboardStats(),
        getReadings(undefined, 20),
      ]);
      if (sRes.status === 'fulfilled') setStats(sRes.value.data);
      if (rRes.status === 'fulfilled') setReadings(rRes.value.data.slice(-20));
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
    pressure: r.pressure ? r.pressure / 25 : 40,
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Architecture Steps */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-purple-950/40 border border-cyan-800/40 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium mb-2">
              <ShieldCheck size={14} /> Applied Cryptography Capstone Laboratory
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Proxy Re-Encryption for Secure IoT Cloud Data Sharing
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
              Demonstrates hybrid authenticated encryption (AES-256-GCM) with threshold proxy re-encryption (Umbral v0.3.0). 
              Sensor data remains confidential from the semi-trusted cloud proxy while enabling fine-grained delegation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-xs text-gray-200 font-medium flex items-center gap-2 transition-all"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-cyan-400' : 'text-gray-400'} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/security')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all"
            >
              Run Security Tests <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* 4-Step Interactive Pipeline Flow */}
        <div className="mt-6 pt-5 border-t border-gray-800/80 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            onClick={() => navigate('/sensors')}
            className="cursor-pointer p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800 hover:border-cyan-500/40 transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Step 1</span>
              <Cpu size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-cyan-300">Generate Telemetry</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Software IoT simulation</div>
          </div>

          <div
            onClick={() => navigate('/encryption')}
            className="cursor-pointer p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800 hover:border-indigo-500/40 transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Step 2</span>
              <Lock size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-indigo-300">Encrypt & Encapsulate</div>
            <div className="text-[10px] text-gray-500 mt-0.5">AES-256 + PRE Capsule</div>
          </div>

          <div
            onClick={() => navigate('/sharing')}
            className="cursor-pointer p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800 hover:border-purple-500/40 transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Step 3</span>
              <Share2 size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-purple-300">Delegate to Bob</div>
            <div className="text-[10px] text-gray-500 mt-0.5">2-of-3 threshold kfrags</div>
          </div>

          <div
            onClick={() => navigate('/recipient')}
            className="cursor-pointer p-3 rounded-xl bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800 hover:border-emerald-500/40 transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Step 4</span>
              <Users size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-emerald-300">Bob Decrypts</div>
            <div className="text-[10px] text-gray-500 mt-0.5">2 CFrags decapsulate DEK</div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'IoT Sensor Readings', val: stats?.sensor_count ?? 0, icon: Cpu, color: 'text-cyan-400', border: 'border-cyan-500/30' },
          { label: 'Cloud Encrypted Files', val: stats?.file_count ?? 0, icon: Lock, color: 'text-emerald-400', border: 'border-emerald-500/30' },
          { label: 'Active Sharing Grants', val: stats?.grant_count ?? 0, icon: Share2, color: 'text-purple-400', border: 'border-purple-500/30' },
          { label: 'Registered Entities', val: stats?.user_count ?? 3, icon: Users, color: 'text-amber-400', border: 'border-amber-500/30' },
          { label: 'Proxy Re-encryptions', val: stats?.proxy_op_count ?? 0, icon: Server, color: 'text-indigo-400', border: 'border-indigo-500/30' },
        ].map((item, i) => (
          <div key={i} className={`p-4 rounded-xl bg-gray-900/80 border ${item.border} shadow-lg relative overflow-hidden`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{item.label}</span>
              <item.icon size={16} className={item.color} />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {item.val}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active in database
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" /> Live Simulated Environmental Telemetry
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Real-time temperature (°C) and humidity (%) telemetry stream</p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300">
              {readings.length} readings recorded
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#00d4ff" strokeWidth={2} fillOpacity={1} fill="url(#tempGrad)" />
                <Area type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#7c3aed" strokeWidth={2} fillOpacity={1} fill="url(#humGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cryptographic Audit Trail */}
        <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap size={16} className="text-indigo-400" /> Cryptographic Audit Trail
            </h2>
            <span className="text-[10px] font-mono text-gray-400">Live</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[260px]">
            {stats?.recent_audit_logs && stats.recent_audit_logs.length > 0 ? (
              stats.recent_audit_logs.map((log) => {
                let badgeColor = 'bg-gray-800 text-gray-300';
                if (log.action.includes('encrypt') || log.action.includes('upload')) badgeColor = 'bg-cyan-950 text-cyan-300 border-cyan-800';
                if (log.action.includes('grant')) badgeColor = 'bg-purple-950 text-purple-300 border-purple-800';
                if (log.action.includes('reencrypt')) badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-800';
                if (log.action.includes('revoke')) badgeColor = 'bg-red-950 text-red-300 border-red-800';

                return (
                  <div key={log.id} className="p-2.5 rounded-lg bg-gray-950/70 border border-gray-800/80 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-semibold ${badgeColor}`}>
                        {log.action}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono truncate">
                      {log.details_json || 'Cryptographic operation logged'}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs">
                No audit events recorded yet. Run tests or generate telemetry.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
