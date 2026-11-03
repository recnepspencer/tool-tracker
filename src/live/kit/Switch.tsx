import { useEffect, useId, useRef, useState } from 'react';
import { cx } from './cx';
import { useFormDraft } from './form-draft';
import './Switch.css';

interface SwitchProps {
  /** Controlled state. Omit it, with `defaultChecked` and `name`, for a form-owned switch. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(checked: boolean): void;
  label: string;
  description?: string;
  disabled?: boolean;
  locked?: boolean;
  compact?: boolean;
  /** Submits "on" under this name while checked, like a checkbox. */
  name?: string;
  value?: string;
}

export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  locked = false,
  compact = false,
  name,
  value = 'on',
}: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  const proxyRef = useRef<HTMLInputElement>(null);
  const [ownChecked, setOwnChecked] = useState(defaultChecked);
  const beginDraft = useFormDraft();
  const checked = controlledChecked ?? ownChecked;
  const inert = disabled || locked;

  // A form reset restores the switch to the state it was rendered with.
  useEffect(() => {
    const form = proxyRef.current?.form;
    if (!form || controlledChecked !== undefined) return;
    const onReset = () => setOwnChecked(defaultChecked);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [controlledChecked, defaultChecked]);

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
      onClick={() => {
        if (inert) return;
        beginDraft?.();
        if (controlledChecked === undefined) setOwnChecked(!checked);
        onCheckedChange?.(!checked);
      }}
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
      {name ? (
        <input ref={proxyRef} type="hidden" name={checked ? name : undefined} value={value} disabled={!checked} />
      ) : null}
    </button>
  );
}
