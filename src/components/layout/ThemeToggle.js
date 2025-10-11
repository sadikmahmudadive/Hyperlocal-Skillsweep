import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    const initial = saved || 'system';
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const applyTheme = (next) => {
    const root = document.documentElement;
    const isDark =
      next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
    if (next) localStorage.setItem('theme', next);
  };

  const cycle = () => {
    const order = ['system', 'light', 'dark'];
    const idx = order.indexOf(theme);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
    applyTheme(next);
  };

  if (!mounted) return null;

  const label = theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

  const iconNode =
    theme === 'dark' ? (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M21.752 15.002A9.718 9.718 0 0 1 12 21.75 9.75 9.75 0 0 1 9.75 2.25a.75.75 0 0 1 .75.75 8.25 8.25 0 0 0 8.25 8.25.75.75 0 0 1 1.002.75z" />
      </svg>
    ) : theme === 'light' ? (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Zm6.364 3.136a.75.75 0 0 1 1.06 1.061l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.062ZM21.75 12a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM6.75 12a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1 0-1.5H6a.75.75 0 0 1 .75.75ZM5.25 3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3.75A.75.75 0 0 1 5.25 3ZM18.75 18a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM3.75 12a.75.75 0 0 1-.75.75H1.5a.75.75 0 0 1 0-1.5H3a.75.75 0 0 1 .75.75Zm14.5-8.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H19a.75.75 0 0 1-.75-.75ZM2.469 18.469a.75.75 0 0 1 1.061 0l1.061 1.061a.75.75 0 1 1-1.06 1.061L2.47 19.53a.75.75 0 0 1 0-1.061Zm16-12a.75.75 0 0 1 1.061 0l1.061 1.061a.75.75 0 1 1-1.06 1.061L18.47 7.53a.75.75 0 0 1 0-1.061ZM12 5.25a6.75 6.75 0 1 1 0 13.5 6.75 6.75 0 0 1 0-13.5Z" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path fillRule="evenodd" d="M6.32 2.577a.75.75 0 0 1 1.06-.257l1.5.999a.75.75 0 0 1-.804 1.26l-1.5-.999a.75.75 0 0 1-.257-1.003Zm-3.743 4.8a.75.75 0 0 1 .997-.35l1.682.841a.75.75 0 1 1-.647 1.342l-1.682-.84a.75.75 0 0 1-.35-.997ZM2.25 12a.75.75 0 0 1 .75-.75H5a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1-.75-.75Zm1.048 4.682a.75.75 0 0 1 .997-.35l1.682.84a.75.75 0 1 1-.647 1.343l-1.682-.841a.75.75 0 0 1-.35-.992ZM6.32 21.423a.75.75 0 0 1 1.06 1.003l-1.5.999a.75.75 0 1 1-.804-1.26l1.5-.999ZM12 2.25a.75.75 0 0 1 .75.75V5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM12 19a.75.75 0 0 1 .75.75V22a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 19ZM19.5 11.25a.75.75 0 0 1 0 1.5H17a.75.75 0 0 1 0-1.5h2.5Z" clipRule="evenodd" />
      </svg>
    );

  return (
    <Button
      onClick={cycle}
      aria-label="Toggle theme"
      title={`Theme: ${label}`}
      variant="secondary"
      size="md"
      icon={iconNode}
      className="px-3 py-1.5 text-sm"
    >
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
