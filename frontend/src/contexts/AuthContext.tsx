import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, generateKeyPair } from '../lib/api';
import type { User } from '../lib/api';

interface Keys {
  secretKeyB64: string;
  publicKeyB64: string;
  signingSecretKeyB64: string;
  signingPublicKeyB64: string;
}

interface AuthContextType {
  user: User | null;
  keys: Keys | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    username: string,
    email: string,
    password: string,
    role: string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [keys, setKeys] = useState<Keys | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('pre_user');
    const storedKeys = localStorage.getItem('pre_keys');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedKeys && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setKeys(JSON.parse(storedKeys));
        setToken(storedToken);
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginUser({ username, password });
    const { token: tok, ...userInfo } = res.data;
    const demoKeys = (res.data as unknown as { demo_keys?: {
      secret_key_b64: string;
      public_key_b64: string;
      signing_secret_key_b64: string;
      signing_public_key_b64: string;
    } }).demo_keys;

    // Restore keys if they exist in localStorage or from demo server seed
    let parsedKeys: Keys | null = null;
    const storedKeys = localStorage.getItem(`pre_keys_${userInfo.username}`);
    if (storedKeys) {
      try { parsedKeys = JSON.parse(storedKeys); } catch { /* ignore */ }
    }
    if (!parsedKeys && demoKeys) {
      parsedKeys = {
        secretKeyB64: demoKeys.secret_key_b64,
        publicKeyB64: demoKeys.public_key_b64,
        signingSecretKeyB64: demoKeys.signing_secret_key_b64,
        signingPublicKeyB64: demoKeys.signing_public_key_b64,
      };
      localStorage.setItem(`pre_keys_${userInfo.username}`, JSON.stringify(parsedKeys));
    }

    setToken(tok);
    const fullUser: User = {
      id: userInfo.user_id,
      username: userInfo.username,
      role: userInfo.role,
      email: '',
      public_key_b64: parsedKeys?.publicKeyB64 ?? userInfo.public_key_b64 ?? '',
      signing_pk_b64: parsedKeys?.signingPublicKeyB64 ?? userInfo.signing_pk_b64 ?? '',
      created_at: new Date().toISOString(),
    };
    setUser(fullUser);
    setKeys(parsedKeys);

    localStorage.setItem('token', tok);
    localStorage.setItem('pre_user', JSON.stringify(fullUser));
    if (parsedKeys) localStorage.setItem('pre_keys', JSON.stringify(parsedKeys));
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string, role: string) => {
      // Generate keypair via backend (uses umbral)
      const kpRes = await generateKeyPair();
      const { secret_key_b64, public_key_b64 } = kpRes.data;

      // Also generate a signing keypair
      const skpRes = await generateKeyPair();
      const signingSecretKeyB64 = skpRes.data.secret_key_b64;
      const signingPublicKeyB64 = skpRes.data.public_key_b64;

      await registerUser({
        username,
        email,
        password,
        role,
        public_key_b64,
        signing_pk_b64: signingPublicKeyB64,
      });

      const newKeys: Keys = {
        secretKeyB64: secret_key_b64,
        publicKeyB64: public_key_b64,
        signingSecretKeyB64,
        signingPublicKeyB64,
      };

      // Store keys keyed by username for retrieval on login
      localStorage.setItem(`pre_keys_${username}`, JSON.stringify(newKeys));

      // Auto-login after register
      await login(username, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    setUser(null);
    setKeys(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('pre_user');
    localStorage.removeItem('pre_keys');
  }, []);

  return (
    <AuthContext.Provider value={{ user, keys, token, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
