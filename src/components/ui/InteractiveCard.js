import { forwardRef } from 'react';

const InteractiveCard = forwardRef(function InteractiveCard({ as: Component = 'div', className = '', highlight, children, ...props }, ref) {
  const base = 'interactive-card group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft transition-all duration-300 dark:border-slate-800/70 dark:bg-slate-900/60 surface-card';
  const highlightClass = highlight ? 'ring-2 ring-emerald-300/60 ring-offset-2 ring-offset-white dark:ring-emerald-500/30 dark:ring-offset-slate-900' : '';
  return (
    <Component
      ref={ref}
      className={`${base}${highlightClass ? ` ${highlightClass}` : ''}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <div className="pointer-events-none absolute inset-px rounded-[calc(theme(borderRadius.3xl)-2px)] bg-gradient-to-br from-emerald-300/10 via-sky-300/10 to-purple-300/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-[1]">
        {children}
      </div>
    </Component>
  );
});

export default InteractiveCard;
