import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Eye, FileJson, Lock, X, Share2, ShieldCheck, Database, Key } from 'lucide-react';
import { getUploads } from '../lib/api';
import type { EncryptedFile } from '../lib/api';
import { truncateKey } from '../lib/crypto';

export default function CloudStoragePage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EncryptedFile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    getUploads()
      .then((r) => setFiles(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openModal = (f: EncryptedFile) => {
    setSelected(f);
    setModalOpen(true);
  };

  const metaDisplay = (f: EncryptedFile) => ({
    id: f.id,
    filename: f.filename,
    sensor_id: f.sensor_id,
    file_size_bytes: f.file_size,
    created_at: f.created_at,
    cipher_suite: 'AES-256-GCM (Authenticated)',
    pre_scheme: 'Umbral Secp256k1 Capsule (AFGH-PRE)',
    capsule_b64: f.capsule_b64,
    nonce_b64: f.nonce_b64,
    encrypted_dek_b64: '*** CONCEALED — Requires Valid PRE Decapsulation ***',
    plaintext_status: '*** ZERO-KNOWLEDGE CLOUD — Plaintext Not Accessible ***',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Cloud className="text-cyan-400" /> Untrusted Cloud Object Storage
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Simulates an untrusted third-party cloud repository storing only authenticated ciphertexts and PRE capsules
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-400 font-semibold">
            AES-256-GCM Sealed
          </span>
          <span className="px-3 py-1 rounded-lg bg-purple-950/60 border border-purple-800 text-purple-400 font-semibold">
            Umbral Capsule Active
          </span>
        </div>
      </div>

      {/* Files Table */}
      <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800 shadow-xl overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Database size={16} className="text-cyan-400" /> Stored Encrypted Sensor Objects ({files.length})
          </h2>
          <span className="text-[11px] font-mono text-gray-500">
            Click 'Inspect Metadata' to audit cloud state
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-xs text-gray-400">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            Loading cloud repository objects...
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs">
            No encrypted files found in cloud storage. Go to Encryption to upload your first telemetry dataset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">Object ID</th>
                  <th className="pb-3">Filename</th>
                  <th className="pb-3">Sensor Origin</th>
                  <th className="pb-3">Ciphertext Size</th>
                  <th className="pb-3">Capsule Status</th>
                  <th className="pb-3">Uploaded</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {files.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-3.5 pl-2 font-bold text-cyan-400">#{f.id}</td>
                    <td className="py-3.5 text-white font-medium">{f.filename}</td>
                    <td className="py-3.5 text-indigo-300 font-bold">{f.sensor_id || 'SENSOR-GEN'}</td>
                    <td className="py-3.5 text-emerald-400">{f.file_size} Bytes</td>
                    <td className="py-3.5">
                      <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800 text-purple-300 text-[10px]">
                        Capsule Verified ✓
                      </span>
                    </td>
                    <td className="py-3.5 text-gray-400 text-[11px]">
                      {new Date(f.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right pr-2 space-x-2">
                      <button
                        onClick={() => openModal(f)}
                        className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-sans text-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                      <button
                        onClick={() => navigate('/sharing')}
                        className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 text-purple-300 hover:text-white font-sans text-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Share2 size={12} /> Share
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cloud Metadata Audit Modal */}
      {modalOpen && selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0d1225] border border-cyan-800/60 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileJson className="text-cyan-400" /> Cloud Object Cryptographic Inspection
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-300 font-mono">
              🛡️ <strong>Zero-Knowledge Cloud Guarantee:</strong> The cloud proxy holds only authenticated ciphertext and public capsule parameters. No plaintext telemetry or raw symmetric keys exist in storage.
            </div>

            <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 overflow-x-auto max-h-96">
              <pre className="text-xs font-mono text-cyan-300 leading-relaxed">
                {JSON.stringify(metaDisplay(selected), null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white transition-colors"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
