import { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Zap, History } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { generateReading, generateBatch, getReadings, generateHistorical } from '../lib/api';
import type { SensorReading } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs" style={{ border: '1px solid #1f2937' }}>
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed(2)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function SensorPage() {
  const { user } = useAuth();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [sensorId, setSensorId] = useState('SENSOR_001');
  const [status, setStatus] = useState('');

  const fetchReadings = async () => {
    try {
      const res = await getReadings(undefined, 50);
      setReadings(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchReadings(); }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setStatus('');
    try {
      const res = await generateReading(sensorId);
      setReadings((prev) => [res.data, ...prev].slice(0, 100));
      setStatus(`Generated reading for ${res.data.sensor_id}`);
    } catch {
      setStatus('Error generating reading');
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async () => {
    setBatchLoading(true);
    setStatus('');
    try {
      const res = await generateBatch(10);
      setReadings((prev) => [...res.data, ...prev].slice(0, 100));
      setStatus(`Generated ${res.data.length} readings`);
    } catch {
      setStatus('Error generating batch');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleHistorical = async () => {
    setHistLoading(true);
    setStatus('');
    try {
      const res = await generateHistorical(sensorId, 7);
      setReadings((prev) => [...res.data, ...prev].slice(0, 200));
      setStatus(`Generated ${res.data.length} historical readings for ${sensorId}`);
      await fetchReadings();
    } catch {
      setStatus('Error generating historical data');
    } finally {
      setHistLoading(false);
    }
  };

  const chartData = readings.slice(0, 24).reverse().map((r, i) => ({
    t: `T${i + 1}`,
    temp: r.temperature,
    humidity: r.humidity,
    air: r.air_quality,
  }));

  const statusColor = (s: string) => {
    if (s === 'active') return 'badge-green';
    if (s === 'warning') return 'badge-yellow';
    return 'badge-red';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Cpu style={{ color: '#00d4ff' }} /> IoT Sensor Simulator
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Generate and monitor sensor readings from IoT devices
        </p>
      </div>

      {/* Controls */}
      <div className="card flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
            SENSOR ID
          </label>
          <select
            className="input-field"
            value={sensorId}
            onChange={(e) => setSensorId(e.target.value)}
          >
            {['SENSOR_001', 'SENSOR_002', 'SENSOR_003', 'SENSOR_004', 'SENSOR_005'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 mt-5">
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? <div className="spinner" /> : <Zap size={16} />}
            Generate Reading
          </button>
          <button className="btn-secondary" onClick={handleBatch} disabled={batchLoading}>
            {batchLoading ? <div className="spinner" /> : <RefreshCw size={16} />}
            Batch (10)
          </button>
          <button className="btn-secondary" onClick={handleHistorical} disabled={histLoading}>
            {histLoading ? <div className="spinner" /> : <History size={16} />}
            Historical (7d)
          </button>
        </div>
        {status && (
          <div className="badge badge-green w-full">{status}</div>
        )}
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Live Sensor Chart (Last 24)</h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#6b7280' }}>
            Generate some readings first
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="t" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Line type="monotone" dataKey="temp" stroke="#00d4ff" strokeWidth={2} dot={false} name="Temp (°C)" />
              <Line type="monotone" dataKey="humidity" stroke="#7c3aed" strokeWidth={2} dot={false} name="Humidity (%)" />
              <Line type="monotone" dataKey="air" stroke="#10b981" strokeWidth={2} dot={false} name="Air Quality" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Recent Readings ({readings.length})</h2>
          <button className="btn-secondary text-xs" onClick={fetchReadings}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sensor ID</th>
                <th>Temp (°C)</th>
                <th>Humidity (%)</th>
                <th>Air Quality</th>
                <th>Pressure</th>
                <th>Energy (kWh)</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {readings.slice(0, 30).map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className="font-mono text-xs" style={{ color: '#00d4ff' }}>{r.sensor_id}</span>
                  </td>
                  <td>{r.temperature?.toFixed(1)}</td>
                  <td>{r.humidity?.toFixed(1)}</td>
                  <td>{r.air_quality?.toFixed(0)}</td>
                  <td>{r.pressure?.toFixed(1)}</td>
                  <td>{r.energy_consumption?.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${statusColor(r.device_status)}`}>
                      {r.device_status}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: '#6b7280' }}>
                    {new Date(r.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
              {readings.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8" style={{ color: '#6b7280' }}>
                    No readings yet — click Generate Reading
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Owner info */}
      <div className="text-xs" style={{ color: '#374151' }}>
        Logged in as: <span style={{ color: '#00d4ff' }}>{user?.username}</span> ({user?.role})
      </div>
    </div>
  );
}
