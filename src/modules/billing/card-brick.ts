export interface CardBrickController {
  unmount(): Promise<void>;
}

export function mountCardBrick(
  create: (callbacks: {
    ready: () => void;
    error: () => void;
  }) => Promise<CardBrickController | null>,
  callbacks: { ready: () => void; unavailable: () => void },
  timeout = 20_000,
) {
  let active = true;
  let failed = false;
  let ready = false;
  let controller: CardBrickController | null = null;
  let unmounted = false;
  const unmount = () => {
    if (controller && !unmounted) {
      unmounted = true;
      const current = controller;
      void Promise.resolve()
        .then(() => current.unmount())
        .catch(() => {});
    }
  };
  const unavailable = () => {
    if (!active || failed || ready) return;
    failed = true;
    clearTimeout(timer);
    callbacks.unavailable();
    unmount();
  };
  const timer = setTimeout(unavailable, timeout);
  void Promise.resolve()
    .then(() =>
      active
        ? create({
            ready: () => {
              if (!active || failed || ready) return;
              ready = true;
              clearTimeout(timer);
              callbacks.ready();
            },
            error: unavailable,
          })
        : null,
    )
    .then((value) => {
      controller = value;
      if (!controller) unavailable();
      else if (!active || failed) unmount();
    })
    .catch(unavailable);
  return () => {
    active = false;
    clearTimeout(timer);
    unmount();
  };
}
