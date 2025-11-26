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
        const res = await fetch(/api/reviews/stats?userId=);
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
    <div className='mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400'>
      <span className='text-amber-400'></span>
      <span className='font-medium text-slate-700 dark:text-slate-200'>{avg.toFixed ? avg.toFixed(1) : Number(avg).toFixed(1)}</span>
      <span className='text-slate-400'>({count})</span>
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
    return () => {
      es.close();
    };
  }, []);

  // Fetch suggested users if tab is people and query is empty
  useEffect(() => {
    if (activeTab === 'people' && !debouncedQuery.trim()) {
      fetchSuggested();
    }
  }, [activeTab, debouncedQuery]);

  // Fetch people search results
  useEffect(() => {
    if (activeTab === 'people' && debouncedQuery.trim()) {
      searchPeople(debouncedQuery);
    }
  }, [activeTab, debouncedQuery]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/conversations', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await response.json();
      if (response.ok) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnread = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/unread', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (res.ok) setUnreadMap(data.unreadCounts || {});
    } catch {}
  };

  const fetchSuggested = async () => {
    setSuggestedLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/search?limit=5', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (res.ok) setSuggested(data.users || []);
    } catch {}
    finally { setSuggestedLoading(false); }
  };

  const searchPeople = async (q) => {
    setPeopleLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(/api/users/search?q=, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (res.ok) setPeople(data.users || []);
    } catch {}
    finally { setPeopleLoading(false); }
  };

  const startConversation = async (participantId, skillTopic) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ participantId, skillTopic })
      });
      const data = await response.json();
      if (response.ok) {
        await fetchConversations();
        const conv = data.conversation;
        // find full conversation object from list if possible, else use returned
        const full = conversations.find(c => c._id === conv._id) || conv;
        setSelectedConversation(full);
        setActiveTab('chats');
        setQuery('');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Filter conversations by query
  const filteredConversations = useMemo(() => {
    if (!query.trim()) return conversations;
    const lower = query.toLowerCase();
    return conversations.filter(c => {
      const other = c.participants.find(p => p._id !== user.id);
      return other?.name?.toLowerCase().includes(lower) || c.skillTopic?.toLowerCase().includes(lower);
    });
  }, [conversations, query, user?.id]);

  // Handle hover for user preview
  const handleMouseEnter = (uid) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverUserId(uid);
  };
  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoverUserId(null), 300);
  };

  return (
    <div className='min-h-screen bg-slate-50 dark:bg-slate-950 pt-20 pb-10 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-7xl mx-auto h-[calc(100vh-8rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 flex'>
        
        {/* Sidebar */}
        <div className={${selectedConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10}>
          {/* Sidebar Header */}
          <div className='p-4 border-b border-slate-100 dark:border-slate-800'>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white mb-4'>Messages</h1>
            
            {/* Tabs */}
            <div className='flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4'>
              <button
                onClick={() => setActiveTab('chats')}
                className={lex-1 py-2 text-sm font-medium rounded-lg transition-all }
              >
                Chats
              </button>
              <button
                onClick={() => {
                  setActiveTab('people');
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className={lex-1 py-2 text-sm font-medium rounded-lg transition-all }
              >
                People
              </button>
            </div>

            {/* Search */}
            <div className='relative'>
              <input
                ref={searchInputRef}
                type='text'
                placeholder={activeTab === 'chats' ? 'Search conversations...' : 'Search people...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none'
              />
              <svg className='w-5 h-5 text-slate-400 absolute left-3 top-2.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' /></svg>
            </div>
          </div>

          {/* List Content */}
          <div className='flex-1 overflow-y-auto custom-scrollbar'>
            {activeTab === 'chats' ? (
              // Chats List
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
                  filteredConversations.map((conv) => {
                    const other = conv.participants.find(p => p._id !== user.id);
                    const unread = unreadMap[conv._id] || 0;
                    const isSelected = selectedConversation?._id === conv._id;
                    
                    return (
                      <div
                        key={conv._id}
                        onClick={() => setSelectedConversation(conv)}
                        className={p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 }
                      >
                        <div className='flex items-start gap-3'>
                          <div className='relative'>
                            <div className='w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm'>
                              {other?.name?.charAt(0)}
                            </div>
                            {isOnline(other) && (
                              <span className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full'></span>
                            )}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='flex justify-between items-baseline mb-1'>
                              <h3 className={ont-semibold truncate }>
                                {other?.name}
                              </h3>
                              {conv.lastMessage && (
                                <span className='text-xs text-slate-400 whitespace-nowrap ml-2'>
                                  {new Date(conv.lastMessage.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div className='flex justify-between items-center'>
                              <p className={	ext-sm truncate pr-2 }>
                                {conv.lastMessage ? (
                                  <>
                                    {conv.lastMessage.sender === user.id && <span className='text-slate-400 mr-1'>You:</span>}
                                    {conv.lastMessage.content}
                                  </>
                                ) : (
                                  <span className='italic text-slate-400'>No messages yet</span>
                                )}
                              </p>
                              {unread > 0 && (
                                <span className='min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center'>
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
              // People List
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
                              <div className='w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold'>
                                {u.name.charAt(0)}
                              </div>
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
                      <p className='text-sm text-slate-500 italic'>No users found matching '{query}'.</p>
                    ) : (
                      <div className='space-y-3'>
                        {people.map(u => (
                          <div key={u._id} className='bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:shadow-md transition-all'>
                            <div className='flex items-center gap-3'>
                              <div className='w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold'>
                                {u.name.charAt(0)}
                              </div>
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

        {/* Main Chat Area */}
        <div className={lex-1 flex flex-col bg-slate-50 dark:bg-slate-950 }>
          {selectedConversation ? (
            <ChatWindow 
              conversation={selectedConversation} 
              onClose={() => setSelectedConversation(null)} 
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
  );
}
