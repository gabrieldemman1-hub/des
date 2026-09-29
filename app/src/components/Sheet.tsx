import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: ReactNode;
  /** Under the title: the value or state the sheet is about. */
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * A panel that slides up from the bottom with one item's details (a config sheet row's why,
 * source and Done / Needs fixing). Modal: focus starts on Close, stays inside, Escape or the
 * backdrop closes it, and focus returns to the row that opened it.
 */
export function Sheet({ open, title, subtitle, children, onClose }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="sheet-backdrop" onKeyDown={onKeyDown} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <div className="sheet-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle}
          </div>
          <button ref={close} type="button" className="button small secondary sheet-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
