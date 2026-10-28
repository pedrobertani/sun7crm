type RefreshJob = {
  group: string;
  interval: number;
  automatic: () => boolean;
  events: () => boolean;
  refresh: () => Promise<void>;
  invalidate: () => Promise<void>;
  dirty: boolean;
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
  const run = (job: RefreshJob, invalidated = false) => {
    job.last = runtime.now();
    job.dirty = false;
    return (invalidated ? job.invalidate() : job.refresh()).catch(() => {});
  };
  const update = (wake = false) => {
    if (!runtime.active()) return;
    for (const job of jobs) {
      if (job.dirty && job.events()) void run(job, true);
      else if (wake && job.events() && runtime.now() - job.last >= 5000) void run(job);
      else if (job.automatic() && runtime.now() - job.last >= job.interval) void run(job);
    }
  };
  return {
    subscribe(
      refresh: () => Promise<void>,
      group: string,
      interval = 30_000,
      automatic = () => true,
      events = automatic,
      invalidate = refresh,
    ) {
      const job = {
        refresh,
        invalidate,
        group,
        interval,
        automatic,
        events,
        dirty: false,
        last: runtime.now(),
      };
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
      await Promise.all([...jobs].filter((job) => job.group === group).map((job) => run(job)));
    },
    invalidate(matches: (group: string) => boolean) {
      for (const job of jobs) if (matches(job.group)) job.dirty = true;
      update();
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
  let dirty = false;
  const task = {
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
          if (!disposed && dirty) {
            dirty = false;
            void task.refresh();
          }
        });
      return pending;
    },
    invalidate() {
      if (pending) {
        dirty = true;
        return pending;
      }
      return task.refresh();
    },
    dispose() {
      disposed = true;
      controller?.abort();
    },
  };
  return task;
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
