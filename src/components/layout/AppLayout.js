import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import LogoutButton from './LogoutButton';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../ui/Button';

export default function AppLayout({ children }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const reconnectRef = useRef({ timeout: 1000 });
  const [sseDisconnected, setSseDisconnected] = useState(false);
  const esRef = useRef(null);
  const navLinks = [
    { href: '/', label: 'Home', exact: true },
    { href: '/search', label: 'Search' },
    { href: '/dashboard', label: 'Dashboard', auth: true },
    { href: '/dashboard/reviews', label: 'My Reviews', auth: true },
    { href: '/chat', label: 'Chat', auth: true },
  ];

  const isActive = (href, exact = false) => {
    if (exact) return router.pathname === href;
    return router.pathname.startsWith(href);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setHasUnread(false);
      setUnreadCount(0);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }
    // Fetch precise unread initially
    fetch('/api/chat/unread')
      .then(r => r.ok ? r.json() : { total: 0 })
      .then(d => { if (typeof d?.total === 'number') { setHasUnread(d.total > 0); setUnreadCount(Math.min(99, d.total)); }})
      .catch(() => {});

    const url = `/api/events/stream`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;
    es.onmessage = () => {};
    es.addEventListener('ready', () => {
      setSseDisconnected(false);
    });
    es.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.conversationId) {
          // fetch precise on message to stay accurate
          fetch('/api/chat/unread')
            .then(r => r.ok ? r.json() : { total: 0 })
            .then(d => { if (typeof d?.total === 'number') { setHasUnread(d.total > 0); setUnreadCount(Math.min(99, d.total)); }})
            .catch(() => { setHasUnread(true); setUnreadCount((c) => Math.min(99, c + 1)); });
        }
      } catch {}
    });
    es.addEventListener('conversation-start', () => {
      fetch('/api/chat/unread')
        .then(r => r.ok ? r.json() : { total: 0 })
        .then(d => { if (typeof d?.total === 'number') { setHasUnread(d.total > 0); setUnreadCount(Math.min(99, d.total)); }})
        .catch(() => { setHasUnread(true); setUnreadCount((c) => Math.min(99, c + 1)); });
    });
    es.onerror = () => {
      // exponential backoff reconnect
      es.close();
      esRef.current = null;
      const delay = reconnectRef.current.timeout;
      const next = Math.min(delay * 2, 30000);
      reconnectRef.current.timeout = next;
      setSseDisconnected(true);
      setTimeout(() => {
        if (isAuthenticated && !esRef.current) {
          setHasUnread((v) => v); // trigger effect rerun by state change
        }
      }, delay);
    };
    return () => {
      es.close();
      esRef.current = null;
      reconnectRef.current.timeout = 1000;
      setSseDisconnected(false);
    };
  }, [isAuthenticated]);

  // Clear unread when navigating to chat
  useEffect(() => {
    if (router.pathname.startsWith('/chat')) {
      setHasUnread(false);
      setUnreadCount(0);
    }
  }, [router.pathname]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 transition-colors duration-500 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-80 mix-blend-screen dark:mix-blend-lighten">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-300/40 via-sky-400/30 to-purple-400/30 blur-3xl" />
        <div className="absolute top-16 right-[-18%] h-[28rem] w-[26rem] rounded-full bg-gradient-to-br from-sky-500/25 via-emerald-400/20 to-purple-500/20 blur-[140px] animate-float" />
        <div className="absolute bottom-[-18%] left-[-14%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-purple-400/18 via-sky-400/16 to-emerald-400/22 blur-[130px]" />
      </div>
      {/* Top Nav */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/55 dark:border-slate-900/70 dark:bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-6">
            <div className="flex items-center gap-6 lg:gap-8">
              <Link href="/" className="group relative flex items-center text-2xl font-semibold tracking-tight">
                <span className="font-display bg-gradient-to-r from-emerald-500 via-sky-500 to-purple-500 bg-clip-text text-transparent transition duration-300 group-hover:drop-shadow-glow">
                  SkillSwap
                </span>
                <span className="pointer-events-none absolute -inset-x-2 -bottom-2 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
              <nav className="hidden md:flex items-center gap-2">
                {navLinks.map((l) => (
                  (!l.auth || isAuthenticated) && (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`group relative inline-flex items-center gap-1 overflow-hidden rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] transition-all duration-200 ${
                        isActive(l.href, l.exact)
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      <span className="relative z-[1] inline-flex items-center gap-1">
                        {l.href === '/dashboard/reviews' ? (
                          <>
                            <span aria-hidden>⭐</span>
                            <span>{l.label}</span>
                          </>
                        ) : (
                          l.label
                        )}
                        {l.href === '/chat' && hasUnread && (
                          <span className="relative -mr-3 inline-flex">
                            <span className="absolute -top-3 -right-2 inline-flex min-h-[18px] min-w-[18px] translate-x-1/2 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-soft">
                              {unreadCount > 0 ? unreadCount : '•'}
                            </span>
                          </span>
                        )}
                      </span>
                      <span
                        aria-hidden
                        className={`absolute inset-0 rounded-full transition-all duration-300 ${
                          isActive(l.href, l.exact)
                            ? 'bg-gradient-to-r from-emerald-300/30 via-sky-300/30 to-purple-300/25 shadow-aurora'
                            : 'bg-transparent group-hover:bg-slate-100/70 dark:group-hover:bg-slate-800/60'
                        }`}
                      />
                    </Link>
                  )
                ))}
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2 group"
                    title="Edit Profile"
                  >
                    <span className="relative inline-flex h-10 w-10 overflow-hidden rounded-full ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-soft transition-transform duration-200 group-hover:scale-105 dark:ring-offset-slate-900">
                      <img
                        src={user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0ea5e9&color=fff&size=128&bold=true`}
                        alt={user?.name || 'User avatar'}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="text-sm font-medium text-slate-600 transition-colors group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                      {user?.name}
                    </span>
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    href="/auth/login"
                    variant="ghost"
                    className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  >
                    Login
                  </Button>
                  <Button href="/auth/register" className="px-5 py-2 text-sm font-semibold">
                    Sign Up Free
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Toggle Menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
            <div className="space-y-1 px-4 py-3">
              {navLinks.map((l) => (
                (!l.auth || isAuthenticated) && (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.26em] ${
                      isActive(l.href, l.exact)
                        ? 'bg-gradient-to-r from-emerald-300/40 via-sky-300/30 to-purple-300/30 text-emerald-700 dark:text-emerald-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {l.href === '/dashboard/reviews' ? (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>⭐</span>
                        <span>{l.label}</span>
                      </span>
                    ) : (
                      l.label
                    )}
                  </Link>
                )
              ))}
              <div className="px-3 pt-2 pb-4">
                {isAuthenticated ? (
                  <LogoutButton className="w-full justify-center" />
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      href="/auth/login"
                      variant="ghost"
                      className="flex-1 justify-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
                    >
                      Login
                    </Button>
                    <Button href="/auth/register" className="flex-1 justify-center py-2 text-sm font-semibold">
                      Sign Up
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 text-slate-900 dark:text-slate-100">
        <div className="pointer-events-none absolute -top-24 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-300/40 to-sky-400/30 blur-3xl" />
        {sseDisconnected && (
          <div className="mb-4 flex items-center gap-3 rounded-full border border-amber-200/70 bg-amber-50/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-700 shadow-soft backdrop-blur-sm dark:border-amber-600/30 dark:bg-amber-900/20 dark:text-amber-200">
            <svg className="h-3 w-3 animate-spin text-amber-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Reconnecting to live updates…
          </div>
        )}
        {children}
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/40 bg-white/70 py-8 backdrop-blur-xl dark:border-slate-900/70 dark:bg-slate-950/70">
        <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
            Crafted for neighborhoods — © {new Date().getFullYear()} SkillSwap
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/search" className="transition-colors hover:text-slate-700 dark:hover:text-slate-200">Explore</Link>
            <Link href="/dashboard" className="transition-colors hover:text-slate-700 dark:hover:text-slate-200">Dashboard</Link>
            {isAuthenticated && (
              <Link href="/dashboard/reviews" className="transition-colors hover:text-slate-700 dark:hover:text-slate-200">My Reviews</Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
