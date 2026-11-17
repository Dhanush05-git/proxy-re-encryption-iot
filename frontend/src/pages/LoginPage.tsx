import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Mail, Eye, EyeOff, Zap, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('alice');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        setStep('Generating cryptographic key pair...');
        await register(username, email, password, role);
        setStep('Registering with backend...');
      } else {
        setStep('Authenticating...');
        await login(username, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#0a0e1a',
        backgroundImage:
          'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.05) 0%, transparent 50%)',
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}
          >
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">PRE-IoT</h1>
          <p style={{ color: '#6b7280' }} className="text-sm">
            Proxy Re-Encryption · Secure IoT Cloud Sharing
          </p>
        </div>

        {/* Card */}
        <div className="gradient-border">
          <div className="p-8">
            {/* Tab switcher */}
            <div
              className="flex rounded-lg p-1 mb-6"
              style={{ background: '#0d1225' }}
            >
              {['Login', 'Register'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setIsRegister(tab === 'Register'); setError(''); }}
                  className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
                  style={
                    (tab === 'Register') === isRegister
                      ? { background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', color: 'white' }
                      : { color: '#6b7280' }
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
                  USERNAME
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }} />
                  <input
                    className="input-field pl-9"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Email (register only) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
                    EMAIL
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }} />
                    <input
                      type="email"
                      className="input-field pl-9"
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input-field pl-9 pr-9"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#6b7280' }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Role (register only) */}
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9ca3af' }}>
                    ROLE
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'alice', label: 'Alice', desc: 'Data Owner', color: '#00d4ff' },
                      { id: 'bob', label: 'Bob', desc: 'Recipient', color: '#a78bfa' },
                      { id: 'charlie', label: 'Charlie', desc: 'Unauthorized', color: '#f59e0b' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id)}
                        className="p-3 rounded-lg border text-center transition-all"
                        style={{
                          borderColor: role === r.id ? r.color : '#1f2937',
                          background: role === r.id ? `${r.color}15` : '#0d1225',
                        }}
                      >
                        <div className="font-bold text-sm" style={{ color: role === r.id ? r.color : '#9ca3af' }}>
                          {r.label}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div
                  className="flex items-center gap-2 p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
                >
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              {/* Loading step */}
              {loading && step && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#00d4ff' }}>
                  <div className="spinner" />
                  {step}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
                {loading ? (
                  <><div className="spinner" /> Processing...</>
                ) : (
                  <><Lock size={16} /> {isRegister ? 'Create Account & Generate Keys' : 'Authenticate'}</>
                )}
              </button>
            </form>

            {/* Demo hint */}
            <div
              className="mt-6 p-3 rounded-lg text-xs space-y-1"
              style={{ background: '#0d1225', border: '1px solid #1f2937', color: '#6b7280' }}
            >
              <div className="font-semibold mb-1" style={{ color: '#9ca3af' }}>Demo Quick Start</div>
              <div>Register as <strong style={{color:'#00d4ff'}}>Alice</strong> (data owner) → then register as <strong style={{color:'#a78bfa'}}>Bob</strong> (recipient)</div>
              <div>Alice encrypts IoT data → shares with Bob via PRE → Bob decrypts</div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#374151' }}>
          Umbral Proxy Re-Encryption · AES-256-GCM · End-to-End Secure
        </p>
      </div>
    </div>
  );
}
