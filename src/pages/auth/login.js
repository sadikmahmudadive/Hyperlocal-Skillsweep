import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const { login, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData.email, formData.password);
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
        {error && (
          <div className="relative overflow-hidden rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 shadow-inner dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            <div className="flex items-start gap-3">
              <span className="text-base">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

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
          />
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
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400" />
            <span>Keep me signed in</span>
          </label>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:border-emerald-500/20 dark:text-emerald-200">
            Secure login
          </span>
        </div>

        <Button type="submit" className="w-full justify-center" loading={loading} disabled={loading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}