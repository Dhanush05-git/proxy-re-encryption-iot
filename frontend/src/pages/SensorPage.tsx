import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, RefreshCw, Zap, History, Plus, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { generateReading, generateBatch, getReadings, generateHistorical } from '../lib/api';
import type { SensorReading } from '../lib/api';

export default function SensorPage() {
  const navigate = useNavigate();
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [sensorId, setSensorId] = useState('SENSOR-001');
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
      // Backend returns { generated: 1, readings: [...] } or direct item
      const item = (res.data as unknown as { readings?: SensorReading[] }).readings?.[0] ?? res.data;
      setReadings((prev) => [item, ...prev].slice(0, 100));
      setStatus(`✓ Generated telemetry for ${item.sensor_id}`);
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
      const items = (res.data as unknown as { readings?: SensorReading[] }).readings ?? (res.data as unknown as SensorReading[]);
      setReadings((prev) => [...items, ...prev].slice(0, 100));
      setStatus('✓ Batch of 10 simulated sensor telemetry records generated & stored');
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
      const items = (res.data as unknown as { readings?: SensorReading[] }).readings ?? [];
      setReadings((prev) => [...items, ...prev].slice(0, 150));
      setStatus(`✓ Generated 7-day historical telemetry curve (${items.length} points)`);
    } catch {
      setStatus('Error generating historical data');
    } finally {
      setHistLoading(false);
    }
  };

  const handleQuickEncrypt = (r: SensorReading) => {
    navigate('/encryption');
  };

  // Compute live averages
  const avgTemp = readings.length > 0 ? (readings.reduce((acc, r) => acc + (r.temperature || 0), 0) / readings.length).toFixed(1) : '24.5';
  const avgHum = readings.length > 0 ? (readings.reduce((acc, r) => acc + (r.humidity || 0), 0) / readings.length).toFixed(1) : '52.0';
  const avgAqi = readings.length > 0 ? (readings.reduce((acc, r) => acc + (r.air_quality || 0), 0) / readings.length).toFixed(0) : '85';
  const avgPress = readings.length > 0 ? (readings.reduce((acc, r) => acc + (r.pressure || 0), 0) / readings.length).toFixed(1) : '1013.2';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Cpu className="text-cyan-400" /> Simulated IoT Telemetry Engine
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Software-simulated sensor devices generating authentic multi-variable telemetry without physical microcontrollers
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-white flex items-center gap-2 transition-all"
          >
            {loading ? <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /> : <Plus size={14} className="text-cyan-400" />}
            +1 Reading
          </button>

          <button
            onClick={handleBatch}
            disabled={batchLoading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all"
          >
            {batchLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap size={14} />}
            Batch Simulation (10x)
          </button>

          <button
            onClick={handleHistorical}
            disabled={histLoading}
            className="px-3.5 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900/70 border border-purple-800 text-xs font-semibold text-purple-300 flex items-center gap-2 transition-all"
          >
            {histLoading ? <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> : <History size={14} />}
            7-Day Historical
          </button>
        </div>
      </div>

      {status && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-300 font-mono flex items-center gap-2">
          <CheckCircle size={15} className="text-cyan-400 flex-shrink-0" />
          <span>{status}</span>
        </div>
      )}

      {/* Realtime KPI Telemetry Gauges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Mean Temperature</div>
          <div className="text-2xl font-black font-mono text-cyan-400">{avgTemp} °C</div>
          <div className="text-[10px] text-gray-500 mt-1">Normal ambient range (15–40°C)</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Relative Humidity</div>
          <div className="text-2xl font-black font-mono text-purple-400">{avgHum} %</div>
          <div className="text-[10px] text-gray-500 mt-1">Hygrometric distribution</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Air Quality Index (AQI)</div>
          <div className="text-2xl font-black font-mono text-emerald-400">{avgAqi} AQI</div>
          <div className="text-[10px] text-gray-500 mt-1">Simulated particulate matter</div>
        </div>

        <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 shadow-md">
          <div className="text-[11px] font-semibold uppercase text-gray-400 mb-1">Barometric Pressure</div>
          <div className="text-2xl font-black font-mono text-indigo-400">{avgPress} hPa</div>
          <div className="text-[10px] text-gray-500 mt-1">Atmospheric sensor stream</div>
        </div>
      </div>

      {/* Sensor Readings Table */}
      <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            Simulated Sensor Records ({readings.length})
          </h2>
          <span className="text-[11px] font-mono text-gray-500">
            Click 'Encrypt & Upload' to process any record through PRE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-gray-800 text-[11px] text-gray-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Device ID</th>
                <th className="pb-3">Temperature</th>
                <th className="pb-3">Humidity</th>
                <th className="pb-3">Air Quality</th>
                <th className="pb-3">Pressure</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Recorded At</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {readings.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 pl-2 font-bold text-cyan-400">{r.sensor_id}</td>
                  <td className="py-3 text-white">{r.temperature?.toFixed(2)} °C</td>
                  <td className="py-3 text-gray-300">{r.humidity?.toFixed(2)} %</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-400 text-[10px]">
                      {r.air_quality?.toFixed(1)} AQI
                    </span>
                  </td>
                  <td className="py-3 text-gray-400">{r.pressure?.toFixed(1)} hPa</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      {r.device_status || 'online'}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 text-[11px]">
                    {new Date(r.timestamp || r.created_at || '').toLocaleTimeString()}
                  </td>
                  <td className="py-3 text-right pr-2">
                    <button
                      onClick={() => handleQuickEncrypt(r)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white font-sans text-xs font-semibold flex items-center gap-1.5 ml-auto transition-all"
                    >
                      <Lock size={12} /> Encrypt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
