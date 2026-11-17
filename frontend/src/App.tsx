import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SensorPage from './pages/SensorPage';
import EncryptionPage from './pages/EncryptionPage';
import CloudStoragePage from './pages/CloudStoragePage';
import SharingPage from './pages/SharingPage';
import ProxyPage from './pages/ProxyPage';
import RecipientPage from './pages/RecipientPage';
import SecurityTestPage from './pages/SecurityTestPage';
import PerformancePage from './pages/PerformancePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] text-cyan-400">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-mono text-gray-400">Initializing Cryptographic Session...</span>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/sensors" element={<ProtectedRoute><SensorPage /></ProtectedRoute>} />
          <Route path="/encryption" element={<ProtectedRoute><EncryptionPage /></ProtectedRoute>} />
          <Route path="/cloud" element={<ProtectedRoute><CloudStoragePage /></ProtectedRoute>} />
          <Route path="/sharing" element={<ProtectedRoute><SharingPage /></ProtectedRoute>} />
          <Route path="/proxy" element={<ProtectedRoute><ProxyPage /></ProtectedRoute>} />
          <Route path="/recipient" element={<ProtectedRoute><RecipientPage /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute><SecurityTestPage /></ProtectedRoute>} />
          <Route path="/performance" element={<ProtectedRoute><PerformancePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
