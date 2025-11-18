import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

const PROVIDERS = [
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'bank', label: 'Bank (manual)' },
];

export default function TopUpModal({ open, onClose, initialCredits = 10, initialProvider = 'bkash' }) {
  const [provider, setProvider] = useState(initialProvider);
  const [credits, setCredits] = useState(initialCredits);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [intent, setIntent] = useState(null);
  const [config, setConfig] = useState(null);
  const { addToast } = useToast();
  const { refreshUserData, user } = useAuth();

  useEffect(() => {
    if (!open) {
      setProvider(initialProvider);
      setCredits(initialCredits);
      setLoading(false);
      setConfirming(false);
      setIntent(null);
      setConfig(null);
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/payments/topup/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ credits: Number(credits), provider })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to start top-up');
      setIntent(data.intent);
      setConfig(data.config);
    } catch (e) {
      addToast({ type: 'error', title: 'Top-up init failed', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmTopUp = async () => {
    if (!intent?.id) {
      addToast({ type: 'error', title: 'No intent', message: 'Start top-up first' });
      return;
    }
    try {
      setConfirming(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/payments/topup/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ intentId: intent.id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to confirm top-up');
      addToast({ type: 'success', title: 'Credits added', message: `+${data.creditsAdded} credits` });
      await refreshUserData();
      onClose?.();
    } catch (e) {
      addToast({ type: 'error', title: 'Top-up confirm failed', message: e.message });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add credits">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3 shadow-inner dark:bg-slate-900/60">
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
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${provider === p.id ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white/70 text-slate-600 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300'}`}
                >
                  {p.label}
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

        <div className="rounded-2xl border border-white/60 bg-white/80 p-4 text-sm shadow-inner dark:border-slate-800/60 dark:bg-slate-900/60">
          {intent ? (
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
            <p className="text-slate-500">Choose provider and credits, then continue to calculate amount.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {!intent ? (
            <Button onClick={initTopUp} loading={loading} disabled={loading}>Continue</Button>
          ) : (
            <Button onClick={confirmTopUp} loading={confirming} disabled={confirming}>Confirm (sandbox)</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
