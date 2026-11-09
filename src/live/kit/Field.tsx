import type { ReactNode } from 'react';
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
  return (
    <div
      className={cx(
        'field',
        focused && 'field--focused',
        disabled && 'field--disabled',
        compact && 'field--compact',
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
