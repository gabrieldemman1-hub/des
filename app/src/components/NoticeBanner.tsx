import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onDismiss?: () => void;
  tone?: 'warning' | 'info';
}

/** A small, non-blocking message at the top of the screen. */
export function NoticeBanner({ children, onDismiss, tone = 'warning' }: Props) {
  return (
    <div className={`notice notice-${tone}`} role="status">
      <p>{children}</p>
      {onDismiss && (
        <button type="button" className="notice-dismiss" onClick={onDismiss}>
          <span aria-hidden="true">×</span>
          <span className="visually-hidden">Dismiss</span>
        </button>
      )}
    </div>
  );
}
