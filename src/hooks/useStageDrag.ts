import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
export function useStageDrag(onMove: (from: number, to: number) => void) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  return (event: ReactPointerEvent<HTMLButtonElement>, from: number) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    cleanup.current?.();
    const handle = event.currentTarget;
    const list = handle.closest('.stage-list');
    if (!list) return;
    handle.setPointerCapture(event.pointerId);
    let target: HTMLElement | null = null;
    function stop() {
      target?.classList.remove('stage-drop-target');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', stop);
      handle.removeEventListener('lostpointercapture', stop);
      window.removeEventListener('blur', stop);
      cleanup.current = null;
    }
    function move(e: PointerEvent) {
      const hit = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-stage-index]');
      const next = hit && list!.contains(hit) ? hit : null;
      if (next !== target) {
        target?.classList.remove('stage-drop-target');
        target = next;
        target?.classList.add('stage-drop-target');
      }
    }
    function finish(e: PointerEvent) {
      const hit = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-stage-index]');
      const to = hit && list!.contains(hit) ? Number(hit.dataset.stageIndex) : from;
      stop();
      if (to !== from) onMove(from, to);
    }
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', stop);
    handle.addEventListener('lostpointercapture', stop);
    window.addEventListener('blur', stop);
    cleanup.current = stop;
  };
}
