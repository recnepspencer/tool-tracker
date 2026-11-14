import type { MouseEvent, ReactNode } from 'react';
import { cx } from './cx';
import './Field.css';

export interface FieldShellProps {
  label: string;
  hint?: string;
  /** A small link on the label row, such as "Forgot password?"; it never changes the field's height. */
  action?: ReactNode;
  htmlFor: string;
  hideLabel?: boolean;
  focused?: boolean;
  disabled?: boolean;
  compact?: boolean;
  search?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  hint,
  action,
  htmlFor,
  hideLabel = false,
  focused = false,
  disabled = false,
  compact = false,
  search = false,
  className,
  children,
}: FieldShellProps) {
  // The whole box is the target: a press on its padding or label row reaches the control.
  // Portalled children (a select's popover) bubble here too, so only presses inside the box count.
  function reachControl(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element;
    if (!event.currentTarget.contains(target) || target.closest('a, button, input, select, textarea, label')) return;
    const control = document.getElementById(htmlFor);
    if (!control) return;
    event.preventDefault();
    if (control instanceof HTMLButtonElement) control.click();
    else control.focus();
  }
  return (
    <div
      onMouseDown={reachControl}
      className={cx(
        'field',
        focused && 'field--focused',
        disabled && 'field--disabled',
        compact && 'field--compact',
        hideLabel && 'field--bare',
        search && 'field--search',
        className,
      )}
    >
      <div className={cx('field-head', hideLabel && 'sr-only')}>
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      {action ? <div className="field-action">{action}</div> : null}
      {children}
    </div>
  );
}
