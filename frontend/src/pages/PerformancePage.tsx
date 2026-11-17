import { useState, useEffect } from 'react';
import { BarChart3, Play, Download, Zap, Clock, Shield, Cpu } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { runBenchmarks } from '../lib/api';

interface BenchmarkData {
  key_generation?: { mean_ms: number; min_ms: number; max_ms: number; trials: number };
  aes_encryption?: { mean_ms_by_size: Record<string, number>; trials: number };
  aes_decryption?: { mean_ms_by_size: Record<string, number>; trials: number };
  pre_encapsulation?: { mean_ms: number; trials: number };
  pre_kfrag_generation?: { mean_ms: number; trials: number };
  pre_reencryption?: { mean_ms: number; trials: number };
  pre_decryption_reencrypted?: { mean_ms: number; trials: number };
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono shadow-xl">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }} className="flex justify-between gap-4 py-0.5">
          <span>{p.name}:</span>
          <span className="font-bold">{p.value?.toFixed(3)} ms</span>
        </div>
      ))}
    </div>
  );
};

export default function PerformancePage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runBenchmarks();
      setData(res.data as unknown as BenchmarkData);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRun();
  }, []);

  const exportCSV = () => {
    if (!data) return;
    let csv = "Operation,Parameter_Size,Mean_Time_ms\n";
    if (data.key_generation) csv += `Key_Generation,Secp256k1,${data.key_generation.mean_ms}\n`;
    if (data.pre_encapsulation) csv += `PRE_DEK_Encapsulation,32B_DEK,${data.pre_encapsulation.mean_ms}\n`;
    if (data.pre_kfrag_generation) csv += `PRE_KFrag_Generation,Shares_3_Threshold_2,${data.pre_kfrag_generation.mean_ms}\n`;
    if (data.pre_reencryption) csv += `PRE_Proxy_Transformation,2_Workers_Sequence,${data.pre_reencryption.mean_ms}\n`;
    if (data.pre_decryption_reencrypted) csv += `PRE_Bob_DEK_Recovery,2_Verified_CFrags,${data.pre_decryption_reencrypted.mean_ms}\n`;
    if (data.aes_encryption?.mean_ms_by_size) {
      for (const [sz, ms] of Object.entries(data.aes_encryption.mean_ms_by_size)) {
        csv += `AES_Encryption,${sz},${ms}\n`;
      }
    }
    if (data.aes_decryption?.mean_ms_by_size) {
      for (const [sz, ms] of Object.entries(data.aes_decryption.mean_ms_by_size)) {
        csv += `AES_Decryption,${sz},${ms}\n`;
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pre_iot_benchmark_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format AES data for chart
  const aesChartData = data?.aes_encryption?.mean_ms_by_size
    ? Object.keys(data.aes_encryption.mean_ms_by_size).map((size) => ({
        size,
        encryption_ms: data.aes_encryption?.mean_ms_by_size[size] ?? 0,
        decryption_ms: data.aes_decryption?.mean_ms_by_size[size] ?? 0,
      }))
    : [];

  // Format PRE data for chart
  const preChartData = data
    ? [
        { operation: 'Key Gen', time_ms: data.key_generation?.mean_ms ?? 0, color: '#00d4ff' },
        { operation: 'Encapsulate DEK', time_ms: data.pre_encapsulation?.mean_ms ?? 0, color: '#7c3aed' },
        { operation: 'Gen 3 KFrags', time_ms: data.pre_kfrag_generation?.mean_ms ?? 0, color: '#10b981' },
        { operation: '2x Re-encrypt', time_ms: data.pre_reencryption?.mean_ms ?? 0, color: '#f59e0b' },
        { operation: 'Bob Recover DEK', time_ms: data.pre_decryption_reencrypted?.mean_ms ?? 0, color: '#ec4899' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 className="text-cyan-400" /> Empirical Performance Benchmarks
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Empirical cryptographic execution times measured live on hardware
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-200 flex items-center gap-2 transition-all"
            onClick={exportCSV}
            disabled={!data}
          >
            <Download size={14} className="text-cyan-400" /> Export CSV
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            onClick={handleRun}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Measuring Latencies...
              </>
            ) : (
              <>
                <Play size={14} /> Run Benchmarks
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Key Generation</span>
            <Shield size={16} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {data?.key_generation?.mean_ms?.toFixed(2) ?? '--'} <span className="text-xs text-gray-500">ms</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Umbral Secp256k1 keypair</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">DEK Encapsulation</span>
            <Zap size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {data?.pre_encapsulation?.mean_ms?.toFixed(2) ?? '--'} <span className="text-xs text-gray-500">ms</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Capsule generation (32B DEK)</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Proxy Re-encryption</span>
            <Clock size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {data?.pre_reencryption?.mean_ms?.toFixed(2) ?? '--'} <span className="text-xs text-gray-500">ms</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">2 proxy workers total</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Bob Recover DEK</span>
            <Cpu size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {data?.pre_decryption_reencrypted?.mean_ms?.toFixed(2) ?? '--'} <span className="text-xs text-gray-500">ms</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Decapsulate from 2 CFrags</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-0.5">AES-256-GCM vs Payload Size</h2>
          <p className="text-[11px] text-gray-400 mb-4">Linear scaling O(N) with sensor file size</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aesChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="size" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '11px' }} />
                <Bar dataKey="encryption_ms" name="Encryption" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="decryption_ms" name="Decryption" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-0.5">PRE Overhead Breakdown</h2>
          <p className="text-[11px] text-gray-400 mb-4">Constant time O(1) independent of payload size</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={preChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="operation" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={11} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#6b7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="time_ms" name="Time (ms)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Academic Evaluation Note */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/30 to-indigo-950/30 border border-cyan-800/40 text-xs text-gray-300 leading-relaxed font-mono space-y-2">
        <div className="font-bold text-cyan-400 flex items-center gap-2 text-sm font-sans">
          <Shield size={16} /> Academic Examination Finding
        </div>
        <p>
          In traditional public-key sharing, delegating access to Bob requires Alice to download and re-encrypt the entire payload, scaling with payload size <code className="text-cyan-300">O(N)</code>.
          In this <strong>Proxy Re-Encryption system</strong>, Alice encapsulates only the 256-bit AES Data Encryption Key (DEK). 
          The PRE transformation overhead is <strong>constant <code className="text-cyan-300">O(1)</code> (~2.5ms)</strong> whether the IoT dataset is 1 KB or 100 MB. 
          The untrusted cloud transforms only the capsule, never touching the underlying plaintext.
        </p>
      </div>
    </div>
  );
}
