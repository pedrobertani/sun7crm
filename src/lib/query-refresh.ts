type RefreshJob = {
  group: string;
  interval: number;
  automatic: () => boolean;
  refresh: () => Promise<void>;
  last: number;
};

export function createRefreshScheduler(runtime: {
  now: () => number;
  active: () => boolean;
  listen: (wake: () => void) => () => void;
  repeat: (tick: () => void) => () => void;
}) {
  const jobs = new Set<RefreshJob>();
  let stop: (() => void) | undefined;
  const run = (job: RefreshJob) => {
    job.last = runtime.now();
    return job.refresh().catch(() => {});
  };
  const update = (wake = false) => {
    if (!runtime.active()) return;
    for (const job of jobs)
      if (job.automatic() && runtime.now() - job.last >= (wake ? 5000 : job.interval))
        void run(job);
  };
  return {
    subscribe(
      refresh: () => Promise<void>,
      group: string,
      interval = 30_000,
      automatic = () => true,
    ) {
      const job = { refresh, group, interval, automatic, last: runtime.now() };
      jobs.add(job);
      if (!stop) {
        const unlisten = runtime.listen(() => update(true));
        const cancel = runtime.repeat(() => update());
        stop = () => {
          unlisten();
          cancel();
          stop = undefined;
        };
      }
      return () => {
        jobs.delete(job);
        if (!jobs.size) stop?.();
      };
    },
    async refresh(group: string) {
      await Promise.all([...jobs].filter((job) => job.group === group).map(run));
    },
  };
}

export function createQueryTask<T>(
  load: (signal: AbortSignal) => Promise<T>,
  callbacks: {
    value: (value: T) => void;
    error: (error: unknown) => void;
    pending?: (pending: boolean) => void;
  },
) {
  let disposed = false;
  let pending: Promise<void> | undefined;
  let controller: AbortController | undefined;
  return {
    refresh() {
      if (disposed) return Promise.resolve();
      if (pending) return pending;
      controller = new AbortController();
      const signal = controller.signal;
      callbacks.pending?.(true);
      pending = Promise.resolve()
        .then(() => load(signal))
        .then((value) => {
          if (!disposed) callbacks.value(value);
        })
        .catch((error) => {
          if (!disposed) callbacks.error(error);
        })
        .finally(() => {
          pending = undefined;
          if (!disposed) callbacks.pending?.(false);
        });
      return pending;
    },
    dispose() {
      disposed = true;
      controller?.abort();
    },
  };
}

let pageScheduler: ReturnType<typeof createRefreshScheduler> | undefined;
export function pageRefreshScheduler() {
  return (pageScheduler ??= createRefreshScheduler({
    now: Date.now,
    active: () => document.visibilityState === 'visible' && navigator.onLine !== false,
    repeat: (tick) => {
      const id = window.setInterval(tick, 1000);
      return () => window.clearInterval(id);
    },
    listen: (wake) => {
      window.addEventListener('focus', wake);
      window.addEventListener('online', wake);
      document.addEventListener('visibilitychange', wake);
      return () => {
        window.removeEventListener('focus', wake);
        window.removeEventListener('online', wake);
        document.removeEventListener('visibilitychange', wake);
      };
    },
  }));
}

export const billingRefreshGroup = (companyId?: string) => `billing:${companyId || 'all'}`;
export async function refreshBilling(companyId?: string) {
  await pageScheduler?.refresh(billingRefreshGroup(companyId));
}
