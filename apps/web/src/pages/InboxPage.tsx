import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Trash2
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

  const selectedConvRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Sync ref to avoid stale closure in setInterval
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  const loadConversations = async (autoSelectFirst = false) => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiRequest(`/conversations${q}`);
      if (res.success && Array.isArray(res.data)) {
        setConversations(res.data);
        if (autoSelectFirst && !selectedConvRef.current && res.data.length > 0) {
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
    selectedConvRef.current = conv;
    setLoadingMessages(true);
    try {
      const res = await apiRequest(`/conversations/${conv.id}/messages`);
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
        setSelectedConv(res.data);
        selectedConvRef.current = res.data;
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const pollActiveMessages = async () => {
    const active = selectedConvRef.current;
    if (!active || !active.id) return;
    try {
      const res = await apiRequest(`/conversations/${active.id}/messages`);
      if (res.success && res.data?.messages) {
        setMessages((prev) => {
          const newMsgs = res.data.messages;
          if (
            newMsgs.length !== prev.length ||
            (newMsgs.length > 0 && prev.length > 0 && newMsgs[newMsgs.length - 1].id !== prev[prev.length - 1].id)
          ) {
            setTimeout(() => scrollToBottom('smooth'), 50);
            return newMsgs;
          }
          return prev;
        });
      }
    } catch (e) {
      // background silent poll
    }
  };

  useEffect(() => {
    loadConversations(true);
    const interval = setInterval(() => {
      loadConversations(false);
      pollActiveMessages();
    }, 4000);
    return () => clearInterval(interval);
  }, [search]);

  // Scroll to bottom when messages finish loading or change
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      scrollToBottom('auto');
    }
  }, [loadingMessages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || sending) return;
    const textToSend = replyText.trim();
    setSending(true);

    try {
      const res = await apiRequest(`/conversations/${selectedConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: textToSend })
      });

      if (res.success && res.data) {
        setMessages((prev) => [...prev, res.data]);
        setReplyText('');
        setTimeout(() => scrollToBottom('smooth'), 50);
        loadConversations(false);
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

  const handleDeleteConversation = async () => {
    if (!selectedConv) return;
    if (!confirm('Yakin ingin menghapus seluruh riwayat percakapan ini?')) return;
    try {
      const res = await apiRequest(`/conversations/${selectedConv.id}`, { method: 'DELETE' });
      if (res.success) {
        setSelectedConv(null);
        selectedConvRef.current = null;
        setMessages([]);
        loadConversations(false);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus percakapan');
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
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => loadConversations(false)}
            title="Muat Ulang"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
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
                      {c.contact?.name || c.contact?.phoneNormalized || 'Pelanggan'}
                    </p>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                      {c.lastMessageAt
                        ? new Date(c.lastMessageAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-500 mt-0.5 truncate">
                    {c.contact?.phoneNormalized || c.contact?.phone}
                  </p>
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
                  {selectedConv.contact?.name || 'Pelanggan'}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  {selectedConv.contact?.phoneNormalized || selectedConv.contact?.phone}
                </p>
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

                <button
                  onClick={handleDeleteConversation}
                  title="Hapus Percakapan"
                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50 dark:bg-slate-950/50"
            >
              {loadingMessages ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Memuat riwayat chat...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Belum ada riwayat pesan.</div>
              ) : (
                <>
                  {messages.map((m) => {
                    const isCustomer = m.senderType === 'CUSTOMER';
                    const isBot = m.senderType === 'BOT';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5 px-1">
                          {isBot ? '🤖 Bot Otomatis' : isCustomer ? '👤 Pelanggan' : '👨‍💼 Sales'} •{' '}
                          {new Date(m.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
                  })}
                  <div ref={messagesEndRef} className="h-1" />
                </>
              )}
            </div>

            {/* Input Composer */}
            <form
              onSubmit={handleSendReply}
              className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900"
            >
              <input
                type="text"
                placeholder="Tulis balasan pesan untuk pelanggan (tekan Enter untuk kirim)..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 dark:text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{sending ? 'Mengirim...' : 'Kirim'}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-6">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
            <p>Pilih salah satu percakapan di sebelah kiri untuk melihat pesan</p>
          </div>
        )}
      </div>
    </div>
  );
};
