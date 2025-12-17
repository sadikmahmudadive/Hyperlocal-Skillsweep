export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/60 ${className}`} />;
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-slate-200/70 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}
