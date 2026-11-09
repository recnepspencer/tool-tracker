import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cx } from './cx';
import { ChevronDownIcon } from './ChevronDownIcon';
import { Field } from './Field';
import {
  optionDomId,
  sectionSelectOptions,
  selectedSelectOption,
  SEARCH_THRESHOLD,
  SECTION_THRESHOLD,
  type SelectOption,
} from './select-options';
import { useFormDraft } from './form-draft';
import { useListboxOverlay } from './use-listbox-overlay';
import { useModalFocusTrap } from '../experience/use-modal-focus-trap';

export type { SelectOption };

const PHONE_QUERY = '(max-width: 620px)';
const RECENT_LIMIT = 5;

/** On a phone every picker is a bottom sheet with full-width rows; a popover is a desktop control. */
function usePhoneLayout() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

// Recent picks are a convenience for this browser only, so storage that is missing or full is ignored.
const recentKey = (label: string) => `tool-tracker.select-recent.${label}`;
function readRecent(label: string): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(recentKey(label)) ?? '[]');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
function rememberRecent(label: string, value: string) {
  try {
    const next = [value, ...readRecent(label).filter((item) => item !== value)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(recentKey(label), JSON.stringify(next));
  } catch {
    // Nothing to do: the list simply has no Recent section.
  }
}

export interface SelectFieldProps {
  label: string;
  hint?: string;
  hideLabel?: boolean;
  compact?: boolean;
  /** Controlled value. Omit it, with `defaultValue`, for a form-owned field. */
  value?: string;
  defaultValue?: string;
  onChange?(value: string): void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  emptyMessage?: string;
  className?: string;
  /** Defaults to a search field once the list is longer than a screenful. */
  searchable?: boolean;
  /** A sheet on every screen size; otherwise a popover on desktop and a sheet on a phone. */
  presentation?: 'popover' | 'sheet';
}

export function SelectField({
  label,
  hint,
  hideLabel,
  compact,
  value: controlledValue,
  defaultValue = '',
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  name,
  emptyMessage = 'No matches',
  className,
  searchable: searchableProp,
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
  const [ownValue, setOwnValue] = useState(defaultValue);
  const value = controlledValue ?? ownValue;
  const proxyRef = useRef<HTMLInputElement>(null);
  const beginDraft = useFormDraft();
  const selected = selectedSelectOption(options, value);
  const phone = usePhoneLayout();
  const isSheet = presentation === 'sheet' || phone;
  const searchable = searchableProp ?? options.length > SEARCH_THRESHOLD;
  const long = options.length > SECTION_THRESHOLD;
  const [recent, setRecent] = useState<string[]>([]);
  const sections = useMemo(
    () => sectionSelectOptions(options, searchable && open ? query : '', open && long ? recent : []),
    [long, open, options, query, recent, searchable],
  );
  // Keyboard movement runs through the options in the order they are shown, section by section.
  const filtered = useMemo(() => sections.flatMap((section) => section.options), [sections]);
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

  const openList = () => {
    if (long) setRecent(readRecent(label));
    setOpen(true);
  };

  const choose = (option: SelectOption) => {
    if (long) rememberRecent(label, option.value);
    if (option.value !== value) {
      beginDraft?.();
      if (controlledValue === undefined) setOwnValue(option.value);
      onChange?.(option.value);
    }
    close(true);
  };

  // A form reset restores the field to the value it was rendered with.
  useEffect(() => {
    const form = proxyRef.current?.form;
    if (!form || controlledValue !== undefined) return;
    const onReset = () => setOwnValue(defaultValue);
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [controlledValue, defaultValue]);

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
        openList();
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
        openList();
        return;
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openList();
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

  // A titled section is a labelled group inside the listbox; an untitled one is just its options.
  const renderSections = (renderOption: (option: SelectOption, index: number) => ReactNode, sheet: boolean) => {
    let index = 0;
    return sections.map((section) => {
      const rendered = section.options.map((option) => renderOption(option, index++));
      if (!section.title) return <Fragment key="all">{rendered}</Fragment>;
      const heading = (
        <span className="field-section" aria-hidden="true">
          {section.title}
        </span>
      );
      return sheet ? (
        <div key={section.title} className="field-sheet-group" role="group" aria-label={section.title}>
          {heading}
          {rendered}
        </div>
      ) : (
        <li key={section.title} role="none">
          {heading}
          <ul className="field-listbox-group" role="group" aria-label={section.title}>
            {rendered}
          </ul>
        </li>
      );
    });
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
          disabled={disabled}
          aria-label={label}
          aria-required={required || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && active ? optionDomId(listboxId, active.value) : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={() => {
            if (disabled) return;
            if (open) close();
            else openList();
          }}
          onKeyDown={onButtonKeyDown}
        >
          <span className={cx('field-select-trigger__value', !selected && 'field-select-trigger__value--placeholder')}>
            {selected?.label ?? placeholder}
          </span>
        </button>
        <ChevronDownIcon className="field-chevron" />
        {name ? (
          // Submits the value with its form and carries native required validation.
          <input
            ref={proxyRef}
            className="field-select-proxy"
            name={name}
            value={value}
            required={required}
            tabIndex={-1}
            aria-hidden="true"
            onChange={() => undefined}
            onFocus={() => triggerRef.current?.focus()}
          />
        ) : null}
      </Field>
      {open && !isSheet
        ? createPortal(
            <div ref={listRef} className={cx('field-popover', long && 'field-popover--long')} style={overlayStyle}>
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
                  renderSections(
                    (option, index) => (
                      <li
                        key={option.value}
                        id={optionDomId(listboxId, option.value)}
                        role="option"
                        data-value={option.value}
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
                        <span>
                          {option.label}
                          {option.description ? <small>{option.description}</small> : null}
                        </span>
                        {option.value === value ? <Check className="field-option-check" aria-hidden="true" /> : null}
                      </li>
                    ),
                    false,
                  )
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
                className={cx('field-sheet', long && 'field-sheet--tall')}
                role="dialog"
                aria-modal="true"
                aria-label={`Choose ${label}`}
              >
                <span className="field-sheet-handle" aria-hidden="true" />
                <header className="field-sheet-header">
                  <h2>{label}</h2>
                  <button type="button" className="button button--ghost" onClick={() => close(true)}>
                    Cancel
                  </button>
                </header>
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
                    renderSections(
                      (option, index) => (
                        <button
                          ref={(element) => setOptionRef(option.value, element)}
                          type="button"
                          role="option"
                          data-value={option.value}
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
                          {option.value === value ? <Check className="field-option-check" aria-hidden="true" /> : null}
                        </button>
                      ),
                      true,
                    )
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
