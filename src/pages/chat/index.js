import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import ChatWindow from '../../components/chat/ChatWindow';
import { resolveAvatarUrl } from '../../lib/avatar';

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
          setRatingCache(prev => ({
            ...prev,
            [uid]: {
              average: data.average || 0,
              count: data.count || 0
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load rating stats', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [uid, cached, setRatingCache]);

  const avg = cached?.average ?? user?.rating?.average ?? 0;
  const count = cached?.count ?? user?.rating?.count ?? 0;

  return (
    <div className='mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400'>
      <span className='text-amber-400'>{loading ? '…' : '★'}</span>
      <span className='font-medium text-slate-700 dark:text-slate-200'>
        {Number.isFinite(avg) ? Number(avg).toFixed(1) : '0.0'}
      </span>
      <span className='text-slate-400'>({count || 0})</span>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  useRequireAuth();

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [ratingCache, setRatingCache] = useState({});
  const [listFilter, setListFilter] = useState('all');
  const searchInputRef = useRef(null);
  const esRef = useRef(null);
  const refreshInFlightRef = useRef(false);

  const filterChips = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' }
  ];

  const dockItems = [
    {
      id: 'chats',
      label: 'Chats',
      icon: (
        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M8 12h.01M12 12h.01M16 12h.01M5 20l1.4-3.5A8 8 0 1119 12c0 4.418-4.03 8-9 8a9.8 9.8 0 01-4.25-.95L5 20z' />
        </svg>
      ),
      action: () => setActiveTab('chats')
    },
    {
      id: 'people',
      label: 'People',
      icon: (
        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zm9 9v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' />
        </svg>
      ),
      action: () => {
        setActiveTab('people');
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M3 13h8V3H3zm10 8h8v-8h-8zM3 21h8v-6H3zm10-10h8V3h-8z' />
        </svg>
      ),
      action: () => router.push('/dashboard')
    }
  ];

  const isOnline = (participant) => {
    if (!participant?.lastActive) return false;
    try {
      const last = new Date(participant.lastActive).getTime();
      return Date.now() - last < 5 * 60 * 1000;
    } catch (_) {
      return false;
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    refreshChatState();
  }, []);

  useAutoRefresh(120000);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const es = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;
    const refresh = () => {
      refreshChatState();
    };
    es.addEventListener('ready', refresh);
    es.addEventListener('message', refresh);
    es.addEventListener('conversation-start', refresh);
    es.addEventListener('read', refresh);
    return () => {
      es.removeEventListener('ready', refresh);
      es.removeEventListener('message', refresh);
      es.removeEventListener('conversation-start', refresh);
      es.removeEventListener('read', refresh);
      es.close();
    };
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshChatState();
      }
    };

    const intervalId = setInterval(() => {
      refreshChatState();
    }, 7000);

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'people' && !debouncedQuery.trim()) {
      fetchSuggested();
    }
  }, [activeTab, debouncedQuery]);

  useEffect(() => {
    if (activeTab === 'people' && debouncedQuery.trim()) {
      searchPeople(debouncedQuery);
    }
  }, [activeTab, debouncedQuery]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const nextConversations = data.conversations || [];
        setConversations(nextConversations);
        setSelectedConversation(prev => {
          if (!prev?._id) return prev;
          const refreshed = nextConversations.find(c => c._id === prev._id);
          return refreshed || prev;
        });
      }
    } catch (error) {
      console.error('Error fetching conversations', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnread = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/unread', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUnreadMap(data.unreadCounts || data.perConversation || {});
    } catch (error) {
      console.error('Error fetching unread counts', error);
    }
  };

  const refreshChatState = async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      await Promise.all([fetchConversations(), fetchUnread()]);
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  const fetchSuggested = async () => {
    setSuggestedLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/search?limit=5', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSuggested(data.users || []);
    } catch (error) {
      console.error('Error fetching suggested users', error);
    } finally {
      setSuggestedLoading(false);
    }
  };

  const searchPeople = async (q) => {
    setPeopleLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPeople(data.users || []);
    } catch (error) {
      console.error('Error searching people', error);
    } finally {
      setPeopleLoading(false);
    }
  };

  const startConversation = async (participantId, skillTopic) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ participantId, skillTopic })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchConversations();
        setSelectedConversation(prev => {
          const existing = conversations.find(c => c._id === data.conversation._id);
          return existing || data.conversation;
        });
        setActiveTab('chats');
        setQuery('');
      }
    } catch (error) {
      console.error('Error starting conversation', error);
    }
  };

  const filteredConversations = useMemo(() => {
    let base = conversations;
    if (listFilter === 'unread') {
      base = base.filter(conv => (unreadMap[conv._id] || 0) > 0);
    }
    if (!query.trim()) return base;
    const lower = query.toLowerCase();
    return base.filter(conv => {
      const other = conv.participants.find(p => p._id !== user?.id);
      return (
        other?.name?.toLowerCase().includes(lower) ||
        conv.skillTopic?.toLowerCase().includes(lower)
      );
    });
  }, [conversations, listFilter, query, unreadMap, user?.id]);

  const onlineUsers = useMemo(() => {
    const unique = new Map();
    conversations.forEach(conv => {
      const other = conv.participants.find(p => p._id !== user?.id);
      if (other && isOnline(other)) unique.set(other._id, other);
    });
    return Array.from(unique.values());
  }, [conversations, user?.id]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadMap).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
  }, [unreadMap]);

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950 pt-20 pb-10 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-7xl mx-auto h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex bg-white dark:bg-slate-900 overflow-hidden'>
        <div className='hidden lg:flex w-20 flex-col items-center justify-between py-6 bg-slate-900 border-r border-slate-800 text-white'>
          <div className='w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-bold text-lg'>
            HS
          </div>
          <nav className='flex-1 flex flex-col items-center gap-4 mt-10'>
            {dockItems.map(item => (
              <button
                key={item.id}
                onClick={item.action}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${item.id === activeTab ? 'bg-white/20 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                title={item.label}
              >
                {item.icon}
              </button>
            ))}
          </nav>
          <button
            onClick={() => router.push('/dashboard/profile')}
            className='w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-lg font-semibold overflow-hidden'
            title='Profile'
          >
            <img
              src={resolveAvatarUrl(user, { fallbackName: user?.name || 'User', size: 96 })}
              alt={user?.name || 'User avatar'}
              className='w-full h-full object-cover'
            />
          </button>
        </div>

        <div className='flex-1 flex overflow-hidden'>
          <div className={`${selectedConversation ? 'hidden xl:flex' : 'flex'} w-full xl:w-[26rem] flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10`}>
            <div className='p-5 border-b border-slate-100 dark:border-slate-800 space-y-4'>
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <p className='text-[11px] uppercase tracking-[0.3em] text-slate-400'>Messenger</p>
                  <div className='flex items-center gap-2'>
                    <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>Chat Center</h1>
                    {user?.name && (
                      <span className='text-xs text-slate-500 dark:text-slate-400'>· {user.name.split(' ')[0]}</span>
                    )}
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => {
                      setActiveTab('people');
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className='w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors flex items-center justify-center'
                    title='New chat'
                  >
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' /></svg>
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/settings')}
                    className='w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center'
                    title='Settings'
                  >
                    <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M11.049 2.927c.3-.921 1.603-.921 1.902 0a1 1 0 00.95.69h1.518a1 1 0 01.98.804l.285 1.427a1 1 0 00.543.69l1.302.651a1 1 0 01.464 1.347l-.6 1.2a1 1 0 000 .894l.6 1.2a1 1 0 01-.464 1.347l-1.302.65a1 1 0 00-.543.69l-.285 1.428a1 1 0 01-.98.803h-1.518a1 1 0 00-.95.69c-.3.922-1.603.922-1.902 0a1 1 0 00-.95-.69H8.58a1 1 0 01-.98-.804l-.285-1.427a1 1 0 00-.543-.69l-1.302-.651a1 1 0 01-.464-1.347l.6-1.2a1 1 0 000-.894l-.6-1.2a1 1 0 01.464-1.347l1.302-.65a1 1 0 00.543-.69l.285-1.428a1 1 0 01.98-.803h1.518c.428 0 .81-.282.95-.69z' /></svg>
                  </button>
                </div>
              </div>

              <div className='flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl'>
                <button
                  onClick={() => setActiveTab('chats')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'chats' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Chats
                </button>
                <button
                  onClick={() => {
                    setActiveTab('people');
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-2xl transition-all ${activeTab === 'people' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  People
                </button>
              </div>

              <div className='relative'>
                <input
                  ref={searchInputRef}
                  type='text'
                  placeholder={activeTab === 'chats' ? 'Search conversations...' : 'Search people...'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className='w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none'
                />
                <svg className='w-5 h-5 text-slate-400 absolute left-4 top-2.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' /></svg>
              </div>

              {activeTab === 'chats' && (
                <div className='flex flex-wrap gap-2'>
                  {filterChips.map(chip => (
                    <button
                      key={chip.id}
                      onClick={() => setListFilter(chip.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${listFilter === chip.id ? 'bg-slate-900 text-white dark:bg-white/10 dark:text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                      {chip.label}
                      {chip.id === 'unread' && totalUnreadCount > 0 && (
                        <span className='px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 text-[11px] font-bold'>
                          {totalUnreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'chats' && onlineUsers.length > 0 && !query && (
              <div className='px-4 py-3 overflow-x-auto custom-scrollbar flex gap-3 border-b border-slate-100 dark:border-slate-800/50 shrink-0'>
                {onlineUsers.map(u => (
                  <button
                    key={u._id}
                    className='flex flex-col items-center gap-1 min-w-[56px] cursor-pointer group'
                    onClick={() => {
                      const conv = conversations.find(c => c.participants.some(p => p._id === u._id));
                      if (conv) setSelectedConversation(conv);
                    }}
                  >
                    <div className='relative'>
                      <img
                        src={resolveAvatarUrl(u, { fallbackName: u?.name || 'User', size: 128 })}
                        alt={u?.name || 'User avatar'}
                        className='w-12 h-12 rounded-full object-cover shadow-sm ring-2 ring-transparent group-hover:ring-emerald-400 transition-all'
                      />
                      <span className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full'></span>
                    </div>
                    <span className='text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[60px]'>
                      {u.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className='flex-1 overflow-y-auto custom-scrollbar'>
              {activeTab === 'chats' ? (
                <div className='divide-y divide-slate-100 dark:divide-slate-800/50'>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className='p-4 animate-pulse flex gap-3'>
                        <div className='w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full' />
                        <div className='flex-1 space-y-2 py-1'>
                          <div className='h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3' />
                          <div className='h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4' />
                        </div>
                      </div>
                    ))
                  ) : filteredConversations.length === 0 ? (
                    <div className='p-8 text-center text-slate-500 dark:text-slate-400'>
                      <div className='w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4'>
                        <svg className='w-8 h-8 text-slate-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' /></svg>
                      </div>
                      <p>No conversations found.</p>
                      <button onClick={() => setActiveTab('people')} className='mt-2 text-emerald-600 hover:text-emerald-700 font-medium text-sm'>Start a new chat</button>
                    </div>
                  ) : (
                    filteredConversations.map(conv => {
                      const other = conv.participants.find(p => p._id !== user?.id);
                      const unread = unreadMap[conv._id] || 0;
                      const isSelected = selectedConversation?._id === conv._id;

                      return (
                        <div
                          key={conv._id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                        >
                          <div className='flex items-start gap-3'>
                            <div className='relative'>
                              <img
                                src={resolveAvatarUrl(other, { fallbackName: other?.name || 'User', size: 128 })}
                                alt={other?.name || 'User avatar'}
                                className='w-12 h-12 rounded-full object-cover shadow-sm'
                              />
                              {isOnline(other) && (
                                <span className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full'></span>
                              )}
                            </div>
                            <div className='flex-1 min-w-0'>
                              <div className='flex justify-between items-baseline mb-1'>
                                <h3 className={`font-semibold truncate ${unread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {other?.name}
                                </h3>
                                {conv.lastMessage && (
                                  <span className='text-xs text-slate-400 whitespace-nowrap ml-2'>
                                    {new Date(conv.lastMessage.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <div className='flex justify-between items-center gap-2'>
                                <p className={`text-sm truncate ${unread ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {conv.lastMessage ? (
                                    <>
                                      {conv.lastMessage.sender === user?.id && <span className='text-slate-400 mr-1'>You:</span>}
                                      {conv.lastMessage.content}
                                    </>
                                  ) : (
                                    <span className='italic text-slate-400'>No messages yet</span>
                                  )}
                                </p>
                                {unread > 0 && (
                                  <span className='min-w-[1.5rem] h-6 px-2 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center'>
                                    {unread}
                                  </span>
                                )}
                              </div>
                              {conv.skillTopic && (
                                <div className='mt-1.5'>
                                  <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'>
                                    {conv.skillTopic}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className='p-4 space-y-4'>
                  {activeTab === 'people' && !debouncedQuery.trim() && (
                    <div className='mb-2'>
                      <h3 className='text-xs font-bold text-slate-400 uppercase tracking-wider mb-3'>Suggested</h3>
                      {suggestedLoading ? (
                        <div className='space-y-3'>
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className='h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse' />
                          ))}
                        </div>
                      ) : suggested.length === 0 ? (
                        <p className='text-sm text-slate-500 italic'>No suggestions available.</p>
                      ) : (
                        <div className='space-y-3'>
                          {suggested.map(u => (
                            <div key={u._id} className='group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:shadow-md transition-all'>
                              <div className='flex items-center gap-3'>
                                <img
                                  src={resolveAvatarUrl(u, { fallbackName: u?.name || 'User', size: 96 })}
                                  alt={u?.name || 'User avatar'}
                                  className='w-10 h-10 rounded-full object-cover'
                                />
                                <div className='flex-1 min-w-0'>
                                  <h4 className='font-medium text-slate-900 dark:text-white truncate'>{u.name}</h4>
                                  <HoverRatingRow user={u} ratingCache={ratingCache} setRatingCache={setRatingCache} />
                                </div>
                                <button
                                  onClick={() => startConversation(u._id, u.skills?.[0]?.name || 'General')}
                                  className='p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors'
                                  title='Start chat'
                                >
                                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' /></svg>
                                </button>
                              </div>
                              {u.skills?.length > 0 && (
                                <div className='mt-2 flex flex-wrap gap-1'>
                                  {u.skills.slice(0, 3).map(s => (
                                    <span key={s.name} className='text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded'>
                                      {s.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {debouncedQuery.trim() && (
                    <div>
                      <h3 className='text-xs font-bold text-slate-400 uppercase tracking-wider mb-3'>Search Results</h3>
                      {peopleLoading ? (
                        <div className='space-y-3'>
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className='h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse' />
                          ))}
                        </div>
                      ) : people.length === 0 ? (
                        <p className='text-sm text-slate-500 italic'>No users found matching &apos;{query}&apos;.</p>
                      ) : (
                        <div className='space-y-3'>
                          {people.map(u => (
                            <div key={u._id} className='bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:shadow-md transition-all'>
                              <div className='flex items-center gap-3'>
                                <img
                                  src={resolveAvatarUrl(u, { fallbackName: u?.name || 'User', size: 96 })}
                                  alt={u?.name || 'User avatar'}
                                  className='w-10 h-10 rounded-full object-cover'
                                />
                                <div className='flex-1 min-w-0'>
                                  <h4 className='font-medium text-slate-900 dark:text-white truncate'>{u.name}</h4>
                                  <p className='text-xs text-slate-500 truncate'>{u.bio || 'No bio available'}</p>
                                </div>
                                <button
                                  onClick={() => startConversation(u._id, u.skills?.[0]?.name || 'General')}
                                  className='px-3 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-full hover:bg-emerald-600 transition-colors shadow-sm'
                                >
                                  Message
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`${selectedConversation ? 'flex' : 'hidden lg:flex'} flex-1 flex flex-col bg-slate-50 dark:bg-slate-950`}>
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                onClose={() => setSelectedConversation(null)}
                onConversationActivity={refreshChatState}
              />
            ) : (
              <div className='flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center'>
                <div className='w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner'>
                  <svg className='w-12 h-12 text-slate-300 dark:text-slate-700' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' /></svg>
                </div>
                <h2 className='text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2'>Select a conversation</h2>
                <p className='max-w-xs text-sm text-slate-500'>Choose a chat from the list or start a new one to begin messaging.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
