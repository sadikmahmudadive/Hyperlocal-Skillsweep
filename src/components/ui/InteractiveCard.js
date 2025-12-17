import { forwardRef } from 'react';

const InteractiveCard = forwardRef(function InteractiveCard({ as: Component = 'div', className = '', highlight, children, ...props }, ref) {
  const base = 'interactive-card group relative overflow-hidden rounded-3xl border border-soft surface-card p-6 shadow-soft transition-all duration-300';
  const highlightClass = highlight ? 'ring-2 ring-emerald-300/60 dark:ring-emerald-500/30 ring-offset-2 ring-offset-[rgb(var(--bg))]' : '';
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
