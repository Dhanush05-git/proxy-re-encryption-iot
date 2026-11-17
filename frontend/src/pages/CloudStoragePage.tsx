import { useState, useEffect } from 'react';
import { Cloud, Eye, FileJson } from 'lucide-react';
import { getUploads } from '../lib/api';
import type { EncryptedFile } from '../lib/api';
import { truncateKey } from '../lib/crypto';

export default function CloudStoragePage() {
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
    encryption: 'AES-256-GCM',
    capsule_b64: f.capsule_b64,
    nonce_b64: f.nonce_b64,
    encrypted_dek_b64: '*** HIDDEN — requires PRE decryption ***',
    ciphertext: '*** ENCRYPTED — not readable without DEK ***',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Cloud style={{ color: '#00d4ff' }} /> Cloud Storage
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Encrypted files stored in the cloud — content is never accessible without the private key
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <span className="badge badge-green">AES-256-GCM Protected</span>
          <span className="badge badge-cyan">PRE Capsule Active</span>
          <span className="badge badge-purple">{files.length} Files</span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <div className="spinner" />
            <span style={{ color: '#6b7280' }}>Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Sensor ID</th>
                  <th>Size</th>
                  <th>Uploaded At</th>
                  <th>Encryption</th>
                  <th>Capsule</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="font-medium text-white">{f.filename}</div>
                    </td>
                    <td>
                      <span className="font-mono text-xs" style={{ color: '#00d4ff' }}>{f.sensor_id}</span>
                    </td>
                    <td>{f.file_size} B</td>
                    <td className="text-xs" style={{ color: '#6b7280' }}>
                      {new Date(f.created_at).toLocaleString()}
                    </td>
                    <td><span className="badge badge-green">AES-256-GCM ✓</span></td>
                    <td>
                      <code className="mono-value">{truncateKey(f.capsule_b64, 12)}</code>
                    </td>
                    <td>
                      <button className="btn-secondary text-xs" onClick={() => openModal(f)}>
                        <Eye size={13} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8" style={{ color: '#6b7280' }}>
                      No encrypted files yet — go to Encryption to upload
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security notice */}
      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="text-xs space-y-1" style={{ color: '#6b7280' }}>
          <div className="font-semibold mb-2" style={{ color: '#ef4444' }}>⚠ Storage Security Guarantees</div>
          <div>• All files stored in ciphertext — plaintext never touches disk</div>
          <div>• DEK encrypted with owner's public key via PRE capsule</div>
          <div>• Even the cloud provider cannot read the data without the private key</div>
          <div>• Capsule enables re-encryption without exposing the original DEK</div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            style={{ border: '1px solid #00d4ff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <FileJson size={18} style={{ color: '#00d4ff' }} />
              <h2 className="font-bold text-white">File Metadata (No Decryption)</h2>
              <button className="ml-auto text-gray-500 hover:text-white" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="json-display">
              {JSON.stringify(metaDisplay(selected), null, 2)}
            </div>
            <div className="mt-3 text-xs" style={{ color: '#6b7280' }}>
              * Encrypted DEK and ciphertext are intentionally hidden — this is metadata only
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
