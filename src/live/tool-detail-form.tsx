import type { ReactNode } from 'react';
import { useCommandForm } from './command-state';
import { Button, FormDraftContext } from './kit';

/**
 * A FormData command form in the demo's sheet and dialog idioms. It keeps the
 * live busy, error and stale-revision handling of `ui.tsx` Form, but lays out
 * its submit like the demo: one full-width button in a sheet panel, or
 * Cancel + confirm in `dialog-actions` when `onCancel` is given.
 */
export function CommandForm({
  children,
  submit,
  onDone,
  submitLabel,
  submitVariant = 'primary',
  submitClassName,
  disabled = false,
  onCancel,
  className,
  label,
  after,
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<unknown>;
  onDone?: (form: HTMLFormElement) => void;
  submitLabel: string;
  submitVariant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  submitClassName?: string;
  disabled?: boolean;
  onCancel?: () => void;
  className?: string;
  label?: string;
  after?: ReactNode;
}) {
  const { busy, error, conflict, beginDraft, run, reload } = useCommandForm(submit, onDone);
  const dialog = !!onCancel;
  const submitButton = (
    <Button
      type="submit"
      className={submitClassName}
      variant={submitVariant}
      fullWidth={!dialog}
      disabled={busy || disabled}
    >
      {busy ? 'Saving…' : submitLabel}
    </Button>
  );
  return (
    <FormDraftContext.Provider value={beginDraft}>
      <form
        className={className}
        aria-label={label}
        aria-busy={busy}
        onChangeCapture={beginDraft}
        onSubmit={(event) => void run(event)}
      >
        {children}
        {error && (
          <p className={dialog ? 'form-error' : 'detail-action-error'} role="alert">
            {error}
          </p>
        )}
        {conflict && (
          <Button type="button" variant="ghost" onClick={(event) => void reload(event.currentTarget.form!)}>
            Load latest values
          </Button>
        )}
        {dialog ? (
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            {submitButton}
          </div>
        ) : (
          submitButton
        )}
        {after}
      </form>
    </FormDraftContext.Provider>
  );
}
