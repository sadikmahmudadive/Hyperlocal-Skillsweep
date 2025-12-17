import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRefresh } from '../../contexts/RefreshContext';

const COMMON_EMOJIS = ['👍', '👋', '😊', '😂', '❤️', '🎉', '🤔', '👀', '🔥', '✨'];

export default function ChatWindow({ conversation, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { triggerRefresh } = useRefresh() || {};
  const messagesEndRef = useRef(null);
  const { addToast } = useToast();
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const listRef = useRef(null);
  const loadingOlderRef = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [showJumpUnread, setShowJumpUnread] = useState(false);
  const [searchingUnread, setSearchingUnread] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const messageRefs = useRef({});
  const setMsgRef = (id, el) => {
    if (!id) return;
    messageRefs.current[id] = el || undefined;
  };

  const handleUnavailableAction = (feature) => {
    addToast({ type: 'info', title: `${feature} coming soon`, message: 'We are working on this feature.' });
  };

  const scrollToBottom = (smooth = true) => {
    const list = listRef.current;
    if (list) {
      const top = list.scrollHeight;
      if (smooth) {
        list.scrollTo({ top, behavior: 'smooth' });
      } else {
        list.scrollTop = top;
      }
      return;
    }

    // Fallback (should be rare) if listRef isn't mounted yet.
    if (smooth) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    else messagesEndRef.current?.scrollIntoView();
  };

  const refreshUnreadBestEffort = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/chat/unread', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch (_) {}
  };

  const markConversationReadBestEffort = async () => {
    if (!conversation?._id) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch('/api/chat/read', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: conversation._id }),
      });
      setMessages((prev) =>
        prev.map((m) => (String(m?.sender?._id) !== String(user.id) ? { ...m, read: true } : m))
      );
      setShowJumpUnread(false);
      refreshUnreadBestEffort();
    } catch (_) {}
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [newMessage]);

  // Bottom detection and load-older on top reach
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = async () => {
      const nearTop = el.scrollTop <= 0;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      setIsAtBottom(nearBottom);
      if (nearTop && hasMore && !loadingOlderRef.current) {
        loadingOlderRef.current = true;
        const prevHeight = el.scrollHeight;
        await fetchMessages(true, nextCursor);
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight;
          loadingOlderRef.current = false;
        });
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, nextCursor, conversation?._id]);

  useEffect(() => {
    if (!conversation) return;
    setMessages([]);
    setHasMore(true);
    setNextCursor(null);
    setNewMsgCount(0);
    setShowJumpUnread(!!conversation?.unreadCount);
    fetchMessages(false, null);
  }, [conversation?._id]);

  useEffect(() => {
    if (!isAtBottom) return;
    scrollToBottom();
  }, [messages, isAtBottom]);

  // Subscribe to SSE for live message inserts and typing
  const [sseConnected, setSseConnected] = useState(true);
  useEffect(() => {
    if (!conversation) return;
    const es = new EventSource('/api/events/stream');
    es.onopen = () => setSseConnected(true);
    const onMessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.conversationId === conversation._id && data?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === data.message._id)) return prev;
            return [...prev, data.message];
          });
          if (isAtBottom) {
            requestAnimationFrame(() => scrollToBottom());
            if (String(data?.message?.sender?._id) !== String(user.id)) {
              markConversationReadBestEffort();
            }
          } else {
            setNewMsgCount((n) => n + 1);
          }
        }
      } catch {}
    };
    const onTyping = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.conversationId === conversation._id && data?.userId !== user.id) {
          setTypingUsers((prev) => ({ ...prev, [data.userId]: data.isTyping ? Date.now() : 0 }));
        }
      } catch {}
    };
    const onRead = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.conversationId !== conversation._id) return;
        const readerId = String(data?.readerId);
        if (!readerId) return;

        // If I read, mark other's messages read. If other read, mark my messages read.
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = String(m?.sender?._id);
            if (!senderId) return m;
            if (readerId === String(user.id)) {
              return senderId !== String(user.id) ? { ...m, read: true } : m;
            }
            return senderId === String(user.id) ? { ...m, read: true } : m;
          })
        );
      } catch {}
    };
    es.addEventListener('message', onMessage);
    es.addEventListener('typing', onTyping);
    es.addEventListener('read', onRead);
    es.onerror = () => { setSseConnected(false); };
    return () => {
      es.removeEventListener('message', onMessage);
      es.removeEventListener('typing', onTyping);
      es.removeEventListener('read', onRead);
      es.close();
    };
  }, [conversation?._id, isAtBottom]);

  // When user scrolls back to bottom, mark any visible unread messages read.
  useEffect(() => {
    if (!conversation?._id) return;
    if (!isAtBottom) return;
    const hasUnreadFromOther = messages.some((m) => !m.read && String(m?.sender?._id) !== String(user.id));
    if (!hasUnreadFromOther) return;
    markConversationReadBestEffort();
  }, [isAtBottom, conversation?._id, messages]);

  // Clear stale typing indicators
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = { ...prev };
        for (const [uid, ts] of Object.entries(prev)) {
          if (!ts || now - ts > 3000) delete next[uid];
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const sendTyping = (isTyping) => {
    try {
      const token = localStorage.getItem('token');
      fetch('/api/chat/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversationId: conversation._id, isTyping })
      }).catch(() => {});
    } catch {}
  };

  const onChangeMessage = (e) => {
    const val = e.target.value;
    setNewMessage(val);
    // throttle typing events
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTyping(true);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1200);
  };

  const fetchMessages = async (silent = false, beforeCursor = null) => {
    if (!conversation) return;
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const qs = new URLSearchParams({ conversationId: conversation._id });
      if (beforeCursor) qs.set('before', beforeCursor);
      const response = await fetch(`/api/chat/messages?${qs.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        if (beforeCursor) {
          setMessages(prev => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
          requestAnimationFrame(() => scrollToBottom(false));
        }
        setHasMore(!!data.hasMore);
        setNextCursor(data.nextCursor || null);
        // mark others' messages as read on initial load only
        if (!beforeCursor) {
          try {
            await fetch('/api/chat/read', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ conversationId: conversation._id })
            });
            fetch('/api/chat/unread', {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }).catch(() => {});
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
    if (!silent) setLoading(false);
  };

  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', message: 'Max 5MB allowed' });
      return;
    }
    try {
      setLoading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        // Upload to chat endpoint
        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ image: base64 })
        });
        const data = await res.json();
        if (res.ok) {
           await sendInternal(data.url, 'image');
        } else {
           addToast({ type: 'error', title: 'Upload failed', message: data.message });
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setLoading(false);
      addToast({ type: 'error', title: 'Upload failed', message: 'Could not upload image' });
    }
  };

  const sendInternal = async (content, type = 'text') => {
    if (!conversation) return;
    const tempId = 'temp-' + Date.now();
    const optimistic = {
      _id: tempId,
      sender: { _id: user.id },
      content: content,
      createdAt: new Date().toISOString(),
      read: false,
      type: type
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: conversation._id,
          content: content,
          type: type
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => prev.map(m => m._id === tempId ? data.message : m));
        const refreshFn = () => fetchMessages(true);
        if (triggerRefresh) {
          triggerRefresh({ message: 'Syncing chat…', refreshFn });
        } else {
          refreshFn();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      if (type === 'text') setNewMessage(content);
      addToast({ type: 'error', title: 'Message failed', message: 'Could not send. Please retry.' });
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    let content = newMessage.trim();
    if (!content) content = '👍';
    else setNewMessage('');
    await sendInternal(content, 'text');
  };

  const otherParticipant = conversation?.participants?.find(p => p._id !== user.id);

  const quickReplies = useMemo(() => {
    const skill = conversation?.skillTopic;
    const base = [
      'Sounds great! 👍',
      'Can we schedule a quick call?',
      'Let me check and get back to you.',
      'Thanks for the update!'
    ];
    if (skill) {
      base.unshift(`Can we talk about ${skill}?`);
      base.unshift(`When are you free to practice ${skill}?`);
    }
    return Array.from(new Set(base)).slice(0, 4);
  }, [conversation?.skillTopic]);

  const handleQuickReply = (text) => {
    sendInternal(text, 'text');
  };
  
  const isOnline = (u) => {
    if (!u?.lastActive) return false;
    try {
      const last = new Date(u.lastActive).getTime();
      return Date.now() - last < 5 * 60 * 1000;
    } catch (_) { return false; }
  };

  const someoneTyping = Object.keys(typingUsers).length > 0;

  // Jump to first unread: iteratively load older pages until an unread from other is found
  const jumpToFirstUnread = async () => {
    if (searchingUnread) return;
    setSearchingUnread(true);
    const isUnread = (m) => !m.read && m.sender?._id !== user.id;
    // Check current messages first
    let idx = messages.findIndex(isUnread);
    let cursor = nextCursor;
    while (idx === -1 && hasMore && cursor) {
      await fetchMessages(true, cursor);
      // After prepend, our nextCursor has updated; messages changed
      idx = messages.findIndex(isUnread);
      cursor = nextCursor; // will be updated by fetchMessages
      if (!hasMore || !cursor) break;
    }
    // Scroll to the message if found
    const el = idx !== -1 ? messageRefs.current[messages[idx]?._id] : null;
    if (el && listRef.current) {
      const list = listRef.current;
      const top = el.offsetTop - 64; // offset to show some context
      list.scrollTo({ top, behavior: 'smooth' });
      setShowJumpUnread(false);
    }
    setSearchingUnread(false);
  };

  const onJumpToLatest = () => {
    setNewMsgCount(0);
    scrollToBottom();
  };

  // Helper to format date separators
  const getDateLabel = (date) => {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  return (
    <div className="relative h-full">
      <div className="relative flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {otherParticipant?.name?.charAt(0)}
            </div>
            {otherParticipant && (
               <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-slate-900 rounded-full ${
                 otherParticipant.isAvailable === false ? 'bg-slate-400' : (isOnline(otherParticipant) ? 'bg-emerald-500' : 'bg-amber-500')
               }`} title={otherParticipant.isAvailable === false ? 'Unavailable' : (isOnline(otherParticipant) ? 'Online' : 'Away')}></span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{otherParticipant?.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              {conversation?.skillTopic && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{conversation.skillTopic}</span>}
              {someoneTyping && <span className="text-emerald-500 animate-pulse ml-1">typing...</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showJumpUnread && (
            <button
              onClick={jumpToFirstUnread}
              className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 transition-colors"
              disabled={searchingUnread}
            >
              {searchingUnread ? 'Searching…' : 'Jump to unread'}
            </button>
          )}
          <button
            onClick={() => handleUnavailableAction('Voice calls')}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors hidden sm:inline-flex"
            aria-label="Start voice call"
            title="Voice call"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 5l5 5-7.5 7.5a3 3 0 01-4.243 0L3 11.243 10.5 3.75 15 8.25" /></svg>
          </button>
          <button
            onClick={() => handleUnavailableAction('Video calls')}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors hidden sm:inline-flex"
            aria-label="Start video call"
            title="Video call"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-9 4h9a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button
            onClick={() => setShowDetails(prev => !prev)}
            className={`p-2 rounded-full transition-colors ${showDetails ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
            aria-label="Show chat details"
            title="Chat details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 110-20 10 10 0 010 20z" /></svg>
          </button>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Close chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* SSE Connection status */}
      {!sseConnected && (
        <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-200 border-b border-amber-100 dark:border-amber-800/50 flex items-center justify-center gap-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Reconnecting...
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-950/50">
        {hasMore && (
          <div className="flex justify-center py-2">
            <div className="h-1 w-1 bg-slate-300 rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="h-1 w-1 bg-slate-300 rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="h-1 w-1 bg-slate-300 rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        )}
        
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <p className="text-sm">Loading conversation...</p>
          </div>
        ) : (
          messages.reduce((acc, message, index) => {
            const prevMessage = messages[index - 1];
            const isMe = message.sender._id === user.id;
            const isSameSender = prevMessage && prevMessage.sender._id === message.sender._id;
            
            // Date separator
            const dateLabel = getDateLabel(message.createdAt);
            const prevDateLabel = prevMessage ? getDateLabel(prevMessage.createdAt) : null;
            if (dateLabel !== prevDateLabel) {
              acc.push(
                <div key={`date-${dateLabel}`} className="flex justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shadow-sm backdrop-blur-sm">
                    {dateLabel}
                  </span>
                </div>
              );
            }

            acc.push(
              <div
                key={message._id}
                ref={(el) => setMsgRef(message._id, el)}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isSameSender ? 'mt-1' : 'mt-4'}`}
              >
                <div className={`flex max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                  {!isMe && !isSameSender && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex-shrink-0 flex items-center justify-center text-[10px] text-white font-bold shadow-sm mb-1">
                      {message.sender.name?.charAt(0)}
                    </div>
                  )}
                  {!isMe && isSameSender && <div className="w-6" />} {/* Spacer */}

                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed break-words relative group ${
                      isMe
                        ? 'bg-emerald-500 text-white rounded-br-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-slate-700'
                    } ${message.type === 'image' ? '!p-1 !bg-transparent !border-none !shadow-none' : ''}`}
                  >
                    {message.type === 'image' ? (
                      <img 
                        src={message.content} 
                        alt="Attachment" 
                        className="max-w-[240px] sm:max-w-[300px] rounded-xl cursor-pointer hover:opacity-95 transition-opacity border border-slate-200 dark:border-slate-700" 
                        onClick={() => window.open(message.content, '_blank')} 
                      />
                    ) : (
                      message.content
                    )}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
                      {['👍','❤️','🎉'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleQuickReply(emoji); }}
                          className={`w-7 h-7 rounded-full text-base shadow-lg bg-white/90 dark:bg-slate-800/90 hover:-translate-y-0.5 transition-transform ${isMe ? 'text-emerald-500' : 'text-slate-600'}`}
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 opacity-70 ${isMe && message.type !== 'image' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {isMe && (
                        <span>
                          {message.read ? (
                            <span title="Read">✓✓</span>
                          ) : (
                            <span title="Sent">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
            return acc;
          }, [])
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to latest anchor */}
      {newMsgCount > 0 && !isAtBottom && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={onJumpToLatest}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-transform hover:-translate-y-1 text-sm font-medium"
          >
            <span>↓</span>
            {newMsgCount} new message{newMsgCount > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 relative">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
        {showEmojiPicker && (
          <div className="absolute bottom-full left-4 mb-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 grid grid-cols-5 gap-1 z-20">
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setNewMessage(prev => prev + emoji);
                  setShowEmojiPicker(false);
                  textareaRef.current?.focus();
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xl transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {quickReplies.map(reply => (
              <button
                key={reply}
                type="button"
                onClick={() => handleQuickReply(reply)}
                className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        
        <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-3xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
          <button
            type="button"
            className="p-2 text-slate-400 hover:text-emerald-500 transition-colors rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </button>

          <button
            type="button"
            className="p-2 text-slate-400 hover:text-emerald-500 transition-colors rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add emoji"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          
          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={onChangeMessage}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none focus:ring-0 p-2 max-h-32 min-h-[40px] resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
            rows={1}
            disabled={loading}
          />
          
          <button
            type="submit"
            className={`p-2 rounded-full shadow-md transition-all transform hover:scale-105 active:scale-95 ${newMessage.trim() ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-transparent text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}
            title={newMessage.trim() ? 'Send' : 'Send Like'}
          >
            {newMessage.trim() ? (
               <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            ) : (
               <span className="text-2xl">👍</span>
            )}
          </button>
        </div>
      </form>
      </div>

      {showDetails && (
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] cursor-default z-10"
          onClick={() => setShowDetails(false)}
          aria-label="Close details overlay"
        />
      )}

      {/* Details Drawer */}
      <aside
        className={`absolute top-0 right-0 h-full w-full sm:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl transform transition-transform duration-300 ${showDetails ? 'translate-x-0' : 'translate-x-full'} z-20`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Details</p>
            <h4 className="font-semibold text-slate-900 dark:text-white">Conversation info</h4>
          </div>
          <button
            onClick={() => setShowDetails(false)}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto h-[calc(100%-64px)] custom-scrollbar">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold">
              {otherParticipant?.name?.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{otherParticipant?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${otherParticipant?.isAvailable === false ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : (isOnline(otherParticipant) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200')}`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: otherParticipant?.isAvailable === false ? '#94a3b8' : (isOnline(otherParticipant) ? '#10b981' : '#f59e0b') }}></span>
                  {otherParticipant?.isAvailable === false ? 'Unavailable' : (isOnline(otherParticipant) ? 'Online now' : 'Away')}
                </span>
              </p>
            </div>
          </div>

          {conversation?.skillTopic && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Skill topic</p>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-200">
                {conversation.skillTopic}
              </div>
            </div>
          )}

          {otherParticipant?.bio && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">About</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{otherParticipant.bio}</p>
            </div>
          )}

          {otherParticipant?.skills?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {otherParticipant.skills.slice(0, 6).map(skill => (
                  <span key={skill.name || skill} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    {skill.name || skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick actions</p>
            <button
              onClick={() => handleQuickReply("Let's lock in a time? 😊")}
              className="w-full px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm text-left hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-200 transition-colors"
            >
              Wave & schedule
            </button>
            {otherParticipant?._id && (
              <Link href={`/profile/${otherParticipant._id}`} className="block w-full">
                <span className="w-full inline-flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-900 text-white text-sm hover:bg-slate-700">
                  View public profile
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </span>
              </Link>
            )}
          </div>

          {conversation?.createdAt && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Chat started</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {new Date(conversation.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
