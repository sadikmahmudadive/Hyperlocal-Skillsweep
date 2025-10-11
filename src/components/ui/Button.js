import Link from 'next/link';
import { forwardRef } from 'react';

const baseClasses = 'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60';

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs tracking-[0.32em] uppercase',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const variantClasses = {
  primary:
    'bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-400 text-white shadow-glass hover:shadow-aurora hover:-translate-y-[1px]',
  secondary:
    'border border-white/60 bg-white/70 text-slate-700 hover:-translate-y-[1px] hover:border-emerald-200 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:border-emerald-500/30',
  subtle:
    'border border-transparent bg-white/60 text-slate-600 hover:-translate-y-[1px] hover:border-emerald-200 hover:bg-white/80 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-emerald-500/30',
  ghost:
    'border border-transparent bg-transparent text-slate-500 hover:text-slate-900 hover:bg-white/40 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5',
};

const cn = (...classes) => classes.filter(Boolean).join(' ');

const LoadingSpinner = () => (
  <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon = null,
    iconPosition = 'left',
    children,
    className = '',
    href,
    as: Component = 'button',
    ...rest
  },
  ref
) {
  const { disabled, ...otherProps } = rest;
  const classes = cn(
    baseClasses,
    sizeClasses[size] || sizeClasses.md,
    variantClasses[variant] || variantClasses.primary,
    loading ? 'cursor-progress' : '',
    className
  );

  const content = (
    <span className="inline-flex items-center gap-2">
      {loading ? (
        <LoadingSpinner />
      ) : (
        icon && iconPosition === 'left' && <span className="inline-flex items-center">{icon}</span>
      )}
      <span className={loading ? 'opacity-80' : ''}>{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span className="inline-flex items-center">{icon}</span>
      )}
    </span>
  );

  if (href) {
    const { type, ...linkProps } = otherProps;
    return (
      <Link href={href} ref={ref} className={classes} {...linkProps}>
        {content}
      </Link>
    );
  }

  return (
    <Component ref={ref} className={classes} disabled={loading || disabled} {...otherProps}>
      {content}
    </Component>
  );
});

export const IconButton = forwardRef(function IconButton(
  { variant = 'ghost', size = 'md', className = '', children, ...rest },
  ref
) {
  const circleSizes = {
    sm: 'p-2 text-xs',
    md: 'p-2.5 text-sm',
    lg: 'p-3 text-base',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60',
        circleSizes[size] || circleSizes.md,
        variantClasses[variant] || variantClasses.ghost,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

IconButton.displayName = 'IconButton';
Button.displayName = 'Button';
