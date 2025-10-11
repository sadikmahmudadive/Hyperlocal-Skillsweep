export default function LoadingSpinner({ size = 'medium' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${sizeClasses[size]}`}
    >
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-400 border-r-sky-400" />
      <span className="absolute inset-[25%] rounded-full bg-gradient-to-br from-emerald-400/30 via-sky-400/30 to-purple-400/30 blur-sm" />
      <span className="h-[45%] w-[45%] rounded-full bg-white/60 dark:bg-slate-900/60" />
    </div>
  );
}