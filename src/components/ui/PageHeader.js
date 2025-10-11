export default function PageHeader({
  title,
  eyebrow,
  subtitle,
  actions,
  children,
  className,
}) {
  const baseClass = 'relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 px-6 py-8 shadow-soft backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/60';
  return (
    <div className={`${baseClass}${className ? ` ${className}` : ''}`}>
      <div className="pointer-events-none absolute -top-20 right-10 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-300/35 via-sky-300/25 to-purple-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-52 w-52 -translate-x-1/3 rounded-full bg-gradient-to-tr from-purple-400/25 via-sky-300/15 to-emerald-300/30 blur-[120px]" />
      <div className="relative z-[1] flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          {eyebrow && (
            <div className="pill w-fit bg-white/80 px-4 py-1 text-[11px] text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
              {eyebrow}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {(actions || children) && (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {actions}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
