import {
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';
import { Field } from './Field';

type SharedFieldProps = {
  label: string;
  hint?: string;
  hideLabel?: boolean;
  compact?: boolean;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
};

type TextFieldProps = SharedFieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'>;

type TextAreaFieldProps = SharedFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
    rows?: number;
  };

export function TextField({
  label,
  hint,
  hideLabel,
  compact,
  value,
  onChange,
  disabled,
  id,
  className,
  type = 'text',
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [focused, setFocused] = useState(false);
  const search = type === 'search';
  return (
    <Field
      label={label}
      hint={hint}
      htmlFor={fieldId}
      hideLabel={hideLabel ?? search}
      focused={focused}
      disabled={disabled}
      compact={compact}
      search={search}
      className={className}
    >
      <input
        {...inputProps}
        id={fieldId}
        className="field-control"
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  hideLabel,
  compact,
  value,
  onChange,
  disabled,
  id,
  className,
  rows = 3,
  ...areaProps
}: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [focused, setFocused] = useState(false);
  return (
    <Field
      label={label}
      hint={hint}
      htmlFor={fieldId}
      hideLabel={hideLabel}
      focused={focused}
      disabled={disabled}
      compact={compact}
      className={className}
    >
      <textarea
        {...areaProps}
        id={fieldId}
        className="field-control"
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        onFocus={(event) => {
          setFocused(true);
          areaProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          areaProps.onBlur?.(event);
        }}
      />
    </Field>
  );
}

export function SearchField(props: Omit<TextFieldProps, 'type'>) {
  return <TextField type="search" hideLabel {...props} />;
}

export function PhotoFileInput({
  id,
  inputRef,
  ariaLabel,
  onSelect,
}: {
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  ariaLabel?: string;
  onSelect(file: File): void;
}) {
  return (
    <input
      ref={inputRef}
      id={id}
      className="visually-hidden"
      type="file"
      accept="image/*"
      capture="environment"
      aria-label={ariaLabel}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) onSelect(file);
      }}
    />
  );
}

export function RadioInput({
  name,
  value,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange(): void;
}) {
  return <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />;
}
