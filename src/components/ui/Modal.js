import { useEffect } from 'react';

export default function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-soft surface-card shadow-elevated backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br from-emerald-300/30 via-sky-300/30 to-purple-300/30 blur-3xl" />
        <div className="relative z-[1]">
          <div className="flex items-center justify-between gap-4 border-b border-soft px-6 py-4">
            <h3 className="font-display text-xl font-semibold text-strong">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[rgba(var(--panel-muted),0.65)] text-lg text-muted transition-all duration-200 hover:border-soft hover:text-strong"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
          <div className="px-6 py-5 text-secondary">{children}</div>
        </div>
      </div>
    </div>
  );
}
