import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useRefresh } from '../contexts/RefreshContext';

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
  const { triggerRefresh } = useRefresh() || {};
  const timerRef = useRef(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!enabled) return;
    if (!router.isReady) return;

    const tick = () => {
      // Skip if document hidden (background tab)
      if (typeof document !== 'undefined' && document.hidden) return;
      const currentOptions = optionsRef.current || { shallow: true };
      const { message: optMessage, ...routerOptions } = currentOptions;
      const normalizedOptions = {
        shallow: routerOptions.shallow ?? true,
        fullReload: routerOptions.fullReload,
      };

      if (triggerRefresh) {
        triggerRefresh({
          message: optMessage || 'Keeping things fresh…',
          fullReload: normalizedOptions.fullReload,
          shallow: normalizedOptions.shallow,
        });
      } else {
        const fallbackOptions = { ...routerOptions };
        delete fallbackOptions.fullReload;
        if (normalizedOptions.fullReload) {
          router.replace(router.asPath, undefined, fallbackOptions);
        } else {
          router.replace(router.asPath, undefined, {
            ...fallbackOptions,
            shallow: normalizedOptions.shallow,
          });
        }
      }
    };

    timerRef.current = setInterval(tick, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, interval, router.isReady, router.asPath, triggerRefresh]);
}
