import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Lock,
  Cloud,
  Share2,
  Server,
  UserCheck,
  ShieldAlert,
  BarChart3,
  LogOut,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['alice', 'bob', 'charlie', 'admin'] },
  { to: '/sensors', icon: Cpu, label: 'Sensors', roles: ['alice', 'bob', 'charlie', 'admin'] },
  { to: '/encryption', icon: Lock, label: 'Encryption', roles: ['alice', 'admin'] },
  { to: '/cloud', icon: Cloud, label: 'Cloud Storage', roles: ['alice', 'bob', 'charlie', 'admin'] },
  { to: '/sharing', icon: Share2, label: 'Sharing', roles: ['alice', 'admin'] },
  { to: '/proxy', icon: Server, label: 'Proxy Workers', roles: ['alice', 'bob', 'charlie', 'admin'] },
  { to: '/recipient', icon: UserCheck, label: 'Recipient', roles: ['alice', 'bob', 'charlie', 'admin'] },
  { to: '/security', icon: ShieldAlert, label: 'Security Tests', roles: ['alice', 'bob', 'charlie', 'admin'] },
  { to: '/performance', icon: BarChart3, label: 'Performance', roles: ['alice', 'bob', 'charlie', 'admin'] },
];

const roleColors: Record<string, string> = {
  alice: 'badge-cyan',
  bob: 'badge-purple',
  charlie: 'badge-yellow',
  admin: 'badge-green',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userRole = user?.role ?? '';
  const visibleNav = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0e1a' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col w-64 flex-shrink-0 border-r"
        style={{ background: '#0d1225', borderColor: '#1f2937' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-6 py-5 border-b"
          style={{ borderColor: '#1f2937' }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}
          >
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-wider">PRE-IoT</div>
            <div className="text-xs" style={{ color: '#6b7280' }}>
              Secure Cloud Sharing
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-200'
                )
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: 'rgba(0,212,255,0.1)',
                      borderLeft: '2px solid #00d4ff',
                      paddingLeft: '10px',
                    }
                  : {}
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={17}
                    style={{ color: isActive ? '#00d4ff' : undefined }}
                  />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight size={14} style={{ color: '#00d4ff' }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div
          className="px-4 py-4 border-t"
          style={{ borderColor: '#1f2937' }}
        >
          <div
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ background: '#111827' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', color: 'white' }}
            >
              {user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {user?.username ?? 'Guest'}
              </div>
              <span className={clsx('badge text-xs', roleColors[userRole] ?? 'badge-gray')}>
                {userRole}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top header */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{ background: 'rgba(10,14,26,0.95)', borderColor: '#1f2937', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-2">
            <span className="pulse-dot green" />
            <span className="text-xs" style={{ color: '#6b7280' }}>
              Backend connected — Umbral PRE v0.3.0
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono" style={{ color: '#6b7280' }}>
              {new Date().toLocaleTimeString()}
            </span>
            <div className="badge badge-cyan">SECURE</div>
          </div>
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
