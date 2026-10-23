import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import {
  MessageSquare,
  Search,
  Send,
  UserCheck,
  Bot,
  User,
  ShieldAlert,
  Loader2,
  RefreshCw
} from 'lucide-react';

export const InboxPage: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  const loadConversations = async () => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiRequest(`/conversations${q}`);
      if (res.success) {
        setConversations(res.data);
        if (!selectedConv && res.data.length > 0) {
          selectConversation(res.data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conv: any) => {
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const res = await apiRequest(`/conversations/${conv.id}/messages`);
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
        setSelectedConv(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 6000); // 6s poll for inbox
    return () => clearInterval(interval);
  }, [search]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv) return;
    setSending(true);

    try {
      const res = await apiRequest(`/conversations/${selectedConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: replyText.trim() })
      });

      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        setReplyText('');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const handleToggleBot = async () => {
    if (!selectedConv) return;
    try {
      if (selectedConv.isBotActive) {
        const res = await apiRequest(`/conversations/${selectedConv.id}/takeover`, { method: 'POST' });
        if (res.success) {
          setSelectedConv((prev: any) => ({ ...prev, isBotActive: false, status: 'HANDOFF' }));
        }
      } else {
        const res = await apiRequest(`/conversations/${selectedConv.id}/resume-bot`, { method: 'POST' });
        if (res.success) {
          setSelectedConv((prev: any) => ({ ...prev, isBotActive: true, status: 'ACTIVE' }));
        }
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status bot');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col sm:flex-row bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Left Column: Conversations List */}
      <div className="w-full sm:w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari chat pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <button onClick={loadConversations} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-6 text-center text-xs text-slate-400">Memuat percakapan...</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Belum ada percakapan aktif.</div>
          ) : (
            conversations.map((c) => {
              const isSelected = selectedConv?.id === c.id;
              const lastMsg = c.messages && c.messages[0];
              return (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      {c.contact?.name || c.contact?.phoneNormalized}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.lastMessageAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-500 mt-0.5">{c.contact?.phoneNormalized}</p>
                  <p className="text-xs text-slate-500 truncate mt-1">
                    {lastMsg ? lastMsg.content : 'Belum ada pesan'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {c.isBotActive ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Bot Aktif
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Sales Takeover
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Box */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedConv.contact?.name}
                </p>
                <p className="font-mono text-xs text-slate-500">{selectedConv.contact?.phoneNormalized}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleBot}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-colors ${
                    selectedConv.isBotActive
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {selectedConv.isBotActive ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Ambil Alih (Matikan Bot)</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3.5 h-3.5" />
                      <span>Aktifkan Bot Kembali</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50 dark:bg-slate-950/50">
              {loadingMessages ? (
                <div className="p-8 text-center text-xs text-slate-400">Memuat riwayat chat...</div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Belum ada riwayat pesan.</div>
              ) : (
                messages.map((m) => {
                  const isCustomer = m.senderType === 'CUSTOMER';
                  const isBot = m.senderType === 'BOT';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                        {isBot ? '🤖 Bot Otomatis' : isCustomer ? '👤 Pelanggan' : '👨‍💼 Sales'} • {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div
                        className={`max-w-md rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed whitespace-pre-wrap ${
                          isCustomer
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none border border-slate-200 dark:border-slate-700'
                            : isBot
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tr-none'
                            : 'bg-blue-600 text-white rounded-tr-none'
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Composer */}
            <form onSubmit={handleSendReply} className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
              <input
                type="text"
                placeholder="Tulis balasan pesan untuk pelanggan..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Kirim</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Pilih salah satu percakapan di sebelah kiri untuk melihat pesan
          </div>
        )}
      </div>
    </div>
  );
};
