import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apiRequest } from '../../lib/api';
import {
  LayoutDashboard,
  Bike,
  Users,
  MessageSquare,
  TrendingUp,
  Radio,
  FileSpreadsheet,
  FileDown,
  BarChart3,
  Settings,
  History,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  QrCode
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [waStatus, setWaStatus] = useState<'CONNECTED' | 'QR_READY' | 'INITIALIZING' | 'DISCONNECTED'>('DISCONNECTED');

  useEffect(() => {
    async function checkWa() {
      try {
        const res = await apiRequest('/whatsapp/status');
        if (res.success && res.data) {
          setWaStatus(res.data.status);
        }
      } catch (e) {
        // ignore
      }
    }
    checkWa();
    const interval = setInterval(checkWa, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Katalog Motor', path: '/motorcycles', icon: Bike },
    { label: 'Kontak', path: '/contacts', icon: Users },
    { label: 'Inbox Chat', path: '/inbox', icon: MessageSquare },
    { label: 'Leads', path: '/leads', icon: TrendingUp },
    { label: 'Broadcast', path: '/broadcasts', icon: Radio },
    { label: 'Import Data', path: '/imports', icon: FileSpreadsheet },
    { label: 'Export Data', path: '/exports', icon: FileDown },
    { label: 'Laporan', path: '/reports', icon: BarChart3 },
    { label: 'Pengaturan & WA', path: '/settings', icon: Settings },
    { label: 'Audit Log', path: '/audit-logs', icon: History }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderWaBadge = () => {
    if (waStatus === 'CONNECTED') {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>WA Terhubung</span>
        </span>
      );
    }
    if (waStatus === 'QR_READY') {
      return (
        <NavLink
          to="/settings"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:opacity-80"
        >
          <QrCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Scan QR WA</span>
        </NavLink>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
        <WifiOff className="w-3.5 h-3.5 text-slate-500" />
        <span>WA Terputus</span>
      </span>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Brand header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🏍️
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
              Motor Sales Bot
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Dealer WA Management</p>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="overflow-hidden pr-2">
              <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">
                {user?.name || 'Administrator'}
              </p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">{user?.role || 'Admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Keluar"
              className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 transform transition-transform duration-200 ease-in-out lg:hidden flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏍️</span>
            <span className="font-bold text-sm text-slate-900 dark:text-white">Motor Sales Bot</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="p-2 text-rose-600">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            {renderWaBadge()}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle Dark Mode"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{user?.name}</p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
