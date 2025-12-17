import { useRefresh } from '../../contexts/RefreshContext';

export default function RefreshIndicator() {
  const { isRefreshing, message } = useRefresh();

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-5 z-[70] w-full max-w-md -translate-x-1/2 transition-all duration-300 ${
        isRefreshing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="glass-panel flex flex-col gap-2 rounded-2xl border border-soft px-4 py-3 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-6 w-6 items-center justify-center">
            <span
              className={`absolute inline-flex h-full w-full rounded-full border border-emerald-400/40 ${
                isRefreshing ? 'animate-ping' : 'opacity-50'
              }`}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-400" />
          </span>
          <div className="flex-1">
            <p className="heading-eyebrow text-[10px] text-soft">Syncing</p>
            <p className="text-xs font-medium text-primary">{message || 'Refreshing app data…'}</p>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-[rgba(var(--panel-muted),0.65)]">
          <span className={`refresh-bar block h-full w-1/2 bg-gradient-to-r from-emerald-400 via-sky-400 to-purple-400 ${isRefreshing ? '' : 'opacity-0'}`} />
        </div>
      </div>
    </div>
  );
}
