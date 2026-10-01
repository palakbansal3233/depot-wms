import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Fetches `path`, re-fetching every `intervalMs` while the tab is visible,
// so several terminals on the depot floor stay roughly in step.
export function useApi(path, intervalMs = 30000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await api(path);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    load();
    if (!intervalMs) return () => (alive.current = false);
    const id = setInterval(() => document.visibilityState === 'visible' && load(), intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  return { data, error, loading, reload: load };
}

// A ticking "now", for clocks and issue timers.
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
