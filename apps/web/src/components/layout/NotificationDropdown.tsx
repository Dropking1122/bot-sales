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

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest('/dashboard/notifications');
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (e) {
      // Silent error fallback
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

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
