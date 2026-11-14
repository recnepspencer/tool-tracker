import { Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { errorMessage } from './client';
import { Button, FieldShell, LoadingState } from './kit';

// The cropper is only needed once someone picks a logo.
const LogoCropper = lazy(() => import('./logo-cropper').then((m) => ({ default: m.LogoCropper })));
import './experience/auth.css';

/** The product name, then one narrow column holding this screen's task. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
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
      <div className="auth-brand">Tool Tracker</div>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="panel-heading">
          <h1 id="auth-title" ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {description && <p>{description}</p>}
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
  alternatives,
}: {
  children?: ReactNode;
  /** Other ways to submit, after the main button, so Enter still presses the main one. */
  alternatives?: ReactNode;
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
      // The submitter carries which button was pressed (a sign-in provider, say).
      await submit(new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter));
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
      {alternatives && (
        <fieldset className="auth-fieldset" disabled={busy || disabled}>
          {alternatives}
        </fieldset>
      )}
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

/** Optional company logo, shaped and cropped for its slots; the form uploads `file` when it submits. */
export function LogoField({ value, onChange }: { value: LogoChoice; onChange: (value: LogoChoice) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  // The chosen file stays uncropped, so adjusting again starts from the full image.
  const [original, setOriginal] = useState<File>();
  const [editing, setEditing] = useState('');
  useEffect(() => {
    if (!value.file) {
      setPreview(value.id ? `/api/logos/${value.id}` : '');
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  useEffect(() => {
    if (!editing.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(editing);
  }, [editing]);
  function choose(file: File | undefined) {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP logo under 10 MB.');
      return;
    }
    setError('');
    setOriginal(file);
    setEditing(URL.createObjectURL(file));
  }
  function adjust() {
    setEditing(original ? URL.createObjectURL(original) : preview);
  }
  return (
    <FieldShell label="Company logo" hint="Optional" htmlFor={id}>
      {editing ? (
        <Suspense fallback={<LoadingState label="Opening the logo editor…" />}>
          <LogoCropper
            source={editing}
            onCancel={() => setEditing('')}
            onDone={(file) => {
              setEditing('');
              onChange({ file });
            }}
          />
        </Suspense>
      ) : (
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
              <>
                <Button type="button" variant="ghost" onClick={adjust}>
                  Adjust
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOriginal(undefined);
                    onChange({});
                  }}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      <input
        id={id}
        ref={input}
        type="file"
        accept={LOGO_TYPES.join(',')}
        hidden
        onChange={(event) => choose(event.currentTarget.files?.[0])}
      />
      <small className="auth-hint" role={error ? 'alert' : undefined}>
        {error || 'JPEG, PNG, or WebP, up to 10 MB.'}
      </small>
    </FieldShell>
  );
}

export function PasswordInput({
  label,
  name,
  newPassword = false,
  hint,
  action,
}: {
  label: string;
  name: string;
  newPassword?: boolean;
  hint?: string;
  action?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  // The hint sits under the box, so this box is the same height as every other field.
  return (
    <div className="auth-described">
      <FieldShell label={label} htmlFor={id} action={action}>
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
      </FieldShell>
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
