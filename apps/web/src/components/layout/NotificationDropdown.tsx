import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Radio,
  ShieldCheck,
  Clock,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'lead' | 'message' | 'campaign' | 'system';
  time: string;
  link: string;
  read: boolean;
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch {
    // Autoplay policy restriction
  }
}

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('dms_notif_sound') !== 'false';
  });
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const prevUnreadRef = useRef<number | null>(null);
  const originalTitleRef = useRef<string>(typeof document !== 'undefined' ? document.title : 'DMS');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('dms_notif_sound', String(next));
    if (next) playNotificationChime();
  };

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setBrowserNotifEnabled(true);
        playNotificationChime();
        new Notification('Notifikasi Dealer Aktif', {
          body: 'Anda akan menerima pemberitahuan instan saat ada client baru atau chat masuk.',
          icon: '/favicon.ico'
        });
      }
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest('/dashboard/notifications');
      if (res.success && res.data) {
        const list: NotificationItem[] = res.data.notifications || [];
        const count: number = res.data.unreadCount || 0;
        setNotifications(list);
        setUnreadCount(count);

        // Check if new notifications arrived (trigger audio chime & browser alert)
        if (prevUnreadRef.current !== null && count > prevUnreadRef.current) {
          if (soundEnabled) {
            playNotificationChime();
          }

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const latest = list.find((n) => !n.read);
            if (latest) {
              new Notification(latest.title, {
                body: latest.message,
                icon: '/favicon.ico'
              });
            }
          }
        }
        prevUnreadRef.current = count;

        // Update document title with unread badge
        if (typeof document !== 'undefined') {
          if (!originalTitleRef.current || originalTitleRef.current.startsWith('🔔')) {
            originalTitleRef.current = 'DMS Honda - Dealer Management System';
          }
          if (count > 0) {
            document.title = `🔔 (${count}) Chat Baru - ${originalTitleRef.current}`;
          } else {
            document.title = originalTitleRef.current;
          }
        }
      }
    } catch {
      // Silent error fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // 10s poll for responsive alerts
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    // Mark this one as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - (item.read ? 0 : 1)));
    setIsOpen(false);
    navigate(item.link);
  };

  const formatRelativeTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins}m lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}j lalu`;
      return `${Math.floor(diffHours / 24)}h lalu`;
    } catch {
      return 'Tadi';
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'lead':
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'campaign':
        return <Radio className="w-4 h-4 text-amber-500" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Lihat Notifikasi"
        className={`relative p-2 rounded-xl transition-all ${
          isOpen
            ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-inner'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Bell className="w-4 h-4" />

        {/* Dynamic Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-bold text-[10px] leading-none shadow-sm ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <>
          {/* Full transparent backdrop to protect against underlying click-through and search focus */}
          <div
            className="fixed inset-0 z-[90] bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs tracking-wider uppercase font-mono text-slate-900 dark:text-white">
                Notifikasi Dealer
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {unreadCount} baru
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                title={soundEnabled ? 'Suara Notifikasi: Aktif' : 'Suara Notifikasi: Mati'}
                className={`p-1.5 rounded-lg transition-colors ${
                  soundEnabled
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Tandai semua dibaca"
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[11px]">Baca Semua</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Browser Permission Banner (if not yet granted) */}
          {!browserNotifEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied' && (
            <div className="px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-[11px]">
              <span className="text-blue-700 dark:text-blue-300 font-medium">Aktifkan notifikasi browser</span>
              <button
                type="button"
                onClick={requestBrowserPermission}
                className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-semibold text-[10px] hover:bg-blue-700 transition-colors"
              >
                Izinkan
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2 stroke-[1.5]" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Tidak ada notifikasi baru</p>
                <p className="text-[11px] text-slate-400">Semua aktivitas operasional telah terbaca.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    !item.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          !item.read
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {formatRelativeTime(item.time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {item.message}
                    </p>
                  </div>
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/audit-logs');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1"
            >
              <span>Buka Audit Log Seluruh Sistem</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};
