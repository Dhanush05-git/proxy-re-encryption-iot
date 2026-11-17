import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ───── Types ─────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  public_key_b64: string;
  signing_pk_b64?: string;
  created_at: string;
}

export interface SensorReading {
  id?: number;
  sensor_id: string;
  temperature: number;
  humidity: number;
  air_quality: number;
  pressure: number;
  energy_consumption: number;
  device_status: string;
  timestamp: string;
  created_at?: string;
  owner_id?: number;
}

export interface EncryptedFile {
  id: number;
  filename: string;
  sensor_id: string;
  owner_id: number;
  capsule_b64: string;
  encrypted_dek_b64: string;
  nonce_b64: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

export interface AccessGrant {
  id: number;
  file_id: number;
  granter_id: number;
  grantee_id: number;
  threshold: number;
  shares: number;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  grantee_username?: string;
  filename?: string;
}

export interface ProxyOperation {
  id: number;
  grant_id: number;
  worker_id: string;
  cfrag_b64: string;
  processing_time_ms: number;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  user_id: number;
  details_json: string;
  ip_address: string;
  created_at: string;
}

export interface WorkerResult {
  worker_id: string;
  status: string;
  processing_time_ms: number;
  cfrag_b64: string | null;
}

export interface ReencryptResponse {
  success: boolean;
  cfrags: string[];
  worker_results: WorkerResult[];
}

export interface SecurityTestResult {
  test_name?: string;
  name?: string;
  status?: 'PASS' | 'FAIL';
  passed?: boolean;
  details: string;
  duration_ms?: number;
}

export interface BenchmarkResult {
  operation: string;
  file_size: number;
  mean_ms: number;
  median_ms: number;
  min_ms: number;
  max_ms: number;
  runs: number;
}

export interface KeyPair {
  secret_key_b64: string;
  public_key_b64: string;
}

// ───── API Calls ──────────────────────────────────────────────────────────────

// Auth
export const registerUser = (data: {
  username: string;
  email: string;
  password: string;
  role: string;
  public_key_b64: string;
  signing_pk_b64: string;
}) => api.post<User>('/users/register', data);

export const loginUser = (data: { username: string; password: string }) =>
  api.post<{
    user_id: number;
    username: string;
    role: string;
    token: string;
    public_key_b64?: string;
    signing_pk_b64?: string;
    demo_keys?: {
      secret_key_b64: string;
      public_key_b64: string;
      signing_secret_key_b64: string;
      signing_public_key_b64: string;
    };
  }>('/users/login', data);

export const getUsers = () => api.get<User[]>('/users');
export const getUser = (id: number) => api.get<User>(`/users/${id}`);

// Keypair
export const generateKeyPair = () => api.post<KeyPair>('/crypto/generate-keypair');

// Sensors
export const generateReading = (sensor_id?: string) =>
  api.post<SensorReading>('/sensors/generate', { sensor_id });
export const generateBatch = (count: number, sensor_ids?: string[]) =>
  api.post<SensorReading[]>('/sensors/generate-batch', { count, sensor_ids });
export const getReadings = (sensor_id?: string, limit?: number) =>
  api.get<SensorReading[]>('/sensors/readings', { params: { sensor_id, limit } });
export const generateHistorical = (sensor_id: string, days?: number) =>
  api.post<SensorReading[]>('/sensors/historical', { sensor_id, days });

// Uploads / Cloud Storage
export const encryptUpload = (data: {
  sensor_reading_id: number;
  owner_id: number;
  owner_sk_b64: string;
}) => api.post<EncryptedFile>('/uploads/encrypt-upload', data);
export const getUploads = (owner_id?: number) =>
  api.get<EncryptedFile[]>('/uploads', { params: { owner_id } });
export const getUpload = (id: number) => api.get<EncryptedFile>(`/uploads/${id}`);

// Grants / Sharing
export const createGrant = (data: {
  file_id: number;
  granter_id: number;
  grantee_id: number;
  granter_sk_b64: string;
  threshold?: number;
  shares?: number;
  expires_hours?: number;
}) => api.post<AccessGrant>('/sharing/grant', data);

export const getGrants = (params?: { granter_id?: number; grantee_id?: number; file_id?: number }) =>
  api.get<AccessGrant[]>('/sharing/grants', { params });

export const revokeGrant = (grant_id: number) => api.post(`/sharing/${grant_id}/revoke`);

// Proxy
export const triggerReencrypt = (data: {
  grant_id: number;
  capsule_b64: string;
  requester_id?: number;
}) => api.post<ReencryptResponse>('/proxy/reencrypt', data);

export const getProxyOperations = () => api.get<ProxyOperation[]>('/proxy/operations');

// Decrypt
export const decryptFile = (data: {
  file_id: number;
  recipient_sk_b64: string;
  cfrags_b64: string[];
}) => api.post<{ success: boolean; file_id: number; filename: string; decrypted_data: string }>('/uploads/decrypt', data);

// Dashboard stats
export const getDashboardStats = () =>
  api.get<{
    sensor_count: number;
    file_count: number;
    grant_count: number;
    user_count: number;
    proxy_op_count: number;
    recent_audit_logs: AuditLog[];
  }>('/dashboard/stats');

// Security tests
export const runSecurityTests = () =>
  api.post<{ results: SecurityTestResult[]; total: number; passed: number; failed: number }>(
    '/security-tests/run'
  );

// Benchmarks
export const runBenchmarks = () =>
  api.post<{ results: BenchmarkResult[] }>('/benchmarks/run');

export const getAuditLogs = (limit?: number) =>
  api.get<AuditLog[]>('/audit/logs', { params: { limit } });

export default api;
