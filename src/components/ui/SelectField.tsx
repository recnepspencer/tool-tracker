import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { Field } from './Field';
import { filterSelectOptions, optionDomId, selectedSelectOption, type SelectOption } from './select-options';
import { useListboxOverlay } from './use-listbox-overlay';

export type { SelectOption };

interface SelectFieldProps {
  label: string;
  hint?: string;
  hideLabel?: boolean;
  compact?: boolean;
  value: string;
  onChange(value: string): void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  emptyMessage?: string;
  className?: string;
}

export function SelectField({
  label,
  hint,
  hideLabel,
  compact,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  name,
  emptyMessage = 'No matches',
  className,
}: SelectFieldProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const selected = selectedSelectOption(options, value);
  const filtered = useMemo(() => filterSelectOptions(options, open ? query : ''), [open, options, query]);
  const [activeIndex, setActiveIndex] = useState(0);
  const overlayStyle = useListboxOverlay(open, fieldRef, listRef);
  const active = filtered[activeIndex];

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filtered, open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    inputRef.current?.focus();
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        if (!filtered.length) return 0;
        return (current + delta + filtered.length) % filtered.length;
      });
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (active) choose(active);
    }
  };

  return (
    <div ref={fieldRef} className="field-anchor">
      <Field
        label={label}
        hint={hint}
        htmlFor={generatedId}
        hideLabel={hideLabel}
        focused={focused || open}
        disabled={disabled}
        compact={compact}
        className={className}
      >
        <div className="field-control-row">
          <input
            ref={inputRef}
            id={generatedId}
            className="field-control"
            role="combobox"
            name={name}
            disabled={disabled}
            required={required && !value}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={open && active ? optionDomId(listboxId, active.value) : undefined}
            placeholder={placeholder}
            value={open ? query : (selected?.label ?? '')}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onClick={() => !disabled && setOpen(true)}
            onKeyDown={onInputKeyDown}
          />
          <span className="field-chevron" aria-hidden="true">
            ▾
          </span>
        </div>
      </Field>
      {open
        ? createPortal(
            <ul
              ref={listRef}
              id={listboxId}
              className="field-listbox"
              role="listbox"
              aria-label={label}
              style={overlayStyle}
              onMouseDown={(event) => event.preventDefault()}
            >
              {filtered.length ? (
                filtered.map((option, index) => (
                  <li
                    key={option.value}
                    id={optionDomId(listboxId, option.value)}
                    role="option"
                    className={cx(
                      'field-option',
                      index === activeIndex && 'field-option--active',
                      option.value === value && 'field-option--selected',
                    )}
                    aria-selected={option.value === value}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                  >
                    {option.label}
                    {option.description ? <small>{option.description}</small> : null}
                  </li>
                ))
              ) : (
                <li className="field-empty">{emptyMessage}</li>
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
