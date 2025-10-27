import { useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const [devLink, setDevLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      addToast({ type: 'error', title: 'Invalid email', message: 'Please enter a valid email address' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Request received', message: data.message || 'If an account exists, we sent reset instructions.' });
        // In development, server returns resetLink so developer can test
        if (data.resetLink) setDevLink(data.resetLink);
      } else {
        addToast({ type: 'error', title: 'Request failed', message: data.message || 'Unable to request password reset' });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Network error', message: 'Unable to reach server' });
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      heroTitle="Reset your password"
      heroDescription="Enter the email address for your account and we’ll send instructions to reset your password."
      heroHighlights={[ 'We will not reveal account existence', 'Reset links expire quickly for security' ]}
      formTitle="Forgot your password?"
      formSubtitle="We’ll email a secure link if an account exists for the address you provide."
      switchText="Remembered your password?"
      switchHref="/auth/login"
      switchLinkLabel="Sign in"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <Button type="submit" className="w-full justify-center" loading={loading} disabled={loading}>
          Send reset link
        </Button>

        {devLink && (
          <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
            Dev reset link (visible only in development):
            <div className="break-words text-xs mt-1 text-emerald-700 dark:text-emerald-300">{devLink}</div>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}
