import {
  Children,
  Fragment,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { useCommandForm } from './command-state';
import { Button, FieldShell, FormDraftContext, LoadingState, SelectField, cx, type SelectOption } from './kit';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; compact?: boolean };

/** An uncontrolled, form-owned text field in the demo's labelled field shell. */
export function Field({ label, hint, compact, className, type = 'text', disabled, ...props }: FieldProps) {
  const id = useId();
  const search = type === 'search';
  return (
    <FieldShell
      label={label}
      hint={hint}
      htmlFor={id}
      hideLabel={search}
      search={search}
      compact={compact}
      disabled={disabled}
      className={className}
    >
      <input id={id} className="field-control" type={type} disabled={disabled} {...props} />
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} htmlFor={id} className={className}>
      <textarea id={id} className="field-control" rows={rows} {...props} />
    </FieldShell>
  );
}

function optionsFrom(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child): SelectOption[] => {
    if (!isValidElement(child)) return [];
    const element = child as ReactElement<{ value?: string; children?: ReactNode }>;
    if (element.type === Fragment) return optionsFrom(element.props.children);
    if (element.type !== 'option') return [];
    const label = Children.toArray(element.props.children).join('');
    return [{ value: String(element.props.value ?? label), label }];
  });
}

/**
 * A form-owned choice rendered with the demo's searchable listbox. `<option>`
 * children describe the choices; an empty-valued option on a required field is
 * its placeholder rather than a selectable value.
 */
export function Select({
  label,
  name,
  children,
  defaultValue,
  required = true,
  value,
  onChange,
  hint,
  compact,
  searchable,
  presentation,
}: {
  label: string;
  name?: string;
  children: ReactNode;
  defaultValue?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  hint?: string;
  compact?: boolean;
  searchable?: boolean;
  presentation?: 'popover' | 'sheet';
}) {
  const all = optionsFrom(children);
  const placeholder = required ? all.find((option) => option.value === '') : undefined;
  const options = placeholder ? all.filter((option) => option !== placeholder) : all;
  const initial = defaultValue ?? (placeholder ? '' : (options[0]?.value ?? ''));
  return (
    <SelectField
      label={label}
      name={name}
      hint={hint}
      compact={compact}
      options={options}
      placeholder={placeholder?.label}
      required={required}
      value={value}
      defaultValue={initial}
      onChange={onChange}
      searchable={searchable ?? options.length > 6}
      presentation={presentation}
    />
  );
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p className={error ? 'form-error' : 'form-status'} role={error ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function Form({
  children,
  submit,
  label = 'Save',
  onDone,
  disabled = false,
  successMessage = 'Saved successfully.',
  variant = 'primary',
  className,
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  label?: string;
  onDone?: (form: HTMLFormElement) => void;
  disabled?: boolean;
  successMessage?: string | null;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
}) {
  const { busy, error, success, conflict, beginDraft, run, reload } = useCommandForm(submit, onDone);
  return (
    <FormDraftContext.Provider value={beginDraft}>
      <form
        className={cx('form', className)}
        onChangeCapture={beginDraft}
        onSubmit={(e) => void run(e)}
        aria-busy={busy}
      >
        <fieldset className="form-fields" disabled={busy}>
          {children}
        </fieldset>
        {error && <Notice error>{error}</Notice>}
        {conflict && (
          <Button type="button" variant="ghost" onClick={(event) => void reload(event.currentTarget.form!)}>
            Load latest values
          </Button>
        )}
        {success && successMessage && <Notice>{successMessage}</Notice>}
        <Button variant={variant} disabled={busy || disabled} type="submit" fullWidth>
          {busy ? 'Please wait…' : label}
        </Button>
      </form>
    </FormDraftContext.Provider>
  );
}
export const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export function Loading() {
  return <LoadingState />;
}
export const human = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' · ');
