import { useEffect, useRef, useState, type ReactNode } from 'react';
import './kanban-scroll.css';

/** One horizontally scrollable board, with a synchronized scrollbar above it. */
export function KanbanScroll({ children, label = 'Etapas do funil' }: { children: ReactNode; label?: string }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const board = boardRef.current;
    const top = topRef.current;
    if (!board || !top) return;
    const measure = () => {
      setWidth(board.scrollWidth);
      top.scrollLeft = board.scrollLeft;
    };
    const syncTop = () => { top.scrollLeft = board.scrollLeft; };
    const syncBoard = () => { board.scrollLeft = top.scrollLeft; };
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    if (board.firstElementChild) observer.observe(board.firstElementChild);
    board.addEventListener('scroll', syncTop, { passive: true });
    top.addEventListener('scroll', syncBoard, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      board.removeEventListener('scroll', syncTop);
      top.removeEventListener('scroll', syncBoard);
    };
  }, []);
  return (
    <div className="kanban-scroll-shell">
      <div className="kanban-scroll-top" ref={topRef} role="region"
        aria-label={'Rolagem superior: ' + label} tabIndex={0}>
        <div style={{ width, height: 1 }} />
      </div>
      <div className="kanban-scroll" ref={boardRef} role="region" tabIndex={0} aria-label={label}>
        {children}
      </div>
    </div>
  );
}
