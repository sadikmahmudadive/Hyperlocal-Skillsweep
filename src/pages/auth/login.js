import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const { login, loading, error } = useAuth();
  const { addToast } = useToast();
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (error) {
      addToast({ type: 'error', title: 'Login failed', message: error });
      // clear auth error for next interaction if available
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          // attempt to clear error via exposed auth method if present
          // useAuth provides clearError via context; we can call it if available
          // (guarded to avoid runtime errors if not present)
          const ctx = require('../../contexts/AuthContext');
          if (ctx && ctx.useAuth) {
            const c = ctx.useAuth();
            if (c && typeof c.clearError === 'function') c.clearError();
          }
        } catch (_) {
          // ignore; defensive only
        }
      }
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // client-side validation
    const errs = {};
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) errs.email = 'Please enter a valid email';
    if (!formData.password || formData.password.length < 6) errs.password = 'Password must be at least 6 characters';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await login(formData.email, formData.password);
    } catch (err) {
      // login errors are surfaced via auth context; show a generic toast fallback
      addToast({ type: 'error', title: 'Login error', message: err?.message || 'Unable to sign in' });
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <AuthLayout
      heroTitle="Welcome back, neighbor"
      heroDescription="Sign in to keep your swaps moving, follow up with partners, and discover fresh talent in your block."
      heroHighlights={[
        'Pick up conversations exactly where you left off',
        'Track credits and completed exchanges in real time',
      ]}
      formTitle="Sign in to SkillSwap"
      formSubtitle="Enter your details to access your dashboard and community."
      switchText="New to SkillSwap?"
      switchHref="/auth/register"
      switchLinkLabel="Create an account"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        {/* inline field errors (accessible) */}
        <div aria-live="polite" className="min-h-[1.5rem]">
          {fieldErrors._form && (
            <div className="relative overflow-hidden rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 shadow-inner dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              <div className="flex items-start gap-3">
                <span className="text-base">⚠️</span>
                <span>{fieldErrors._form}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            aria-invalid={fieldErrors.email ? 'true' : 'false'}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && <div id="email-error" className="text-xs text-rose-600 mt-1">{fieldErrors.email}</div>}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-field"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            aria-invalid={fieldErrors.password ? 'true' : 'false'}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && <div id="password-error" className="text-xs text-rose-600 mt-1">{fieldErrors.password}</div>}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400" />
            <span>Keep me signed in</span>
          </label>
          <div className="flex items-center gap-3">
            <Link href="/auth/forgot" className="text-xs underline text-slate-600 hover:text-slate-700 dark:text-slate-300">Forgot password?</Link>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:border-emerald-500/20 dark:text-emerald-200">
              Secure login
            </span>
          </div>
        </div>

        <Button type="submit" className="w-full justify-center" loading={loading} disabled={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}