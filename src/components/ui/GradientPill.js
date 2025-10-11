export default function GradientPill({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-200/60 via-sky-200/60 to-purple-200/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:from-emerald-500/20 dark:via-sky-500/20 dark:to-purple-500/20 dark:text-emerald-200 ${className}`}
    >
      {children}
    </span>
  );
}
