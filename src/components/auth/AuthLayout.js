import { useEffect, useState } from 'react';
import Link from 'next/link';
import GradientPill from '../ui/GradientPill';
import { Button } from '../ui/Button';

export default function AuthLayout({
  heroEyebrow = 'Neighborhood barter network',
  heroTitle = 'Swap skills, grow together',
  heroDescription = 'Trade time, talent, and know-how with people who live just down the block. Log in or join to unlock hyperlocal collaborations.',
  heroHighlights = [
    'Reach verified neighbors with trusted profiles',
    'Earn credits for every hour you share'
  ],
  heroAction,
  formTitle,
  formSubtitle,
  switchText,
  switchHref,
  switchLinkLabel,
  children,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeout = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timeout);
  }, []);

  const heroActionNode = heroAction || (
    <Button href="/search" variant="ghost" className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">
      Explore the map
    </Button>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-500 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-400/25 via-sky-400/20 to-purple-400/25 blur-3xl animate-float" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-sky-500/15 via-emerald-400/15 to-purple-500/15 blur-[140px]" />
        <div className="absolute top-1/3 left-[-14%] h-[26rem] w-[26rem] rounded-full bg-gradient-to-br from-purple-500/18 via-sky-400/14 to-emerald-400/18 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_60%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.18),transparent_65%)] dark:bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.45),transparent_70%),radial-gradient(circle_at_bottom,rgba(15,118,110,0.22),transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <section
          className={`relative mb-12 max-w-xl lg:mb-0 lg:w-[48%] ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          } transition-all duration-700 ease-out`}
        >
          <div className="absolute -left-12 -top-10 hidden h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400/40 via-sky-400/30 to-purple-400/30 blur-2xl lg:block" />
          <GradientPill className="inline-flex items-center gap-2 bg-white/40 text-emerald-600 backdrop-blur-md dark:bg-slate-900/40 dark:text-emerald-200">
            {heroEyebrow}
          </GradientPill>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            {heroTitle}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {heroDescription}
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            {heroHighlights.map((feature) => (
              <li key={feature} className="flex items-start gap-3 rounded-2xl bg-white/60 p-3 shadow-inner backdrop-blur-md dark:bg-slate-900/60">
                <span className="mt-0.5 text-emerald-500">✦</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 inline-flex items-center gap-3">
            {heroActionNode}
            <span className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">
              100% community-led
            </span>
          </div>
        </section>

        <section
          className={`relative w-full max-w-xl lg:w-[46%] ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          } transition-all duration-700 ease-out delay-150`}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/60 via-white/30 to-transparent shadow-aurora backdrop-blur-3xl dark:from-slate-900/60 dark:via-slate-900/30" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-white/80 p-8 shadow-soft backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/70 sm:p-10">
            <div className="absolute -top-16 right-10 h-28 w-28 rounded-full bg-gradient-to-br from-emerald-400/30 via-sky-400/30 to-purple-400/30 blur-2xl" />
            <div className="absolute bottom-[-5rem] left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-400/10 via-sky-400/10 to-purple-400/15 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                Welcome
              </div>
              <h2 className="mt-6 font-display text-3xl font-semibold text-slate-900 dark:text-white">
                {formTitle}
              </h2>
              {formSubtitle && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{formSubtitle}</p>
              )}

              <div className="mt-8 space-y-6">
                {children}
              </div>

              {switchText && switchHref && switchLinkLabel && (
                <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {switchText}{' '}
                  <Link
                    href={switchHref}
                    className="font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200"
                  >
                    {switchLinkLabel}
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
