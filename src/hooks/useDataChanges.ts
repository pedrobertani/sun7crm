import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import {
  changeAffects,
  changeResources,
  setChangeConnection,
  type ChangeResource,
} from '../lib/data-changes';
import { pageRefreshScheduler } from '../lib/query-refresh';

/** One shared Supabase WebSocket, private topics, and resource-only invalidations. */
export function useDataChanges({
  userId,
  companyId,
  admin = false,
  onAccessChanged,
}: {
  userId: string;
  companyId?: string;
  admin?: boolean;
  onAccessChanged: () => void;
}) {
  const access = useRef(onAccessChanged);
  access.current = onAccessChanged;
  useEffect(() => {
    if (import.meta.env.VITE_DATA_EVENTS_ENABLED !== 'true') return;
    const client = getSupabaseClient();
    const scopes = [
      `user:${userId}`,
      ...(admin ? ['admin'] : companyId ? [`company:${companyId}`] : []),
    ];
    let disposed = false;
    let generation = 0;
    let channels: RealtimeChannel[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Map<string, Set<ChangeResource>>();
    let accessChanged = false;
    const enqueue = (scope: string, resource: ChangeResource, actual = true) => {
      if (
        actual &&
        ((scope.startsWith('user:') && resource === 'access') ||
          (scope.startsWith('company:') &&
            ['access', 'settings', 'team', 'billing'].includes(resource)))
      )
        accessChanged = true;
      const resources = pending.get(scope) || new Set<ChangeResource>();
      resources.add(resource);
      pending.set(scope, resources);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const batch = [...pending];
        pending.clear();
        pageRefreshScheduler().invalidate((group) =>
          batch.some(([key, values]) => changeAffects(group, key, values)),
        );
        if (accessChanged) {
          accessChanged = false;
          access.current();
        }
      }, 200);
    };
    const stop = () => {
      generation++;
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending.clear();
      accessChanged = false;
      scopes.forEach((scope) => setChangeConnection(scope, false));
      for (const channel of channels) void client.removeChannel(channel);
      channels = [];
    };
    const connect = async () => {
      if (
        disposed ||
        channels.length ||
        document.visibilityState !== 'visible' ||
        !navigator.onLine
      )
        return;
      const current = ++generation;
      await client.realtime.setAuth();
      if (disposed || current !== generation) return;
      channels = scopes.map((scope) =>
        client
          .channel(`crm:${scope}`, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, ({ payload }) => {
            if (!disposed && current === generation && changeResources.includes(payload?.resource))
              enqueue(scope, payload.resource);
          })
          .subscribe((status) => {
            if (disposed || current !== generation) return;
            const ready = status === 'SUBSCRIBED';
            setChangeConnection(scope, ready);
            if (ready) changeResources.forEach((resource) => enqueue(scope, resource, false));
          }),
      );
    };
    const wake = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) stop();
      else void connect().catch(() => scopes.forEach((scope) => setChangeConnection(scope, false)));
    };
    wake();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    window.addEventListener('offline', wake);
    return () => {
      disposed = true;
      stop();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', wake);
    };
  }, [userId, companyId, admin]);
}
