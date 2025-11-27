import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import MetricCard from '../../components/ui/MetricCard';
import InteractiveCard from '../../components/ui/InteractiveCard';
import GradientPill from '../../components/ui/GradientPill';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';
import TopUpModal from '../../components/payments/TopUpModal';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [stats, setStats] = useState({
    skillsOffered: 0,
    skillsNeeded: 0,
    credits: 0,
    rating: 0,
    pendingTransactions: 0,
    completedTransactions: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityFilter, setActivityFilter] = useState('all');
  const [reviewsSummary, setReviewsSummary] = useState({ count: 0, last: null });
  
  const router = useRouter();
  useRequireAuth();
  const { addToast } = useToast();

  // Auto refresh dashboard data every 90s (shallow)
  useAutoRefresh(90000);

  // Open TopUp modal if navigated with a query (?topup=1&need=10)
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.topup) {
      setTopUpOpen(true);
    }
  }, [router.isReady, router.query.topup]);

  useEffect(() => {
    if (user) {
      updateStats();
      fetchRecentActivity();
    }
  }, [user]);

  // Initialize activity filter from URL
  useEffect(() => {
    if (!router.isReady) return;
    const f = router.query.filter;
    if (typeof f === 'string' && ['all','pending','confirmed','in-progress','completed'].includes(f)) {
      setActivityFilter(f);
    }
  }, [router.isReady, router.query.filter]);

  // Keep URL in sync with current filter (shallow)
  useEffect(() => {
    if (!router.isReady) return;
    const nextQuery = { ...router.query, filter: activityFilter };
    router.push({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [activityFilter]);

  const updateStats = () => {
    setStats({
      skillsOffered: user.skillsOffered?.length || 0,
      skillsNeeded: user.skillsNeeded?.length || 0,
      credits: user.credits || 0,
      rating: user.rating?.average || 0,
      pendingTransactions: 0, // Will be updated from API
      completedTransactions: 0 // Will be updated from API
    });
  };

  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions?status=all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.transactions.slice(0, 5));
        
        // Update transaction stats
        setStats(prev => ({
          ...prev,
          pendingTransactions: data.categorized.pending.length,
          completedTransactions: data.categorized.completed.length
        }));

        // Fetch reviews summary in parallel (best-effort)
        fetchReviewsSummary().catch(() => {});
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
      addToast({ type: 'error', title: 'Failed to load activity' });
    }
    setLoadingActivity(false);
  };

  const fetchReviewsSummary = async () => {
    try {
      const res = await fetch(`/api/reviews?userId=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const last = data.reviews?.[0] || null;
      setReviewsSummary({ count: data.reviews?.length || 0, last });
    } catch (e) {
      // Ignore errors on summary
    }
  };

  const getTransactionStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-200',
      confirmed: 'bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/20 dark:bg-sky-500/20 dark:text-sky-200',
      'in-progress': 'bg-purple-500/15 text-purple-600 ring-1 ring-purple-500/20 dark:bg-purple-500/20 dark:text-purple-200',
      completed: 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-200',
      cancelled: 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-500/20 dark:text-rose-200'
    };
    return colors[status] || 'bg-slate-500/10 text-slate-500';
  };

  const formatTransactionType = (transaction, currentUserId) => {
    if (transaction.provider._id === currentUserId) {
      return `You provided ${transaction.skill?.name || 'a service'}`;
    } else {
      return `You received ${transaction.skill?.name || 'a service'}`;
    }
  };

  const getOtherUser = (transaction, currentUserId) => {
    return transaction.provider._id === currentUserId 
      ? transaction.receiver 
      : transaction.provider;
  };

  const startChat = async (otherUserId, skillName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: otherUserId,
          skillTopic: skillName || 'Skill Exchange',
          initialMessage: `Hi! I'd like to follow up on ${skillName || 'our exchange'}.`
        })
      });
      const data = await response.json();
      if (response.ok) {
        addToast({ type: 'success', title: 'Conversation started' });
        router.push(`/chat?conversation=${data.conversation._id}`);
      } else {
        addToast({ type: 'error', title: 'Could not start chat', message: data.message });
      }
    } catch (e) {
      console.error('startChat error', e);
      addToast({ type: 'error', title: 'Chat error', message: 'Please try again.' });
    }
  };

  const filteredActivity = recentActivity.filter((tx) => {
    if (activityFilter === 'all') return true;
    return tx.status === activityFilter;
  });

  const metricCards = useMemo(() => ([
    {
      key: 'offered',
      icon: '💼',
      label: 'Skills Offered',
      value: loadingActivity ? <Skeleton className="h-8 w-12 rounded-full bg-slate-200/70" /> : stats.skillsOffered,
      helpText: 'Keep your list fresh so neighbors know how you can help.',
      onClick: () => router.push('/dashboard/skills'),
    },
    {
      key: 'needed',
      icon: '🎯',
      label: 'Skills Needed',
      value: loadingActivity ? <Skeleton className="h-8 w-12 rounded-full bg-slate-200/70" /> : stats.skillsNeeded,
      helpText: 'Share what you\'re looking for to surface better matches.',
      onClick: () => router.push('/dashboard/skills'),
    },
    {
      key: 'pending',
      icon: '⏳',
      label: 'Pending Exchanges',
      value: loadingActivity ? <Skeleton className="h-8 w-16 rounded-full bg-slate-200/70" /> : stats.pendingTransactions,
      helpText: 'Follow up on swaps that are waiting for a response.',
      onClick: () => router.push('/dashboard/transactions?status=pending'),
    },
    {
      key: 'rating',
      icon: '⭐',
      label: 'Community Rating',
      value: loadingActivity ? <Skeleton className="h-8 w-16 rounded-full bg-slate-200/70" /> : `${Number(stats.rating || 0).toFixed(1)} / 5`,
      helpText: 'Reviews build trust—ask partners to leave feedback.',
      onClick: () => router.push(`/profile/${user?.id || user?._id}#reviews`),
    },
  ]), [loadingActivity, router, stats.pendingTransactions, stats.rating, stats.skillsNeeded, stats.skillsOffered, user?.id, user?._id]);

  const quickActions = useMemo(() => ([
    {
      href: '/search',
      icon: '🔍',
      title: 'Discover Neighbors',
      description: 'Search for people nearby who can teach or trade skills.',
      accent: 'from-emerald-400/20 to-sky-400/20',
    },
    {
      href: '/dashboard/skills',
      icon: '🛠️',
      title: 'Manage Skills',
      description: 'Keep your offerings and wish-list aligned with your goals.',
      accent: 'from-sky-400/20 to-purple-400/20',
    },
    {
      href: '/dashboard/profile',
      icon: '👤',
      title: 'Refresh Profile',
      description: 'Update your bio, photo, and distance preferences.',
      accent: 'from-purple-400/20 to-rose-400/20',
    },
    {
      href: '/chat',
      icon: '💬',
      title: 'Open Messages',
      description: 'Pick up conversations and keep swaps moving.',
      accent: 'from-emerald-400/20 to-purple-400/20',
    },
    {
      href: '/dashboard/transactions',
      icon: '📋',
      title: 'Track Exchanges',
      description: 'Review history, confirm progress, and complete trades.',
      accent: 'from-amber-400/25 to-emerald-400/20',
    },
    {
      href: '/dashboard/favorites',
      icon: '♥',
      title: 'Saved Providers',
      description: 'Revisit your bookmarked neighbors for quick follow-ups.',
      accent: 'from-rose-400/25 to-purple-400/20',
    },
  ]), []);

  if (loading || !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
        <LoadingSpinner size="large" />
        <p className="copy-subtle text-soft">Loading your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Control Center"
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'neighbor'}!`}
        subtitle="Track your swaps, polish your profile, and keep the momentum going."
        actions={(
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <GradientPill className="bg-white/80 text-slate-600 shadow-soft dark:bg-slate-900/70 dark:text-slate-200">
              <span className="text-[10px] tracking-[0.5em] text-emerald-600 dark:text-emerald-200">Credits</span>
              <span className="text-xs font-semibold tracking-normal text-slate-700 dark:text-slate-100">{stats.credits}</span>
              <span className="text-[11px] text-slate-400">⏱️</span>
            </GradientPill>
            <Button
              type="button"
              variant="secondary"
              className="px-5 py-2 text-sm font-semibold"
              onClick={() => setTopUpOpen(true)}
            >
              Add credits
            </Button>
            <Button
              href="/dashboard/profile"
              variant="secondary"
              className="px-5 py-2 text-sm font-semibold"
            >
              Edit profile
            </Button>
          </div>
        )}
      />

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            className="text-left"
          >
            <MetricCard icon={card.icon} label={card.label} value={card.value} helpText={card.helpText} />
          </button>
        ))}
      </section>

      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        initialCredits={Number(router.query.need) || 10}
      />

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => (
          <Link key={action.title} href={action.href} className="block">
            <InteractiveCard className="h-full transition hover:-translate-y-1 hover:shadow-elevated">
              <div className={`pointer-events-none absolute right-0 top-0 h-full w-40 translate-x-1/3 bg-gradient-to-br opacity-60 blur-3xl ${action.accent}`} />
              <div className="relative z-[1] flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-inner dark:bg-slate-900/60">
                  {action.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-semibold text-strong">{action.title}</h3>
                  <p className="copy-subtle text-soft">{action.description}</p>
                </div>
              </div>
            </InteractiveCard>
          </Link>
        ))}
        <InteractiveCard highlight className="h-full p-0 xl:col-span-3">
          <div className="flex flex-col justify-between gap-6 rounded-[calc(theme(borderRadius.3xl)-2px)] bg-gradient-to-br from-emerald-400/20 via-sky-400/20 to-purple-400/20 p-8 text-slate-900 dark:text-slate-100 dark:from-emerald-500/15 dark:via-sky-500/15 dark:to-purple-500/15 md:flex-row md:items-center">
            <div className="space-y-2">
              <GradientPill className="bg-white/20 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100">
                Community kudos
              </GradientPill>
              <h3 className="font-display text-2xl font-semibold text-strong">You&apos;ve completed {stats.completedTransactions} exchanges</h3>
              <p className="copy-subtle text-soft">Your skills are making a real impact. Keep sharing and your reputation (and credits) will keep climbing.</p>
            </div>
            <Button
              type="button"
              onClick={() => router.push('/dashboard/transactions')}
              className="whitespace-nowrap"
              size="sm"
            >
              View timeline
            </Button>
          </div>
        </InteractiveCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <InteractiveCard className="xl:col-span-2 p-0">
          <div className="flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.3xl)-2px)]">
            <div className="flex flex-col gap-2 border-b border-white/60 bg-white/60 px-6 py-5 dark:border-slate-800/60 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold text-strong">Recent activity</h3>
                <p className="copy-subtle text-soft">Tap a swap to revisit the conversation or leave a review.</p>
              </div>
              {recentActivity.length > 0 && (
                <Link href="/dashboard/transactions" className="text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-200">
                  View all
                </Link>
              )}
            </div>
            <div className="border-b border-white/60 bg-white/40 px-6 py-3 dark:border-slate-800/60 dark:bg-slate-900/40">
              <div className="flex flex-wrap gap-2">
                {['all','pending','confirmed','in-progress','completed'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActivityFilter(status)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${activityFilter === status ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40' : 'bg-white/70 text-slate-500 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300'}`}
                  >
                    {status.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingActivity ? (
                <div className="space-y-4 px-6 py-8">
                  {[...Array(3)].map((_, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full bg-slate-200/70" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3 rounded-full bg-slate-200/70" />
                        <Skeleton className="h-3 w-1/2 rounded-full bg-slate-200/60" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredActivity.length > 0 ? (
                <ul className="divide-y divide-white/50 dark:divide-slate-800/60">
                  {filteredActivity.map((transaction) => {
                    const otherUser = getOtherUser(transaction, user.id);
                    const isProvider = transaction.provider._id === user.id;
                    return (
                      <li key={transaction._id} className="group px-6 py-5 transition hover:bg-white/60 dark:hover:bg-slate-900/40">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-1 items-start gap-4">
                            <div className={`mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg shadow-inner ${isProvider ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-200' : 'bg-sky-500/15 text-sky-600 dark:bg-sky-500/25 dark:text-sky-200'}`}>
                              {isProvider ? '↑' : '↓'}
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100">{formatTransactionType(transaction, user.id)}</h4>
                              <p className="text-sm text-slate-500 dark:text-slate-300">with {otherUser?.name || 'a neighbor'}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className={`rounded-full px-3 py-1 font-semibold ${getTransactionStatusColor(transaction.status)}`}>
                                  {transaction.status.replace('-', ' ')}
                                </span>
                                {transaction.skill?.name && (
                                  <span className="rounded-full bg-slate-100/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                                    {transaction.skill.name}
                                  </span>
                                )}
                              </div>
                              {transaction.scheduledDate && (
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                  Scheduled for {new Date(transaction.scheduledDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                              {transaction.amount > 0 
                                ? `${transaction.finalAmount} ${transaction.currency || 'BDT'}`
                                : `${transaction.credits} credits`
                              }
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="whitespace-nowrap px-4 py-1 text-[11px] font-semibold tracking-[0.28em] text-slate-500 hover:text-slate-900 dark:text-slate-300"
                              onClick={() => router.push(`/profile/${otherUser?._id}`)}
                            >
                              Profile
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="px-4 text-xs uppercase tracking-[0.3em]"
                              onClick={() => startChat(otherUser?._id, transaction.skill?.name)}
                            >
                              Chat
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                  <div className="text-5xl">📋</div>
                  <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">No recent activity</h3>
                  <p className="max-w-sm text-sm text-slate-500 dark:text-slate-300">Start a new exchange to see it appear here. You can scout the map or reconnect with your favorites.</p>
                  <Button
                    href="/search"
                    size="sm"
                    className="text-xs uppercase tracking-[0.3em]"
                  >
                    Find skills nearby
                  </Button>
                </div>
              )}
            </div>
          </div>
        </InteractiveCard>

        <InteractiveCard className="flex h-full flex-col gap-6">
          <div className="space-y-2">
            <GradientPill>Community stats</GradientPill>
            <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">Your ripple effect</h3>
            <p className="text-sm text-slate-500 dark:text-slate-300">See how your exchanges add up across the neighborhood.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 shadow-inner dark:bg-slate-900/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Total swaps</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.completedTransactions}</p>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-4 py-1 text-sm font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">Leveling up</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 shadow-inner dark:bg-slate-900/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Skills shared</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.skillsOffered}</p>
              </div>
              <span className="rounded-full bg-sky-500/15 px-4 py-1 text-sm font-semibold text-sky-600 dark:bg-sky-500/20 dark:text-sky-200">Diverse set</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 shadow-inner dark:bg-slate-900/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Avg rating</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{Number(stats.rating || 0).toFixed(1)}</p>
              </div>
              <span className="rounded-full bg-amber-500/15 px-4 py-1 text-sm font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">Keep shining</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 shadow-inner dark:bg-slate-900/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Credits earned</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">+{stats.completedTransactions * 2}</p>
              </div>
              <span className="rounded-full bg-purple-500/15 px-4 py-1 text-sm font-semibold text-purple-600 dark:bg-purple-500/20 dark:text-purple-200">Spend wisely</span>
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-r from-emerald-400/15 via-sky-400/15 to-purple-400/15 p-5 text-sm text-slate-600 dark:text-slate-200">
            <p>Keep logging your trades and requesting reviews. Every interaction builds trust and unlocks new opportunities.</p>
          </div>
        </InteractiveCard>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InteractiveCard className="h-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <GradientPill>Latest reviews</GradientPill>
              <h3 className="mt-3 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Feedback snapshot</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Peek at what neighbors are saying about your exchanges.</p>
            </div>
            {user && (
              <Link href={`/profile/${user.id || user._id}#reviews`} className="pill bg-white/80 px-4 py-1 text-[11px] text-slate-500 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300">
                View all
              </Link>
            )}
          </div>
          <div className="mt-6">
            {loadingActivity ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-24 rounded-full bg-slate-200/70" />
                <Skeleton className="h-4 w-3/4 rounded-full bg-slate-200/70" />
                <Skeleton className="h-4 w-2/3 rounded-full bg-slate-200/65" />
              </div>
            ) : reviewsSummary.count > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">{reviewsSummary.count} reviews</span>
                </div>
                {reviewsSummary.last && (
                  <div className="space-y-3 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-inner dark:border-slate-800/60 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="text-amber-500 text-base">⭐</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{reviewsSummary.last.rating}/5</span>
                      <span>from {reviewsSummary.last.reviewer?.name || 'a neighbor'}</span>
                    </div>
                    {reviewsSummary.last.comment && (
                      <p className="text-sm text-slate-500 dark:text-slate-300">“{reviewsSummary.last.comment}”</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-300">No reviews yet—finish a swap and ask for a quick shout-out.</p>
                <Button
                  href="/search"
                  size="sm"
                  className="text-xs uppercase tracking-[0.3em]"
                >
                  Start a swap
                </Button>
              </div>
            )}
          </div>
        </InteractiveCard>

        <InteractiveCard className="h-full">
          <GradientPill>Quick wins</GradientPill>
          <h3 className="mt-3 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">Keep the momentum</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">A couple of tiny tweaks can unlock better matches and faster responses.</p>
          <div className="mt-6 space-y-4">
            {[
              'Add vivid descriptions and photos to the skills you offer.',
              'Respond to new messages within a day to stay top of mind.',
              'Log completed swaps so credits flow and ratings climb.',
              'Bookmark standout partners to build a trusted go-to crew.',
            ].map((tip) => (
              <div key={tip} className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 text-sm text-slate-600 shadow-inner dark:bg-slate-900/60 dark:text-slate-200">
                <span className="mt-1 text-emerald-500">✓</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </InteractiveCard>
      </section>

      <Button
        type="button"
        onClick={() => router.push('/dashboard/skills')}
        className="!fixed bottom-6 right-6 gap-2 px-5 py-3 text-sm font-semibold uppercase tracking-[0.3em] shadow-elevated transition hover:-translate-y-0.5"
        title="Add a new skill"
      >
        ＋ Add skill
      </Button>
    </div>
  );
}