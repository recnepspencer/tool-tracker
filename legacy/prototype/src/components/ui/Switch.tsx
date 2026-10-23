import { useId } from 'react';
import { cx } from '../../lib/cx';
import './Switch.css';

interface SwitchProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  label: string;
  description?: string;
  disabled?: boolean;
  locked?: boolean;
  compact?: boolean;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  locked = false,
  compact = false,
}: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  const inert = disabled || locked;
  return (
    <button
      type="button"
      role="switch"
      className={cx('switch', compact && 'switch--compact', disabled && 'switch--disabled', locked && 'switch--locked')}
      aria-checked={checked}
      aria-label={compact ? label : undefined}
      aria-labelledby={compact ? undefined : labelId}
      aria-describedby={description ? descriptionId : undefined}
      aria-disabled={inert || undefined}
      disabled={inert}
      onClick={() => !inert && onCheckedChange(!checked)}
    >
      <span className="switch-copy">
        <span id={labelId} className="switch-label">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="switch-description">
            {description}
          </span>
        ) : null}
      </span>
      <span className={cx('switch-track', checked && 'switch-track--on')}>
        <span className="switch-knob" />
      </span>
    </button>
  );
}
