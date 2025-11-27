import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

const RefreshContext = createContext({
  isRefreshing: false,
  message: 'Refreshing…',
  triggerRefresh: async () => {},
});

export function RefreshProvider({ children }) {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [routeChanging, setRouteChanging] = useState(false);
  const [message, setMessage] = useState('Refreshing data…');
  const settleTimer = useRef(null);

  useEffect(() => {
    const handleStart = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      setRouteChanging(true);
    };
    const handleStop = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => setRouteChanging(false), 220);
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleStop);
    router.events.on('routeChangeError', handleStop);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleStop);
      router.events.off('routeChangeError', handleStop);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [router.events]);

  const triggerRefresh = useCallback(async (options = {}) => {
    if (!router.isReady && typeof options.refreshFn !== 'function') return;
    setMessage(options.message || 'Syncing latest updates…');
    setPending((count) => count + 1);
    try {
      if (typeof options.refreshFn === 'function') {
        await options.refreshFn();
      } else if (options.fullReload) {
        await router.replace(router.asPath, undefined, { scroll: false });
      } else {
        const shallow = options.shallow ?? true;
        await router.replace(router.asPath, undefined, { shallow, scroll: false });
      }
      if (typeof options.onAfter === 'function') {
        await options.onAfter();
      }
    } finally {
      setPending((count) => Math.max(0, count - 1));
    }
  }, [router]);

  const isRefreshing = routeChanging || pending > 0;

  return (
    <RefreshContext.Provider value={{ isRefreshing, message, triggerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
