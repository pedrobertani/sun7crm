import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useThemeStyle } from '../theme-provider';
import './tooltip.css';

/** Portal avoids clipping inside tables and scrolling dialogs. The control keeps its own name. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(
    null,
  );
  const theme = useThemeStyle();
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelHide = () => {
    clearTimeout(hideTimer.current);
  };
  const hide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => setPosition(null), 100);
  };
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [position]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const show = () => {
    cancelHide();
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 70;
    setPosition({
      left: Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2)),
      top: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  };
  // Native disabled buttons cannot receive focus. Allow keyboard users to inspect the reason.
  const isDisabledControl =
    isValidElement(children) && Boolean((children as ReactElement<{ disabled?: boolean }>).props.disabled);
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': position ? id : undefined,
      })
    : children;
  return (
    <span
      ref={anchor}
      className="ui-tooltip-anchor"
      tabIndex={isDisabledControl ? 0 : undefined}
      role={isDisabledControl ? 'group' : undefined}
      aria-disabled={isDisabledControl ? true : undefined}
      aria-label={isDisabledControl ? label : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={() => setPosition(null)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && position) {
          event.stopPropagation();
          setPosition(null);
        }
      }}
    >
      {control}
      {position &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="ui-tooltip"
            onMouseEnter={cancelHide}
            onMouseLeave={hide}
            style={{
              ...theme,
              left: position.left,
              top: position.top,
              transform: position.below ? 'translateX(-50%)' : 'translate(-50%, -100%)',
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
