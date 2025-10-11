import { useState, useEffect, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

export default function ChatWindow({ conversation, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
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
  const messageRefs = useRef({});
  const setMsgRef = (id, el) => {
    if (!id) return;
    messageRefs.current[id] = el || undefined;
  };

  const scrollToBottom = (smooth = true) => {
    if (smooth) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView();
    }
  };

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
    scrollToBottom();
  }, [messages]);

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
    es.addEventListener('message', onMessage);
    es.addEventListener('typing', onTyping);
    es.onerror = () => { setSseConnected(false); };
    return () => {
      es.removeEventListener('message', onMessage);
      es.removeEventListener('typing', onTyping);
      es.close();
    };
  }, [conversation?._id, isAtBottom]);

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
            fetch('/api/chat/unread').catch(() => {});
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
    if (!silent) setLoading(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    const tempId = 'temp-' + Date.now();
    const optimistic = {
      _id: tempId,
      sender: { _id: user.id },
      content: messageContent,
      createdAt: new Date().toISOString(),
      read: false,
      type: 'text'
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
          content: messageContent
        })
      });

      const data = await response.json();
      if (response.ok) {
        // replace optimistic with server message
        setMessages(prev => prev.map(m => m._id === tempId ? data.message : m));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setNewMessage(messageContent);
      addToast({ type: 'error', title: 'Message failed', message: 'Could not send. Please retry.' });
    }
  };

  const otherParticipant = conversation?.participants?.find(p => p._id !== user.id);

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

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold">
            {otherParticipant?.name?.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold">{otherParticipant?.name}</h3>
            <p className="text-sm text-gray-600">Skill: {conversation?.skillTopic}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showJumpUnread && (
            <button
              onClick={jumpToFirstUnread}
              className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
              disabled={searchingUnread}
            >
              {searchingUnread ? 'Searching…' : 'Jump to first unread'}
            </button>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
      </div>

      {/* SSE Connection status */}
      {!sseConnected && (
        <div className="px-4 py-2 text-xs text-yellow-800 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
          <svg className="animate-spin h-3 w-3 text-yellow-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          Reconnecting to live updates…
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasMore && (
          <div className="text-center text-xs text-gray-400">Scroll up to load older messages</div>
        )}
        {loading && messages.length === 0 ? (
          <div className="text-center text-gray-500">Loading messages...</div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              ref={(el) => setMsgRef(message._id, el)}
              className={`flex ${message.sender._id === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender._id === user.id
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${
                  message.sender._id === user.id ? 'text-green-100' : 'text-gray-500'
                }`}>
                  {new Date(message.createdAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to latest anchor */}
      {newMsgCount > 0 && !isAtBottom && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={onJumpToLatest}
            className="px-3 py-1.5 rounded-full bg-green-600 text-white shadow hover:bg-green-700 text-sm"
          >
            {newMsgCount} new message{newMsgCount > 1 ? 's' : ''} — Jump to latest
          </button>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 rounded hover:bg-gray-100"
            title="Emoji picker (coming soon)"
            onClick={(e) => e.preventDefault()}
          >
            😊
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded hover:bg-gray-100"
            title="Attach (coming soon)"
            onClick={(e) => e.preventDefault()}
          >
            📎
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={onChangeMessage}
            placeholder="Type your message..."
            className="flex-1 input-field"
            disabled={loading}
          />
          <button type="submit" disabled={!newMessage.trim()} className="btn-primary px-6">Send</button>
        </div>
      </form>
    </div>
  );
}