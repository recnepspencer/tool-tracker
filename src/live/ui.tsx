import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { useCommandForm } from './command-state';

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  );
}
export function Select({
  label,
  name,
  children,
  defaultValue,
  required = true,
  value,
  onChange,
}: {
  label: string;
  name: string;
  children: ReactNode;
  defaultValue?: string;
  required?: boolean;
  value?: string;
  onChange?: SelectHTMLAttributes<HTMLSelectElement>['onChange'];
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={defaultValue} value={value} onChange={onChange} required={required}>
        {children}
      </select>
    </div>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p className={error ? 'notice error' : 'notice'} role={error ? 'alert' : 'status'}>
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
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  label?: string;
  onDone?: () => void;
  disabled?: boolean;
}) {
  const { busy, error, success, conflict, beginDraft, run, reload } = useCommandForm(submit, onDone);
  return (
    <form className="form" onChangeCapture={beginDraft} onSubmit={(e) => void run(e)} aria-busy={busy}>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && <Notice error>{error}</Notice>}
      {conflict && (
        <button type="button" onClick={(event) => void reload(event.currentTarget.form!)}>
          Load latest values
        </button>
      )}
      {success && <Notice>Saved successfully.</Notice>}
      <button className="primary" disabled={busy || disabled} type="submit">
        {busy ? 'Please wait…' : label}
      </button>
    </form>
  );
}
export const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export function Loading() {
  return (
    <p role="status" className="muted">
      Loading…
    </p>
  );
}
export function Empty({ children = 'Nothing here yet.' }: { children?: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="panel" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export const human = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' · ');
export const date = (value: string | null) => (value ? new Date(value).toLocaleString() : 'Current');
