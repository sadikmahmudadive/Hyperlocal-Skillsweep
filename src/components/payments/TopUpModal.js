import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const PROVIDERS = [
  { id: 'stripe', label: 'Card (Stripe)', hint: 'Visa, Mastercard, Amex' },
];

export default function TopUpModal({ open, onClose, initialCredits = 10, initialProvider = 'stripe' }) {
  const [provider, setProvider] = useState(initialProvider);
  const [credits, setCredits] = useState(initialCredits);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState(null);
  const [config, setConfig] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const { addToast } = useToast();
  const { user } = useAuth();

  // Safely parse JSON, tolerate empty or non-JSON responses
  const safeParseJson = async (res) => {
    try {
      const ct = res.headers?.get?.('content-type') || '';
      if (ct.includes('application/json')) {
        return await res.json();
      }
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { success: false, message: text || 'Unexpected response' }; }
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (!open) {
      setProvider(initialProvider);
      setCredits(initialCredits);
      setLoading(false);
      setIntent(null);
      setConfig(null);
      setRedirecting(false);
    }
  }, [open, initialCredits, initialProvider]);

  const currency = config?.currency || 'BDT';

  const initTopUp = async () => {
    if (!Number.isFinite(+credits) || +credits < 1) {
      addToast({ type: 'error', title: 'Invalid amount', message: 'Enter at least 1 credit' });
      return;
    }
    try {
      setLoading(true);
      if (provider !== 'stripe') {
        addToast({ type: 'error', title: 'Provider unavailable', message: 'Stripe is the only supported provider right now.' });
        return;
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/payments/stripe/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ credits: Number(credits) })
      });
      if (res.status === 401) {
        addToast({ type: 'error', title: 'Sign in required', message: 'Please log in to add credits.' });
        return;
      }
      const data = await safeParseJson(res);
      if (!res.ok || !data?.success) throw new Error((data && data.message) || 'Failed to start top-up');
      setIntent(data.intent);
      setConfig(data.config);
      if (data.checkoutUrl) {
        setRedirecting(true);
        window.location.assign(data.checkoutUrl);
      } else {
        addToast({ type: 'info', title: 'Session created', message: 'Follow the Stripe popup to finish payment.' });
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Top-up init failed', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add credits">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl surface-card p-3 shadow-inner">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Current balance</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{user?.credits ?? 0} credits</p>
          </div>
          {config?.creditRate && (
            <div className="text-right text-xs text-slate-500 dark:text-slate-300">1 credit ≈ {config.creditRate} {currency}</div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Provider</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${provider === p.id ? 'bg-emerald-500 text-white shadow-sm' : 'bg-[rgba(var(--panel),0.62)] text-secondary hover:bg-[rgba(var(--panel),0.8)]'}`}
                >
                  <div className="flex flex-col text-left">
                    <span>{p.label}</span>
                    {p.hint && <span className="text-[11px] font-normal text-white/80 dark:text-slate-200/80">{p.hint}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="credits" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Credits</label>
            <input
              id="credits"
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className="input-field"
              placeholder="10"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-soft surface-card p-4 text-sm shadow-inner">
          {redirecting ? (
            <div className="flex items-center justify-between">
              <p className="text-slate-500">Redirecting you to Stripe Checkout…</p>
              <span className="text-xs text-slate-400">Do not close this tab</span>
            </div>
          ) : intent ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500">Top-up intent ready</p>
                <p className="text-xs text-slate-400">Ref: {intent.idempotencyKey?.slice(0,32)}…</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{intent.credits} credits</p>
                <p className="text-xs text-slate-500">≈ {intent.amountFiat} {currency}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Choose Stripe and your credit amount, then continue.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={initTopUp} loading={loading || redirecting} disabled={loading || redirecting}>
            {redirecting ? 'Opening Stripe…' : 'Pay with Stripe'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
