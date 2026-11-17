import { useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react';
import { runSecurityTests } from '../lib/api';
import type { SecurityTestResult } from '../lib/api';

export default function SecurityTestPage() {
  const [results, setResults] = useState<SecurityTestResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    setRan(false);
    try {
      const res = await runSecurityTests();
      setResults(res.data.results);
      setSummary({ total: res.data.total, passed: res.data.passed, failed: res.data.failed });
      setRan(true);
    } catch {
      setResults([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const passRate = summary ? Math.round((summary.passed / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert style={{ color: '#00d4ff' }} /> Security Test Suite
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Automated cryptographic security tests to validate the PRE implementation
        </p>
      </div>

      {/* Controls */}
      <div className="card flex items-center gap-4">
        <button className="btn-primary" onClick={handleRun} disabled={loading}>
          {loading ? <div className="spinner" /> : <Play size={16} />}
          {loading ? 'Running Tests...' : 'Run All Security Tests'}
        </button>
        {ran && (
          <button className="btn-secondary" onClick={handleRun} disabled={loading}>
            <RefreshCw size={15} /> Re-run
          </button>
        )}
        {summary && (
          <div className="flex items-center gap-4 ml-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{summary.total}</div>
              <div className="text-xs" style={{ color: '#6b7280' }}>Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{summary.passed}</div>
              <div className="text-xs" style={{ color: '#6b7280' }}>Passed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>{summary.failed}</div>
              <div className="text-xs" style={{ color: '#6b7280' }}>Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: passRate === 100 ? '#10b981' : '#f59e0b' }}>{passRate}%</div>
              <div className="text-xs" style={{ color: '#6b7280' }}>Pass Rate</div>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#00d4ff' }}>
            <div className="spinner" />
            Executing cryptographic security tests...
          </div>
          {[
            'Testing AES-256-GCM key generation...',
            'Verifying PRE key pair generation...',
            'Testing unauthorized decryption resistance...',
            'Verifying kfrag threshold enforcement...',
            'Testing grant revocation...',
            'Checking key isolation...',
            'Verifying capsule integrity...',
            'Testing replay attack resistance...',
            'Checking audit trail completeness...',
          ].map((msg, i) => (
            <div key={i} className="flex items-center gap-2 text-xs" style={{ color: '#6b7280' }}>
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#1f2937' }} />
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {ran && results.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Test Results</h2>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div
                key={i}
                className="p-4 rounded-lg"
                style={{
                  background: r.status === 'PASS' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${r.status === 'PASS' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {r.status === 'PASS' ? (
                      <CheckCircle size={18} style={{ color: '#10b981' }} />
                    ) : (
                      <XCircle size={18} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-white text-sm">{r.test_name}</span>
                      <span className={`badge ${r.status === 'PASS' ? 'badge-green' : 'badge-red'}`}>{r.status}</span>
                      {r.duration_ms !== undefined && (
                        <span className="text-xs" style={{ color: '#6b7280' }}>{r.duration_ms.toFixed(1)}ms</span>
                      )}
                    </div>
                    <div className="text-sm" style={{ color: r.status === 'PASS' ? '#6b7280' : '#ef4444' }}>
                      {r.details}
                    </div>
                    {r.status === 'FAIL' && (
                      <div
                        className="mt-2 p-2 rounded text-xs font-mono"
                        style={{ background: '#0d1225', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        {r.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test descriptions */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Test Coverage</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'Key Generation', desc: 'AES & PRE key pair generation with proper entropy' },
            { name: 'AES-256-GCM', desc: 'Encrypt/decrypt correctness and authentication tag validation' },
            { name: 'PRE Encapsulation', desc: 'Capsule generation and DEK encapsulation' },
            { name: 'kfrag Generation', desc: '2-of-3 threshold key fragment derivation' },
            { name: 'Unauthorized Access', desc: 'Charlie cannot decrypt without valid kfrags' },
            { name: 'Threshold Enforcement', desc: 'Exactly 2 cfrags required (not 1)' },
            { name: 'Grant Revocation', desc: 'Revoked grants block re-encryption' },
            { name: 'Capsule Integrity', desc: 'Tampered capsules fail verification' },
            { name: 'Replay Resistance', desc: 'Old cfrags cannot be replayed on new capsules' },
          ].map((t) => (
            <div key={t.name} className="p-3 rounded-lg text-xs" style={{ background: '#0d1225', border: '1px solid #1f2937' }}>
              <div className="font-semibold mb-1 text-white">{t.name}</div>
              <div style={{ color: '#6b7280' }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
