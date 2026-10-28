import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { createQueryTask, pageRefreshScheduler } from '../lib/query-refresh';
import { hasChangeConnection } from '../lib/data-changes';

export function useLiveQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  {
    group,
    enabled = true,
    automatic = true,
    interval = 60_000,
  }: { group: string; enabled?: boolean; automatic?: boolean | (() => boolean); interval?: number },
) {
  const loader = useRef(load);
  loader.current = load;
  const auto = useRef(automatic);
  auto.current = automatic;
  const task = useRef<ReturnType<typeof createQueryTask<T>> | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    setData(null);
    setError('');
    setLoading(enabled);
    if (!enabled) return;
    const current = createQueryTask((signal) => loader.current(signal), {
      value: (value) => {
        setData(value);
        setError('');
      },
      error: (cause) =>
        setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar os dados.'),
      pending: setLoading,
    });
    task.current = current;
    void current.refresh();
    const allowed = () => (typeof auto.current === 'function' ? auto.current() : auto.current);
    const unsubscribe = pageRefreshScheduler().subscribe(
      current.refresh,
      group,
      interval,
      () => allowed() && !hasChangeConnection(group),
      allowed,
      current.invalidate,
    );
    return () => {
      unsubscribe();
      current.dispose();
      if (task.current === current) task.current = null;
    };
  }, [enabled, group, interval, ...deps]);
  const refresh = useCallback(() => task.current?.refresh() || Promise.resolve(), []);
  return { data, error, loading, refresh };
}

export function useAutoRefresh(
  refresh: () => Promise<void>,
  { enabled, interval = 5000 }: { enabled: boolean; interval?: number },
) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    return pageRefreshScheduler().subscribe(() => callback.current(), '', interval);
  }, [enabled, interval]);
}
