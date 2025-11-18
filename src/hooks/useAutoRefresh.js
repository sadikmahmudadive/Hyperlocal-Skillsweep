import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

/**
 * useAutoRefresh
 * Lightweight client-side revalidation helper for Pages Router.
 * Performs a shallow route replace at the specified interval so existing
 * useEffect hooks re-run and data is refetched without full page reload.
 * Pauses when tab is hidden to conserve resources.
 *
 * @param {number} interval ms between refreshes (default 60000)
 * @param {boolean} enabled toggle on/off (default true)
 * @param {object} options Next.js router options (default { shallow: true })
 */
export default function useAutoRefresh(interval = 60000, enabled = true, options = { shallow: true }) {
  const router = useRouter();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (!router.isReady) return;

    const tick = () => {
      // Skip if document hidden (background tab)
      if (typeof document !== 'undefined' && document.hidden) return;
      router.replace(router.asPath, undefined, options);
    };

    timerRef.current = setInterval(tick, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, interval, router.isReady, router.asPath]);
}
