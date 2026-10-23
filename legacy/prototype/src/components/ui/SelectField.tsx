import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { ChevronDownIcon } from './ChevronDownIcon';
import { Field } from './Field';
import { filterSelectOptions, optionDomId, selectedSelectOption, type SelectOption } from './select-options';
import { useListboxOverlay } from './use-listbox-overlay';
import { useModalFocusTrap } from './use-modal-focus-trap';

export type { SelectOption };

export interface SelectFieldProps {
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
  searchable?: boolean;
  presentation?: 'popover' | 'sheet';
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
  searchable = true,
  presentation = 'popover',
}: SelectFieldProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const sheetSearchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLInputElement | HTMLButtonElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = selectedSelectOption(options, value);
  const isSheet = presentation === 'sheet';
  const filtered = useMemo(
    () => filterSelectOptions(options, searchable && open ? query : ''),
    [open, options, query, searchable],
  );
  const active = filtered[activeIndex];
  const overlayStyle = useListboxOverlay(!isSheet && open, fieldRef, listRef);
  useModalFocusTrap(open && isSheet, () => close(true), sheetRef);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filtered, open, value]);

  useEffect(() => {
    if (!open || !isSheet) return;
    if (document.activeElement === sheetSearchRef.current) return;
    const activeOption = filtered[activeIndex];
    if (!activeOption) return;
    const activeOptionElement = optionRefs.current.get(activeOption.value);
    if (document.activeElement === activeOptionElement) return;
    const frame = window.requestAnimationFrame(() => activeOptionElement?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, filtered, isSheet, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        fieldRef.current?.contains(target) ||
        listRef.current?.contains(target) ||
        sheetRef.current?.contains(target)
      ) {
        return;
      }
      const restoreFocus = isSheet && target instanceof Element && target.classList.contains('field-sheet-scrim');
      close(restoreFocus);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isSheet, open]);

  const close = (restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (option: SelectOption) => {
    onChange(option.value);
    close(true);
  };

  const moveActive = (delta: number) => {
    setActiveIndex((current) => {
      if (!filtered.length) return 0;
      return (current + delta + filtered.length) % filtered.length;
    });
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (active) choose(active);
    }
  };

  const onButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (active) {
        choose(active);
      }
    }
  };

  const onSheetOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = filtered.length ? (index + delta + filtered.length) % filtered.length : 0;
      setActiveIndex(nextIndex);
      const next = filtered[nextIndex];
      if (next) optionRefs.current.get(next.value)?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : Math.max(filtered.length - 1, 0);
      setActiveIndex(nextIndex);
      const next = filtered[nextIndex];
      if (next) optionRefs.current.get(next.value)?.focus();
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && filtered[index]) {
      event.preventDefault();
      choose(filtered[index]);
    }
  };

  const setOptionRef = (valueToStore: string, element: HTMLButtonElement | null) => {
    if (element) optionRefs.current.set(valueToStore, element);
    else optionRefs.current.delete(valueToStore);
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
        className={cx(className, 'field--select')}
      >
        <button
          ref={(element) => {
            triggerRef.current = element;
          }}
          id={generatedId}
          type="button"
          className="field-select-trigger"
          role="combobox"
          name={name}
          disabled={disabled}
          aria-label={label}
          aria-required={required || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && active ? optionDomId(listboxId, active.value) : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={() => !disabled && setOpen((current) => !current)}
          onKeyDown={onButtonKeyDown}
        >
          <span className={cx('field-select-trigger__value', !selected && 'field-select-trigger__value--placeholder')}>
            {selected?.label ?? placeholder}
          </span>
        </button>
        <ChevronDownIcon className="field-chevron" />
      </Field>
      {open && !isSheet
        ? createPortal(
            <div ref={listRef} className="field-popover" style={overlayStyle}>
              {searchable ? (
                <div className="field-popover-search">
                  <label className="sr-only" htmlFor={`${generatedId}-popover-search`}>
                    Search {label}
                  </label>
                  <input
                    id={`${generatedId}-popover-search`}
                    className="field-popover-search-input"
                    type="search"
                    role="searchbox"
                    autoComplete="off"
                    spellCheck={false}
                    aria-autocomplete="list"
                    aria-controls={listboxId}
                    aria-activedescendant={active ? optionDomId(listboxId, active.value) : undefined}
                    placeholder={`Search ${label}`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onInputKeyDown}
                  />
                </div>
              ) : null}
              <ul id={listboxId} className="field-listbox" role="listbox" aria-label={label}>
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
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                    >
                      {option.label}
                      {option.description ? <small>{option.description}</small> : null}
                    </li>
                  ))
                ) : (
                  <li className="field-empty">{emptyMessage}</li>
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
      {open && isSheet
        ? createPortal(
            <div className="field-sheet-layer" role="presentation">
              <button
                type="button"
                className="field-sheet-scrim"
                aria-label={`Close ${label} options`}
                onClick={() => close(true)}
              />
              <section
                ref={sheetRef}
                className="field-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={`Choose ${label}`}
              >
                <span className="field-sheet-handle" aria-hidden="true" />
                <h2>{label}</h2>
                {searchable ? (
                  <div className="field-sheet-search">
                    <label className="sr-only" htmlFor={`${generatedId}-sheet-search`}>
                      Search {label}
                    </label>
                    <input
                      ref={sheetSearchRef}
                      id={`${generatedId}-sheet-search`}
                      className="field-sheet-search-input"
                      type="search"
                      role="searchbox"
                      autoComplete="off"
                      spellCheck={false}
                      aria-autocomplete="list"
                      aria-controls={listboxId}
                      aria-activedescendant={active ? optionDomId(listboxId, active.value) : undefined}
                      placeholder={`Search ${label}`}
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                      }}
                      onKeyDown={onInputKeyDown}
                    />
                  </div>
                ) : null}
                <div id={listboxId} className="field-sheet-options" role="listbox" aria-label={label}>
                  {filtered.length ? (
                    filtered.map((option, index) => (
                      <button
                        ref={(element) => setOptionRef(option.value, element)}
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        className={cx(
                          'field-sheet-option',
                          index === activeIndex && 'field-sheet-option--active',
                          option.value === value && 'field-sheet-option--selected',
                        )}
                        key={option.value}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(option)}
                        onKeyDown={(event) => onSheetOptionKeyDown(event, index)}
                      >
                        <span>
                          {option.label}
                          {option.description ? <small>{option.description}</small> : null}
                        </span>
                        <span className="field-option-radio" aria-hidden="true" />
                      </button>
                    ))
                  ) : (
                    <p className="field-empty">{emptyMessage}</p>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
