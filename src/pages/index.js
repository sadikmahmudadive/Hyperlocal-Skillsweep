import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import GradientPill from '../components/ui/GradientPill';
import MetricCard from '../components/ui/MetricCard';
import InteractiveCard from '../components/ui/InteractiveCard';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="min-h-screen space-y-16 pb-16">
      <Head>
        <title>Hyperlocal SkillSwap - Trade Skills in Your Community</title>
        <meta name="description" content="Connect with neighbors to trade skills and services without money" />
      </Head>

      {/* Hero Section */}
      <section className="relative py-16 sm:py-24">
        <div className="absolute inset-0 -z-[1] mx-auto max-w-7xl rounded-[3rem] bg-aurora blur-3xl" />
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6 lg:px-8 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-8">
            <GradientPill>Neighbors helping neighbors</GradientPill>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
              Trade skills, share talents, and build a resilient community
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Discover people nearby who can teach, fix, or craft exactly what you&apos;re looking for. Earn time credits while you help someone else.
            </p>
            <div className="w-full rounded-3xl border border-white/60 bg-white/80 p-2 shadow-soft backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  placeholder="Try “bike repair”, “Spanish lessons”, or “plant care”"
                  aria-label="Search skills"
                  className="input-field rounded-2xl border-none bg-transparent px-4 py-3 text-base shadow-none focus:ring-0"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Link
                  href={`/search?q=${encodeURIComponent(searchTerm)}`}
                  className="btn-primary w-full justify-center px-6 py-3 text-base sm:w-auto"
                >
                  Start exploring
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                icon="📍"
                label="providers nearby"
                value="1,200+"
                helpText="Active neighbors within 5km offering their skills."
                trend={{ direction: 'up', prefix: '+', value: '18%' }}
              />
              <MetricCard
                icon="💬"
                label="successful swaps"
                value="4,500"
                helpText="Time-credit exchanges completed this month."
                trend={{ direction: 'up', prefix: '+', value: '12%' }}
              />
              <MetricCard
                icon="⭐"
                label="average rating"
                value="4.9/5"
                helpText="Trusted through transparent community reviews."
              />
            </div>
          </div>

          <div className="relative flex-1">
            <div className="pointer-events-none absolute -top-16 right-0 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-300/40 via-sky-300/35 to-purple-300/35 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-6 h-52 w-52 rounded-full bg-gradient-to-tr from-emerald-400/30 via-sky-400/20 to-purple-400/25 blur-3xl" />
            <div className="relative flex flex-col gap-6">
              <InteractiveCard className="px-8 py-10">
                <div className="space-y-6">
                  <div>
                    <span className="pill mb-2">Live in your area</span>
                    <h2 className="font-display text-3xl font-semibold text-slate-900 dark:text-slate-100">
                      Meet Maya — the neighborhood creative
                    </h2>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    Maya teaches weekend pottery classes in exchange for help with her community garden. Request a swap and trade skills face to face.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100/70 px-3 py-1 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      🎨 Ceramics coaching
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-sky-100/70 px-3 py-1 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                      🌱 Garden planning
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-purple-100/70 px-3 py-1 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                      ⭐ 98% positive reviews
                    </span>
                  </div>
                  <Link href="/search" className="btn-secondary self-start">
                    View all featured locals
                  </Link>
                </div>
              </InteractiveCard>
              <InteractiveCard className="px-8 py-10">
                <h3 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Trade your time for what you need
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Offer a one-hour skill session and earn a credit.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-sky-400" />
                    Spend credits to book verified neighbors instantly.
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-purple-400" />
                    Track conversations, confirmations, and reviews in one place.
                  </li>
                </ul>
              </InteractiveCard>
            </div>
          </div>
        </div>
      </section>

      {/* Categories ribbon */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            {['Bike repair', 'Language exchange', 'Home cooking', 'Kid tutoring', 'Pet care', 'Music lessons', 'Craft workshops'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-200/60 via-sky-200/50 to-purple-200/50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:from-emerald-500/20 dark:via-sky-500/20 dark:to-purple-500/20 dark:text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <GradientPill className="mb-4">Three-step swaps</GradientPill>
          <h2 className="font-display text-3xl font-semibold text-slate-900 dark:text-slate-100">
            A simple flow from idea to exchange
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
            Post what you can offer, bookmark favorites, and coordinate time-credit swaps through built-in chat and scheduling tools.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              emoji: '🔍',
              title: 'Discover locals',
              copy: 'Filter by category, distance, or saved searches to uncover trusted neighbors ready to help.'
            },
            {
              emoji: '🤝',
              title: 'Start the swap',
              copy: 'Favorite providers, start chats, and send hire requests with built-in credit tracking.'
            },
            {
              emoji: '🎉',
              title: 'Celebrate & review',
              copy: 'Leave reviews, earn badges, and keep your community thriving with transparent feedback.'
            },
          ].map(({ emoji, title, copy }, idx) => (
            <InteractiveCard key={title} className="h-full">
              <div className="space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200/60 via-sky-200/50 to-purple-200/50 text-2xl">
                  {emoji}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{copy}</p>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Step {idx + 1}
                </div>
              </div>
            </InteractiveCard>
          ))}
        </div>
      </section>
    </div>
  );
}