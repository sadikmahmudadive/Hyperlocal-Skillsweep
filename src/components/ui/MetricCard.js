export default function MetricCard({ icon, label, value, helpText, trend }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated dark:border-slate-800/70 dark:bg-slate-900/60">
      <div className="pointer-events-none absolute -top-12 right-0 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-300/20 via-sky-300/15 to-purple-300/15 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-[1] flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 via-sky-400/20 to-purple-400/20 text-xl">
                {icon}
              </div>
            )}
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              {label}
            </span>
          </div>
          <div className="font-display text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {value}
          </div>
        </div>
        {trend && (
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${trend.direction === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200'}`}>
            {trend.prefix}{trend.value}
          </div>
        )}
      </div>
      {helpText && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-300/80">
          {helpText}
        </p>
      )}
    </div>
  );
}
