import { Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { errorMessage } from './client';
import { Button, FieldShell } from './kit';
import { BrandMark } from './shell-chrome';
import './experience/auth.css';

/** Demo AuthHero: the brand statement beside every account screen. */
function AuthHero() {
  return (
    <section className="auth-hero">
      <div className="auth-brand">
        <BrandMark />
        <span>
          Tool <em>Tracker</em>
        </span>
      </div>
      <span className="eyebrow">Tool custody system</span>
      <h1>Know where every tool went.</h1>
      <p>One shared record for the people, yards, and handoffs that keep the job moving.</p>
      <div className="auth-proof">
        <span>
          <strong>Shared</strong> custody record
        </span>
        <span>
          <strong>Role-based</strong> views
        </span>
        <span>
          <strong>Complete</strong> movement history
        </span>
      </div>
    </section>
  );
}

/** Demo AuthExperienceLayout: hero, then the panel holding this screen's task. */
export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · Tool Tracker`;
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <main className="auth-page" id="main-content">
      <AuthHero />
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="panel-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="auth-title" ref={heading} tabIndex={-1}>
            {title}
          </h2>
          <p>{description}</p>
        </div>
        <div className="auth-experience-content">{children}</div>
        {footer && <div className="auth-experience-links">{footer}</div>}
      </section>
    </main>
  );
}

// Account commands own their next screen; they do not invalidate business queries
// or display the generic record editor's "Saved" confirmation.
export function AccountForm({
  children,
  submit,
  label,
  pendingLabel,
  variant = 'primary',
  disabled = false,
}: {
  children?: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  label: string;
  pendingLabel: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  const errorId = useId();
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || disabled) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await submit(new FormData(event.currentTarget));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="auth-form"
      onSubmit={(event) => void run(event)}
      aria-busy={busy}
      aria-describedby={error ? errorId : undefined}
    >
      {children && (
        <fieldset className="auth-fieldset" disabled={busy}>
          {children}
        </fieldset>
      )}
      {error && (
        <p id={errorId} ref={alert} className="form-error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      <Button variant={variant} fullWidth disabled={busy || disabled} type="submit">
        {busy ? pendingLabel : label}
      </Button>
    </form>
  );
}

/** The kit field shell around an uncontrolled input, so account forms submit plain FormData. */
export function AccountField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id}>
      <input id={id} className="field-control" {...props} />
    </FieldShell>
  );
}

/** A logo already stored on the server (`id`), a newly chosen file, or nothing. */
export type LogoChoice = { id?: string | null; file?: File };

const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Optional company logo with a preview; the form uploads `file` when it submits. */
export function LogoField({ value, onChange }: { value: LogoChoice; onChange: (value: LogoChoice) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!value.file) {
      setPreview(value.id ? `/api/logos/${value.id}` : '');
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  function choose(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP logo under 2 MB.');
      return;
    }
    setError('');
    onChange({ file });
  }
  return (
    <FieldShell label="Company logo" hint="Optional" htmlFor={id}>
      <div className="auth-logo-field">
        {preview ? (
          <img className="auth-logo-preview" src={preview} alt="Company logo preview" />
        ) : (
          <span className="auth-logo-preview" aria-hidden="true">
            <ImageIcon size={20} />
          </span>
        )}
        <div className="auth-logo-actions">
          <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
            {preview ? 'Change logo' : 'Choose logo'}
          </Button>
          {preview && (
            <Button type="button" variant="ghost" onClick={() => onChange({})}>
              Remove
            </Button>
          )}
        </div>
        <input
          id={id}
          ref={input}
          type="file"
          accept={LOGO_TYPES.join(',')}
          hidden
          onChange={(event) => choose(event.currentTarget.files?.[0])}
        />
      </div>
      <small className="auth-hint" role={error ? 'alert' : undefined}>
        {error || 'JPEG, PNG, or WebP, up to 2 MB.'}
      </small>
    </FieldShell>
  );
}

export function PasswordInput({
  label,
  name,
  newPassword = false,
  hint,
}: {
  label: string;
  name: string;
  newPassword?: boolean;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id}>
      <div className="field-control-row">
        <input
          id={id}
          className="field-control"
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          minLength={newPassword ? 12 : undefined}
          maxLength={200}
          required
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="auth-reveal"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <small id={`${id}-hint`} className="auth-hint">
          {hint}
        </small>
      )}
    </FieldShell>
  );
}

export function PasswordFields() {
  return (
    <>
      <PasswordInput
        label="New password"
        name="password"
        newPassword
        hint="Use at least 12 characters. Avoid common passwords."
      />
      <PasswordInput label="Confirm password" name="confirm" newPassword />
    </>
  );
}

export function EmailDelivery({
  email,
  recovery = false,
  resend,
  changeEmail,
}: {
  email: string;
  recovery?: boolean;
  resend: () => Promise<void>;
  changeEmail: () => void;
}) {
  const [remaining, setRemaining] = useState(30);
  const [resent, setResent] = useState(false);
  useEffect(() => {
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  return (
    <>
      <div className="auth-notice" role="status">
        <p>
          {recovery ? (
            <>
              If an account exists for <strong>{email}</strong>, {resent ? 'another' : 'a'} password reset link has been
              sent.
            </>
          ) : (
            <>
              Check <strong>{email}</strong> for {resent ? 'another' : 'a'} verification link.
            </>
          )}
        </p>
        <p>
          {recovery
            ? 'Open the link to choose a new password.'
            : 'Open the link to verify your email and choose a password. The link expires in one hour.'}
        </p>
      </div>
      <p className="auth-help">No email yet? Check your spam folder, or request another link.</p>
      <AccountForm
        variant="secondary"
        label={remaining ? `Resend email in ${remaining}s` : 'Resend email'}
        pendingLabel="Sending…"
        disabled={remaining > 0}
        submit={async () => {
          await resend();
          setResent(true);
          setRemaining(30);
        }}
      />
      <Button variant="ghost" fullWidth onClick={changeEmail}>
        Use a different email
      </Button>
    </>
  );
}
