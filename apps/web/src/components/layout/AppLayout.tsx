import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apiRequest } from '../../lib/api';
import { AutomotiveLogo } from '../ui/AutomotiveLogo';
import { NotificationDropdown } from './NotificationDropdown';
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
  const [badgeCounts, setBadgeCounts] = useState<{ inbox?: number; leads?: number }>({});

  useEffect(() => {
    async function checkStatus() {
      try {
        const [resWa, resSummary] = await Promise.all([
          apiRequest('/whatsapp/status'),
          apiRequest('/dashboard/summary')
        ]);
        if (resWa.success && resWa.data) {
          setWaStatus(resWa.data.status);
        }
        if (resSummary.success && resSummary.data?.counts) {
          setBadgeCounts({
            inbox: resSummary.data.counts.totalConversations > 0 ? resSummary.data.counts.totalConversations : undefined,
            leads: resSummary.data.counts.newLeads > 0 ? resSummary.data.counts.newLeads : undefined
          });
        }
      } catch (e) {
        // ignore
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Katalog Motor', path: '/motorcycles', icon: Bike },
    { label: 'Kontak', path: '/contacts', icon: Users },
    { label: 'Inbox Chat', path: '/inbox', icon: MessageSquare, badge: badgeCounts.inbox },
    { label: 'Leads', path: '/leads', icon: TrendingUp, badge: badgeCounts.leads },
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
          <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white flex items-center justify-center shadow-xs">
            <AutomotiveLogo className="w-7 h-7 text-blue-600 dark:text-blue-400" size={28} />
          </div>
          <div>
            <h1 className="font-bold text-xs tracking-wider uppercase text-slate-900 dark:text-white leading-tight font-mono">
              DMS RETAIL HUB
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Dealer Operations</p>
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
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {item.badge}
                  </span>
                ) : null}
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
            <AutomotiveLogo className="w-5 h-5 text-blue-600 dark:text-blue-400" size={20} />
            <span className="font-bold text-xs uppercase tracking-wider font-mono text-slate-900 dark:text-white">DMS Console</span>
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
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {item.badge}
                  </span>
                ) : null}
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

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationDropdown />
            <button
              onClick={toggleTheme}
              aria-label="Toggle Dark Mode"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.name}</p>
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
