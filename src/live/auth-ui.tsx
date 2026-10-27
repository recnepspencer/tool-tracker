import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from './client';

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · Nelson Electric`;
    heading.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <main className="auth-layout" id="main-content">
      <header className="auth-header">
        <Link to="/login" className="auth-brand">
          <span className="auth-monogram" aria-hidden="true">
            N
          </span>
          Nelson Electric
        </Link>
      </header>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-inner">
          <div className="auth-heading">
            <h1 id="auth-title" ref={heading} tabIndex={-1}>
              {title}
            </h1>
            <p>{description}</p>
          </div>
          {children}
        </div>
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
  secondary = false,
  disabled = false,
}: {
  children?: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  label: string;
  pendingLabel: string;
  secondary?: boolean;
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
      className="form"
      onSubmit={(event) => void run(event)}
      aria-busy={busy}
      aria-describedby={error ? errorId : undefined}
    >
      {children && <fieldset disabled={busy}>{children}</fieldset>}
      {error && (
        <p id={errorId} ref={alert} className="auth-error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      <button className={secondary ? 'auth-secondary' : 'primary'} disabled={busy || disabled} type="submit">
        {busy ? pendingLabel : label}
      </button>
    </form>
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
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input
          id={id}
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
    </div>
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

export function AccountFooter({ children }: { children: ReactNode }) {
  return <div className="auth-footer">{children}</div>;
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
      <div className="auth-message" role="status">
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
        secondary
        label={remaining ? `Resend email in ${remaining}s` : 'Resend email'}
        pendingLabel="Sending…"
        disabled={remaining > 0}
        submit={async () => {
          await resend();
          setResent(true);
          setRemaining(30);
        }}
      />
      <button className="auth-text-button" onClick={changeEmail}>
        Use a different email
      </button>
    </>
  );
}
