import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export function useStageDrag(onMove: (from: number, to: number) => void) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  return (event: ReactPointerEvent<HTMLButtonElement>, from: number) => {
    if (!event.isPrimary || event.button !== 0) return;
    cleanup.current?.();
    event.preventDefault();
    const handle = event.currentTarget;
    const list = handle.closest('.stage-list');
    if (!list) return;
    const pointerId = event.pointerId;
    handle.setPointerCapture(pointerId);
    let target: HTMLElement | null = null;

    function stop() {
      target?.classList.remove('stage-drop-target');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      cleanup.current = null;
    }

    function stageAt(x: number, y: number) {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-stage-index]');
      return hit && list!.contains(hit) ? hit : null;
    }

    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const next = stageAt(e.clientX, e.clientY);
      if (next !== target) {
        target?.classList.remove('stage-drop-target');
        target = next;
        target?.classList.add('stage-drop-target');
      }
      e.preventDefault();
    }

    function finish(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const hit = stageAt(e.clientX, e.clientY);
      const index = hit ? Number(hit.dataset.stageIndex) : from;
      stop();
      if (Number.isInteger(index) && index >= 0 && index !== from) onMove(from, index);
    }

    function cancel() {
      stop();
    }

    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
    }

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    cleanup.current = stop;
  };
}
