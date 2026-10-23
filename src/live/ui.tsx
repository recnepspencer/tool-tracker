import { useId, useState, type FormEvent, type ReactNode, type InputHTMLAttributes } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from './client';

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
}: {
  label: string;
  name: string;
  children: ReactNode;
  defaultValue?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={defaultValue} required={required}>
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
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  label?: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const cache = useQueryClient();
  const run = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      await submit(new FormData(event.currentTarget));
      setSuccess(true);
      await cache.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      onDone?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form" onSubmit={(e) => void run(e)} aria-busy={busy}>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && <Notice error>{error}</Notice>}
      {success && <Notice>Saved successfully.</Notice>}
      <button className="primary" disabled={busy} type="submit">
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
