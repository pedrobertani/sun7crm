import { useEffect, useRef, useState, type ReactNode } from 'react';
import './kanban-scroll.css';

/** Azure-like board: one shared vertical scroll, horizontal access above and below. */
export function KanbanScroll({
  children,
  label = 'Etapas do funil',
}: {
  children: ReactNode;
  label?: string;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);

  useEffect(() => {
    const board = boardRef.current;
    const top = topRef.current;
    if (!board || !top) return;
    const measure = () => {
      setWidth(board.scrollWidth);
      setHasHorizontalScroll(board.scrollWidth > board.clientWidth + 2);
      top.scrollLeft = board.scrollLeft;
    };
    const syncTop = () => { if (Math.abs(top.scrollLeft - board.scrollLeft) > 1) top.scrollLeft = board.scrollLeft; };
    const syncBoard = () => { if (Math.abs(board.scrollLeft - top.scrollLeft) > 1) board.scrollLeft = top.scrollLeft; };
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    if (board.firstElementChild) observer.observe(board.firstElementChild);
    const changes = new MutationObserver(measure);
    changes.observe(board, { childList: true, subtree: true });
    board.addEventListener('scroll', syncTop, { passive: true });
    top.addEventListener('scroll', syncBoard, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      changes.disconnect();
      board.removeEventListener('scroll', syncTop);
      top.removeEventListener('scroll', syncBoard);
    };
  }, []);

  return (
    <div className="kanban-scroll-shell">
      <div
        className="kanban-scroll-top"
        ref={topRef}
        role="region"
        aria-label={'Rolagem superior: ' + label}
        tabIndex={hasHorizontalScroll ? 0 : -1}
        data-overflow={hasHorizontalScroll}
      >
        <div style={{ width, height: 1 }} />
      </div>
      <div className="kanban-scroll" ref={boardRef} role="region" tabIndex={0} aria-label={label}>
        {children}
      </div>
    </div>
  );
}
