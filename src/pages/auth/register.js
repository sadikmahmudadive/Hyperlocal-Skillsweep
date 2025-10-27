import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useToast } from '../../contexts/ToastContext';
import AuthLayout from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    address: '',
    bio: ''
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const [fieldErrors, setFieldErrors] = useState({});

  const isFormValid = useMemo(() => {
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.address) return false;
    if (formData.password !== formData.confirmPassword) return false;
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) return false;
    if (formData.password.length < 6) return false;
    return true;
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // client-side validation
    const errs = {};
    if (!formData.name) errs.name = 'Name is required';
    if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) errs.email = 'Valid email required';
    if (!formData.password || formData.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = "Passwords don't match";
    if (!formData.address) errs.address = 'Address is required';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setLoading(false); return; }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          address: formData.address,
          bio: formData.bio
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.token) {
          localStorage.setItem('token', data.token);
        }
        addToast({ type: 'success', title: 'Welcome!', message: 'Account created successfully' });
        router.push('/dashboard');
      } else {
        const error = await response.json();
        addToast({ type: 'error', title: 'Registration failed', message: error?.message || 'Please try again' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Network error', message: 'Registration failed' });
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <AuthLayout
      heroTitle="Join the SkillSwap collective"
      heroDescription="Tell your story, list your talents, and match with neighbors who need exactly what you offer."
      heroHighlights={[
        'Unlock access to curated local collaborations',
        'Earn credits faster the more you share',
        'Let automation broadcast your skills for you',
      ]}
      formTitle="Create your SkillSwap profile"
      formSubtitle="We use your details to tailor recommendations and connect you with nearby talent."
      switchText="Already have an account?"
      switchHref="/auth/login"
      switchLinkLabel="Sign in"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="input-field"
              value={formData.name}
              onChange={handleChange}
              placeholder="Avery Johnson"
              aria-invalid={fieldErrors.name ? 'true' : 'false'}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && <div id="name-error" className="text-xs text-rose-600 mt-1">{fieldErrors.name}</div>}
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
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
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

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="input-field"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Match your password"
              aria-invalid={fieldErrors.confirmPassword ? 'true' : 'false'}
              aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
            />
            {fieldErrors.confirmPassword && <div id="confirmPassword-error" className="text-xs text-rose-600 mt-1">{fieldErrors.confirmPassword}</div>}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="address" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
            Address for local matching
          </label>
          <input
            id="address"
            name="address"
            type="text"
            autoComplete="street-address"
            required
            className="input-field"
            value={formData.address}
            onChange={handleChange}
            placeholder="123 Market St, Springfield, 54321"
            aria-invalid={fieldErrors.address ? 'true' : 'false'}
            aria-describedby={fieldErrors.address ? 'address-error' : undefined}
          />
          {fieldErrors.address && <div id="address-error" className="text-xs text-rose-600 mt-1">{fieldErrors.address}</div>}
        </div>

        <div className="space-y-2">
          <label htmlFor="bio" className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
            About you
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            className="input-field min-h-[120px] resize-none"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Share your skills, passions, and what you hope to exchange with your neighbors."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:border-emerald-500/20 dark:text-emerald-200">
            Verified community
          </span>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-semibold uppercase tracking-[0.3em] text-sky-500 dark:border-sky-500/20 dark:text-sky-300">
            Free to join
          </span>
        </div>

        <Button type="submit" className="w-full justify-center" loading={loading} disabled={loading || !isFormValid}>
          {loading ? 'Creating account…' : 'Create your account'}
        </Button>
      </form>
    </AuthLayout>
  );
}