import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useCommandForm } from './command-state';
import { Button, FormDraftContext, Section, SurfaceCard, cx } from './kit';

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
  saveWhenChanged,
  ignoreFields = [],
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
  /** Show the save button only once a field differs from the value it started with. */
  saveWhenChanged?: boolean;
  /** Fields (such as a reason for the change) that don't count as a change on their own. */
  ignoreFields?: string[];
  children: ReactNode;
}) {
  const { busy, error, success, conflict, beginDraft, run, reload } = useCommandForm(submit, onDone);
  const formRef = useRef<HTMLFormElement>(null);
  const changes = useFormChanges(formRef, saveWhenChanged ? ignoreFields : null, success);
  const draft = () => {
    beginDraft();
    changes.check();
  };
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
    <FormDraftContext.Provider value={draft}>
      <form
        ref={formRef}
        className={className || undefined}
        onChangeCapture={draft}
        onInputCapture={changes.check}
        onReset={changes.check}
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
          (!saveWhenChanged || changes.changed || busy || error) && submitButton
        )}
      </form>
    </FormDraftContext.Provider>
  );
}

const snapshot = (form: HTMLFormElement, ignore: readonly string[]) =>
  JSON.stringify(
    [...new FormData(form)].filter(([name, value]) => typeof value === 'string' && !ignore.includes(name)),
  );

/**
 * Whether the form's values differ from the ones it was last loaded or saved with.
 * Checks on the next frame so a custom select has rendered its new value first.
 */
function useFormChanges(formRef: RefObject<HTMLFormElement | null>, ignore: string[] | null, saved: boolean) {
  const baseline = useRef('');
  const [changed, setChanged] = useState(false);
  // A string key keeps the effects stable when callers pass a fresh array each render.
  const ignoreKey = ignore ? JSON.stringify(ignore) : null;
  // Rebaseline on mount and whenever a save succeeds, so saved values count as the originals.
  useLayoutEffect(() => {
    if (ignoreKey === null || !formRef.current) return;
    baseline.current = snapshot(formRef.current, JSON.parse(ignoreKey) as string[]);
    setChanged(false);
  }, [formRef, ignoreKey, saved]);
  const check = useCallback(() => {
    if (ignoreKey === null) return;
    requestAnimationFrame(() => {
      if (formRef.current)
        setChanged(snapshot(formRef.current, JSON.parse(ignoreKey) as string[]) !== baseline.current);
    });
  }, [formRef, ignoreKey]);
  return { changed, check };
}

/** One group of settings: a titled section of the page whose controls sit in a single card. */
export function SettingsCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Section title={title} description={description}>
      <SurfaceCard className={cx('settings-card', className)}>{children}</SurfaceCard>
    </Section>
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
