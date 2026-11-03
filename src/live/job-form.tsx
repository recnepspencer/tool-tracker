import type { ReactNode } from 'react';
import { useCommandForm } from './command-state';
import { Button, FormDraftContext } from './kit';

/** Demo `job-form` with live revision handling: errors, conflicts and the dialog actions row. */
export function JobForm({
  submit,
  onDone,
  onCancel,
  label,
  busyLabel = 'Saving…',
  disabled = false,
  children,
}: {
  submit(form: FormData): Promise<unknown>;
  onDone?(form: HTMLFormElement): void;
  onCancel?(): void;
  label: string;
  busyLabel?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const { busy, error, conflict, beginDraft, run, reload } = useCommandForm(submit, onDone);
  return (
    <FormDraftContext.Provider value={beginDraft}>
      <form className="job-form" onChangeCapture={beginDraft} onSubmit={(event) => void run(event)}>
        {children}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {conflict && (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) void reload(form);
            }}
          >
            Load latest values
          </Button>
        )}
        <div className="job-dialog-actions">
          {onCancel && (
            <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy || disabled}>
            {busy ? busyLabel : label}
          </Button>
        </div>
      </form>
    </FormDraftContext.Provider>
  );
}
