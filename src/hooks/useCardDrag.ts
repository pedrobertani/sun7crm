import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

// O gesto começa somente na alça. O restante do quadro continua rolável no toque.
export function useCardDrag(onMove: (id: string, stage: string) => void) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  return (event: ReactPointerEvent<HTMLButtonElement>, id: string, currentStage: string) => {
    if (!event.isPrimary || event.button !== 0) return;
    cleanup.current?.();
    const handle = event.currentTarget;
    const card = handle.closest<HTMLElement>('.opportunity-card');
    const board = handle.closest<HTMLElement>('.kanban-scroll');
    if (!card || !board) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const pointerId = event.pointerId;
    const rect = card.getBoundingClientRect();
    let x = event.clientX,
      y = event.clientY;
    const startX = x,
      startY = y;
    const offsetX = x - rect.left,
      offsetY = y - rect.top;
    let ghost: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    let frame = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      ghost?.remove();
      target?.classList.remove('dragover');
      card.classList.remove('card-drag-source');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      cleanup.current = null;
    };
    const tick = () => {
      if (!ghost) return;
      const bounds = board.getBoundingClientRect();
      if (y >= bounds.top && y <= bounds.bottom && x >= bounds.left && x <= bounds.right) {
        const edge = 48;
        if (x < bounds.left + edge) board.scrollLeft -= 9;
        else if (x > bounds.right - edge) board.scrollLeft += 9;
      }
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-stage]');
      const next = hit && board.contains(hit) ? hit : null;
      if (next !== target) {
        target?.classList.remove('dragover');
        target = next;
        target?.classList.add('dragover');
      }
      ghost.style.transform = `translate3d(${x - offsetX}px, ${y - offsetY}px, 0)`;
      frame = requestAnimationFrame(tick);
    };
    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      x = e.clientX;
      y = e.clientY;
      if (!ghost && Math.hypot(x - startX, y - startY) >= 6) {
        ghost = card!.cloneNode(true) as HTMLElement;
        ghost.classList.add('card-drag-preview');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        ghost.style.width = `${rect.width}px`;
        document.body.appendChild(ghost);
        card!.classList.add('card-drag-source');
        tick();
      }
      e.preventDefault();
    }
    function finish(e: PointerEvent) {
      if (e.pointerId !== pointerId) return;
      const hit = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-drop-stage]');
      const stage = ghost && hit && board!.contains(hit) ? hit.dataset.dropStage : undefined;
      stop();
      if (stage && stage !== currentStage) onMove(id, stage);
    }
    function cancel() {
      stop();
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') stop();
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
