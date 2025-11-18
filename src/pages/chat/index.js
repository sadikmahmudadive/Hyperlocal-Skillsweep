import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import ChatWindow from '../../components/chat/ChatWindow';

function HoverRatingRow({ user, ratingCache, setRatingCache }) {
  const uid = user?._id;
  const cached = uid ? ratingCache[uid] : null;
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    async function run() {
      if (!uid || cached) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/reviews/stats?userId=${uid}`);
        const data = await res.json();
        if (res.ok && active) {
          setRatingCache(prev => ({ ...prev, [uid]: { average: data.average || 0, count: data.count || 0 } }));
        }
      } catch {}
      finally { if (active) setLoading(false); }
    }
    run();
    return () => { active = false; };
  }, [uid, cached, setRatingCache]);
  const avg = cached?.average ?? user?.rating?.average ?? 0;
  const count = cached?.count ?? user?.rating?.count ?? 0;
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
      <span className="text-yellow-500">{'⭐'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</span>
      <span>{avg.toFixed ? avg.toFixed(1) : Number(avg).toFixed(1)}</span>
      <span className="text-gray-400">({count})</span>
      {loading && <span className="ml-1 inline-block w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
    </div>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  const [query, setQuery] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  useRequireAuth();
  const esRef = useRef(null);
  // New: tab + people search state
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'people'
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  // New: suggested users state
  const [suggested, setSuggested] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [hoverUserId, setHoverUserId] = useState(null);
  const hoverTimeout = useRef(null);
  const searchInputRef = useRef(null);
  const [ratingCache, setRatingCache] = useState({}); // userId -> { average, count }

  // Presence heuristic: online if lastActive within 5 minutes
  const isOnline = (u) => {
    if (!u?.lastActive) return false;
    try {
      const last = new Date(u.lastActive).getTime();
      return Date.now() - last < 5 * 60 * 1000;
    } catch (_) { return false; }
  };

  // Debounce query for People search
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetchConversations();
    fetchUnread();
  }, []);

  // Fallback periodic refresh (e.g. if SSE drops) every 120s
  useAutoRefresh(120000);

  // SSE: refresh conversations/messages and unread counts in near-realtime
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const es = new EventSource('/api/events/stream');
    esRef.current = es;
    es.addEventListener('message', () => {
      fetchConversations();
      fetchUnread();
    });
    es.addEventListener('conversation-start', () => {
      fetchConversations();
      fetchUnread();
    });
    es.onerror = () => {
      es.close();
      esRef.current = null;
      setTimeout(() => {
        if (!esRef.current) {
          // trigger refetch; new EventSource will be created on next mount/navigation
          fetchConversations();
        }
      }, 5000);
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);
  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/chat/unread');
      if (!res.ok) return;
      const data = await res.json();
      setUnreadMap(data?.perConversation || {});
    } catch (e) {}
  };

  useEffect(() => {
    if (router.query.conversation) {
      const conversation = conversations.find(c => c._id === router.query.conversation);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    } else if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [router.query.conversation, conversations, selectedConversation]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (response.ok) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
    setLoading(false);
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants.find(p => p._id !== user.id);
  };

  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const other = getOtherParticipant(c);
      const name = (other?.name || '').toLowerCase();
      const skill = (c.skillTopic || '').toLowerCase();
      const last = (c.messages?.[c.messages.length - 1]?.content || '').toLowerCase();
      return name.includes(q) || skill.includes(q) || last.includes(q);
    });
  }, [conversations, query]);

  // New: fetch people by query
  const fetchPeople = async () => {
    if (!query || query.trim().length < 2) {
      setPeople([]);
      return;
    }
    try {
      setPeopleLoading(true);
      const res = await fetch(`/api/users/search?query=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        setPeople([]);
        setPeopleLoading(false);
        return;
      }
      const data = await res.json();
      const list = (data?.users || []).filter(u => String(u._id) !== String(user.id));
      setPeople(list);
    } catch (e) {
      setPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  };

  // New: fetch suggested users (default list) when no query
  const fetchSuggestions = async () => {
    try {
      setSuggestedLoading(true);
      const res = await fetch(`/api/users/search`);
      if (!res.ok) {
        setSuggested([]);
        setSuggestedLoading(false);
        return;
      }
      const data = await res.json();
      const list = (data?.users || []).filter(u => String(u._id) !== String(user.id));
      setSuggested(list);
    } catch (e) {
      setSuggested([]);
    } finally {
      setSuggestedLoading(false);
    }
  };

  // Trigger: when People tab active and query is short, fetch suggestions
  useEffect(() => {
    if (activeTab === 'people' && (!query || query.trim().length < 2)) {
      fetchSuggestions();
    }
  }, [activeTab, query]);

  // Update: use debouncedQuery in people fetch trigger
  useEffect(() => {
    if (activeTab === 'people') {
      if (debouncedQuery && debouncedQuery.trim().length >= 2) {
        fetchPeople();
      } else {
        fetchSuggestions();
      }
    }
  }, [activeTab, debouncedQuery]);

  // New: start chat with a user
  const startChat = async (recipientId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId, skillTopic: '' })
      });
      if (!res.ok) return;
      const { conversation } = await res.json();
      setConversations(prev => {
        const idx = prev.findIndex(c => c._id === conversation._id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = conversation;
          return copy;
        }
        return [conversation, ...prev];
      });
      setSelectedConversation(conversation);
      setUnreadMap(prev => ({ ...prev, [conversation._id]: 0 }));
      router.push({ pathname: '/chat', query: { conversation: conversation._id } }, undefined, { shallow: true });
    } catch (e) {}
  };

  // Build a unique, ordered list of recent contacts (other participants from conversations)
  const recentContacts = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const c of conversations) {
      const other = getOtherParticipant(c);
      if (!other) continue;
      const key = String(other._id);
      if (seen.has(key)) continue;
      const baseUnread = typeof c.unreadCount === 'number'
        ? c.unreadCount
        : (c.messages || []).reduce((acc, m) => {
            const senderId = typeof m.sender === 'object' && m.sender?._id ? m.sender._id : m.sender;
            return acc + (!m.read && String(senderId) !== String(user.id) ? 1 : 0);
          }, 0);
      const unreadCount = unreadMap[c._id] ?? baseUnread;
      list.push({ user: other, conversationId: c._id, unreadCount, updatedAt: c.updatedAt });
      seen.add(key);
    }
    return list.slice(0, 20);
  }, [conversations, unreadMap, user?.id]);

  // Helper: select conversation by other user id (fallback to start chat)
  const selectByOtherUserId = (otherId) => {
    const conv = conversations.find(c => String(getOtherParticipant(c)?._id) === String(otherId));
    if (conv) {
      setSelectedConversation(conv);
      setUnreadMap(prev => ({ ...prev, [conv._id]: 0 }));
      router.push({ pathname: '/chat', query: { conversation: conv._id } }, undefined, { shallow: true });
    } else {
      startChat(otherId);
    }
  };

  // Distance helpers
  const getUserCoords = (u) => {
    const coords = u?.location?.coordinates;
    return Array.isArray(coords) && coords.length === 2 ? coords : null;
  };
  const haversineKm = (a, b) => {
    if (!a || !b) return null;
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const R = 6371; // km
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    return R * c;
  };
  const formatDistance = (km) => (km == null ? null : (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`));

  // Rating stars
  const StarRating = ({ value = 0, count = 0 }) => {
    const v = Math.round(value);
    const stars = Array.from({ length: 5 }, (_, i) => (i < v ? '★' : '☆')).join('');
    return (
      <span className="text-xs text-yellow-500" title={`${value?.toFixed ? value.toFixed(1) : value}/5 (${count})`}>
        {stars}
      </span>
    );
  };

  // Focus search when switching to People tab
  useEffect(() => {
    if (activeTab === 'people') {
      // allow next paint
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-[70vh]">
            {/* Conversations List */}
            <div className="lg:col-span-4 border-r flex flex-col">
              <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold">Chats</h2>
                  <button
                    className="text-sm px-3 py-1.5 rounded-full bg-green-600 text-white hover:bg-green-700"
                    onClick={() => setActiveTab('people')}
                    aria-label="Start a new chat"
                  >
                    New Chat
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    className={`px-3 py-1.5 rounded-full text-sm ${activeTab === 'chats' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    onClick={() => setActiveTab('chats')}
                  >
                    Conversations
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-full text-sm ${activeTab === 'people' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    onClick={() => setActiveTab('people')}
                  >
                    People
                  </button>
                </div>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={activeTab === 'people' ? 'Search people by name or skill' : 'Search conversations'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-400">🔎</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'chats' && (
                  <>
                    {/* Recent contacts avatar strip */}
                    {recentContacts.length > 0 && (
                      <div className="px-4 py-3 border-b bg-white/50">
                        <div className="mb-2 text-xs uppercase tracking-wide text-gray-400">Recent</div>
                        <div className="overflow-x-auto">
                          <div className="flex items-center gap-4 pr-4">
                            {recentContacts.map(rc => (
                              <div key={rc.user._id} className="relative">
                                <button
                                  onClick={() => selectByOtherUserId(rc.user._id)}
                                  onMouseEnter={() => {
                                    clearTimeout(hoverTimeout.current);
                                    setHoverUserId(rc.user._id);
                                  }}
                                  onMouseLeave={() => {
                                    hoverTimeout.current = setTimeout(() => setHoverUserId((id) => id === rc.user._id ? null : id), 150);
                                  }}
                                  className={`relative flex flex-col items-center focus:outline-none ${selectedConversation && String(getOtherParticipant(selectedConversation)?._id) === String(rc.user._id) ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
                                  title={rc.user.name}
                                >
                                  <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-green-500/40 shadow-sm">
                                    <img
                                      src={rc.user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(rc.user?.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                                      alt={rc.user?.name || 'User avatar'}
                                      className="h-full w-full object-cover"
                                    />
                                    {/* presence dot */}
                                    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white ${isOnline(rc.user) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                    {/* unread badge */}
                                    {rc.unreadCount > 0 && (
                                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-green-600 text-white text-[10px] font-semibold h-5 min-w-[1.1rem] px-1">
                                        {rc.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <span className="mt-1 max-w-[3rem] text-[11px] text-gray-600 truncate text-center">{rc.user?.name}</span>
                                </button>
                                {/* Hover card */}
                                {hoverUserId === rc.user._id && (
                                  <div
                                    onMouseEnter={() => {
                                      clearTimeout(hoverTimeout.current);
                                      setHoverUserId(rc.user._id);
                                    }}
                                    onMouseLeave={() => {
                                      hoverTimeout.current = setTimeout(() => setHoverUserId(null), 150);
                                    }}
                                    className="absolute z-10 mt-2 -left-8 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-3"
                                  >
                                    <div className="flex items-start gap-3">
                                      <img
                                        src={rc.user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(rc.user?.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                                        alt={rc.user?.name || 'User avatar'}
                                        className="h-10 w-10 rounded-full object-cover"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold truncate">{rc.user?.name}</span>
                                          <span className={`inline-block h-2 w-2 rounded-full ${isOnline(rc.user) ? 'bg-green-500' : 'bg-gray-300'}`} title={isOnline(rc.user) ? 'Online' : 'Offline'}></span>
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">Last active: {rc.user?.lastActive ? new Date(rc.user.lastActive).toLocaleString() : 'unknown'}</div>
                                        {/* Rating row */}
                                        <HoverRatingRow user={rc.user} ratingCache={ratingCache} setRatingCache={setRatingCache} />
                                        <div className="mt-2 flex items-center gap-3">
                                          <Link href={`/profile/${rc.user._id}`} className="text-sm text-gray-600 hover:text-gray-800 underline" onClick={() => setHoverUserId(null)}>
                                            View profile
                                          </Link>
                                          <button className="text-sm text-green-700 hover:text-green-800" onClick={() => { setHoverUserId(null); selectByOtherUserId(rc.user._id); }}>
                                            Message
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {filteredConversations.map(conversation => {
                      const otherUser = getOtherParticipant(conversation);
                      const lastMessage = conversation.messages[conversation.messages.length - 1];
                      const baseUnread = typeof conversation.unreadCount === 'number'
                        ? conversation.unreadCount
                        : (conversation.messages || []).reduce((acc, m) => {
                            const senderId = typeof m.sender === 'object' && m.sender?._id ? m.sender._id : m.sender;
                            return acc + (!m.read && String(senderId) !== String(user.id) ? 1 : 0);
                          }, 0);
                      const unreadCount = unreadMap[conversation._id] ?? baseUnread;
                      
                      return (
                        <div
                          key={conversation._id}
                          onClick={() => {
                            setSelectedConversation(conversation);
                            setUnreadMap((prev) => ({ ...prev, [conversation._id]: 0 }));
                            router.push({ pathname: '/chat', query: { conversation: conversation._id } }, undefined, { shallow: true });
                          }}
                          className={`px-4 py-3 border-b cursor-pointer transition-colors duration-150 hover:bg-gray-50 flex items-center gap-3 ${
                            selectedConversation?._id === conversation._id ? 'bg-green-50/70' : ''
                          }`}
                        >
                          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-green-500/70 ring-offset-2 shadow-sm flex-shrink-0">
                            <img
                              src={otherUser?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                              alt={otherUser?.name || 'User avatar'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold truncate">{otherUser?.name}</h3>
                              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                {lastMessage?.createdAt ? new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className={`text-sm truncate ${unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                              {lastMessage?.content || 'No messages yet'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{conversation.skillTopic}</p>
                          </div>
                          {unreadCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-green-600 text-white text-xs font-semibold h-5 min-w-[1.25rem] px-1.5">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {filteredConversations.length === 0 && (
                      <div className="p-8 text-center text-gray-500">No conversations</div>
                    )}
                  </>
                )}
                {activeTab === 'people' && (
                  <>
                    {query && query.trim().length >= 2 ? (
                      <>
                        {peopleLoading && (
                          <div className="p-8 flex items-center justify-center text-gray-500">
                            <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></span>
                          </div>
                        )}
                        {!peopleLoading && people.map(person => {
                          const meCoords = getUserCoords(user);
                          const themCoords = getUserCoords(person);
                          const dist = meCoords && themCoords ? haversineKm(meCoords, themCoords) : null;
                          return (
                            <div
                              key={person._id}
                              onClick={() => startChat(person._id)}
                              className="px-4 py-3 border-b cursor-pointer transition-colors duration-150 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-green-500/30 ring-offset-2 shadow-sm flex-shrink-0">
                                <img
                                  src={person?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person?.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                                  alt={person?.name || 'User avatar'}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold truncate">
                                    <Link href={`/profile/${person._id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                      {person?.name}
                                    </Link>
                                  </h3>
                                  {person?.rating?.average > 0 && (
                                    <StarRating value={person.rating.average} count={person.rating.count} />
                                  )}
                                  {formatDistance(dist) && (
                                    <span className="text-xs text-gray-500">• {formatDistance(dist)} away</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 truncate">{person?.bio || 'Tap to start chatting'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Link href={`/profile/${person._id}`} onClick={(e) => e.stopPropagation()} className="text-gray-600 hover:text-gray-800 text-sm">
                                  View
                                </Link>
                                <button
                                  onClick={(e) => { e.stopPropagation(); startChat(person._id); }}
                                  className="text-green-700 hover:text-green-800 text-sm font-medium"
                                  aria-label={`Start chat with ${person?.name || 'user'}`}
                                >
                                  Start
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {!peopleLoading && people.length === 0 && (
                          <div className="p-8 text-center text-gray-500">No people found</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="px-4 py-2 text-xs uppercase tracking-wide text-gray-400">Suggested</div>
                        {suggestedLoading && (
                          <div className="p-8 flex items-center justify-center text-gray-500">
                            <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></span>
                          </div>
                        )}
                        {!suggestedLoading && suggested.map(person => {
                          const meCoords = getUserCoords(user);
                          const themCoords = getUserCoords(person);
                          const dist = meCoords && themCoords ? haversineKm(meCoords, themCoords) : null;
                          return (
                            <div
                              key={person._id}
                              onClick={() => startChat(person._id)}
                              className="px-4 py-3 border-b cursor-pointer transition-colors duration-150 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-green-500/30 ring-offset-2 shadow-sm flex-shrink-0">
                                <img
                                  src={person?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person?.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                                  alt={person?.name || 'User avatar'}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold truncate">
                                    <Link href={`/profile/${person._id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                      {person?.name}
                                    </Link>
                                  </h3>
                                  {person?.rating?.average > 0 && (
                                    <StarRating value={person.rating.average} count={person.rating.count} />
                                  )}
                                  {formatDistance(dist) && (
                                    <span className="text-xs text-gray-500">• {formatDistance(dist)} away</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 truncate">{person?.bio || 'Tap to start chatting'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Link href={`/profile/${person._id}`} onClick={(e) => e.stopPropagation()} className="text-gray-600 hover:text-gray-800 text-sm">
                                  View
                                </Link>
                                <button
                                  onClick={(e) => { e.stopPropagation(); startChat(person._id); }}
                                  className="text-green-700 hover:text-green-800 text-sm font-medium"
                                  aria-label={`Start chat with ${person?.name || 'user'}`}
                                >
                                  Start
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {!suggestedLoading && suggested.length === 0 && (
                          <div className="p-8 text-center text-gray-500">No suggestions available</div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Chat Window */}
            <div className="lg:col-span-8">
              {selectedConversation ? (
                <ChatWindow 
                  conversation={selectedConversation}
                  onClose={() => setSelectedConversation(null)}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">💬</div>
                    <p>Select a conversation to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}