import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';

export default function Reset() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    // No-op: token arrives via query
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      addToast({ type: 'error', title: 'Missing token', message: 'Reset token is missing from the URL.' });
      return;
    }
    if (password.length < 6) {
      addToast({ type: 'error', title: 'Weak password', message: 'Password must be at least 6 characters' });
      return;
    }
    if (password !== confirm) {
      addToast({ type: 'error', title: 'Mismatch', message: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Password reset', message: data.message || 'Password updated. Please sign in.' });
        router.push('/auth/login');
      } else {
        addToast({ type: 'error', title: 'Reset failed', message: data.message || 'Unable to reset password' });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Network error', message: 'Unable to reach server' });
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      heroTitle="Choose a secure password"
      heroDescription="Create a new password for your account. The link will expire shortly for security." 
      heroHighlights={[ 'Passwords should be at least 6 characters', 'Avoid reusing passwords from other sites' ]}
      formTitle="Reset your password"
      formSubtitle="Enter and confirm a new password to complete the reset."
      switchText="Remembered your password?"
      switchHref="/auth/login"
      switchLinkLabel="Sign in"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Confirm password</label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            className="input-field"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full justify-center" loading={loading} disabled={loading}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
