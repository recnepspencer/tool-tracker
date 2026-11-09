import { useId, useRef, type ReactNode } from 'react';
import { useCommandForm } from './command-state';
import { Button, FormDraftContext, cx } from './kit';

/**
 * A FormData command form in the demo's admin markup: fields, an inline
 * `form-error`, then either a bare submit button (settings cards) or the
 * dialog's Cancel / submit actions. Keeps revision and conflict handling.
 */
export function CommandForm({
  submit,
  onDone,
  label,
  busyLabel = 'Saving…',
  variant = 'primary',
  onCancel,
  className = 'admin-form',
  noValidate,
  children,
}: {
  submit: (data: FormData) => Promise<unknown>;
  onDone?: (form: HTMLFormElement) => void;
  label: string;
  busyLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  onCancel?: () => void;
  className?: string;
  noValidate?: boolean;
  children: ReactNode;
}) {
  const { busy, error, conflict, beginDraft, run, reload } = useCommandForm(submit, onDone);
  const formRef = useRef<HTMLFormElement>(null);
  const submitButton = (
    <Button type="submit" variant={variant} disabled={busy}>
      {busy ? busyLabel : label}
    </Button>
  );
  const feedback = (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (formRef.current) void reload(formRef.current);
          }}
        >
          Load latest values
        </Button>
      )}
    </>
  );
  return (
    <FormDraftContext.Provider value={beginDraft}>
      <form
        ref={formRef}
        className={className || undefined}
        onChangeCapture={beginDraft}
        onSubmit={(event) => void run(event)}
        aria-busy={busy}
        noValidate={noValidate}
      >
        {children}
        {feedback}
        {onCancel ? (
          <div className="dialog-actions">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            {submitButton}
          </div>
        ) : (
          submitButton
        )}
      </form>
    </FormDraftContext.Provider>
  );
}

/** The demo's `settings-card`: a surface card named by its eyebrow heading. */
export function SettingsCard({
  eyebrow,
  className,
  children,
}: {
  eyebrow: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={cx('surface-card settings-card', className)} aria-labelledby={id}>
      <div className="settings-card-heading">
        <span className="eyebrow" id={id}>
          {eyebrow}
        </span>
      </div>
      {children}
    </section>
  );
}

/** A one-click command's error, shown the demo way. */
export function CommandError({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
