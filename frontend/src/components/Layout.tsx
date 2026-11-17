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
  Shield,
  KeyRound,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', badge: 'Overview' },
  { to: '/sensors', icon: Cpu, label: 'IoT Sensors', badge: 'Telemetry' },
  { to: '/encryption', icon: Lock, label: 'Encryption', badge: 'Alice' },
  { to: '/cloud', icon: Cloud, label: 'Cloud Storage', badge: 'Encrypted' },
  { to: '/sharing', icon: Share2, label: 'PRE Sharing', badge: 'Delegation' },
  { to: '/proxy', icon: Server, label: 'Proxy Workers', badge: '2-of-3' },
  { to: '/recipient', icon: UserCheck, label: 'Recipient Access', badge: 'Bob / Charlie' },
  { to: '/security', icon: ShieldAlert, label: 'Security Tests', badge: '9 Tests' },
  { to: '/performance', icon: BarChart3, label: 'Benchmarks', badge: 'Metrics' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleQuickSwitch = async (username: string) => {
    try {
      await login(username, 'password123');
    } catch {
      // ignore
    }
  };

  const currentRole = user?.username ?? 'alice';

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0e1a] text-gray-200">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 flex-shrink-0 border-r border-[#1f2937] bg-[#0d1225] select-none">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1f2937]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 shadow-lg shadow-cyan-500/20">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <div className="font-extrabold text-white text-base tracking-wider flex items-center gap-1.5">
              PRE-IoT <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">v0.3</span>
            </div>
            <div className="text-[11px] text-gray-400 font-mono">
              Proxy Re-Encryption
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Workflow Modules
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative',
                  isActive
                    ? 'text-white bg-cyan-500/10 border-l-2 border-cyan-400 pl-2.5 font-semibold'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/40'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={17}
                    className={clsx(
                      'transition-colors',
                      isActive ? 'text-cyan-400' : 'text-gray-400 group-hover:text-cyan-300'
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded font-mono',
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-gray-800 text-gray-400 group-hover:text-gray-300'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-[#1f2937] bg-[#0a0e1a]/60">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-900/90 border border-gray-800">
            <div
              className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold font-mono text-white shadow-sm',
                currentRole === 'alice' ? 'bg-cyan-600' : currentRole === 'bob' ? 'bg-purple-600' : 'bg-amber-600'
              )}
            >
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                {user?.username ?? 'Guest'}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[10px] text-gray-400 font-mono capitalize">
                {currentRole === 'alice' ? 'Data Owner' : currentRole === 'bob' ? 'Recipient' : 'Untrusted User'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-[#1f2937] bg-[#0d1225]/90 backdrop-blur-md z-20">
          {/* Quick Persona Switcher for Viva & Lab Demonstrations */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase mr-1 flex items-center gap-1">
              <User size={13} className="text-cyan-400" /> Active Persona:
            </span>
            <div className="flex items-center bg-gray-900/80 p-1 rounded-lg border border-gray-800">
              <button
                onClick={() => handleQuickSwitch('alice')}
                className={clsx(
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                  currentRole === 'alice'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'text-gray-400 hover:text-gray-200'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Alice (Owner)
              </button>
              <button
                onClick={() => handleQuickSwitch('bob')}
                className={clsx(
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                  currentRole === 'bob'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                    : 'text-gray-400 hover:text-gray-200'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Bob (Recipient)
              </button>
              <button
                onClick={() => handleQuickSwitch('charlie')}
                className={clsx(
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                  currentRole === 'charlie'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                    : 'text-gray-400 hover:text-gray-200'
                )}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Charlie (Attacker)
              </button>
            </div>
          </div>

          {/* Right Status Tags */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-gray-900/60 border border-gray-800 text-[11px] font-mono text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Umbral AFGH PRE 2-of-3 Active</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-800 text-cyan-400 text-[11px] font-mono font-semibold">
              AES-256-GCM
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#0a0e1a] via-[#0c1122] to-[#0a0e1a]">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
