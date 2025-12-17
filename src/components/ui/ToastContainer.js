import { useToast } from '../../contexts/ToastContext';

const typeStyles = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-900 text-white',
  warning: 'bg-yellow-400 text-slate-900',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`shadow-lg rounded-lg p-3 flex items-start gap-3 animate-[toast-in_0.2s_ease-out] ${typeStyles[t.type] || typeStyles.info}`}
        >
          <div className="flex-1">
            {t.title && <div className="text-sm font-semibold leading-tight">{t.title}</div>}
            {t.message && <div className="text-sm opacity-90 mt-0.5">{t.message}</div>}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      ))}
      <style jsx global>{`
        @keyframes toast-in { from { transform: translateY(-8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
