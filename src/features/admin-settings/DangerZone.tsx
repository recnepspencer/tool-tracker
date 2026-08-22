import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { TextField } from '../../components/ui/TextField';
import { WORKSPACE_RESET_CONFIRMATION } from '../../domain/workspace-reset';
import type { SettingsMutations } from './use-settings-mutations';

export function DangerZone({ mutations, blocked }: { mutations: SettingsMutations; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const reset = () =>
    void mutations.resetDemoData
      .mutateAsync(confirmation)
      .then(() => {
        setOpen(false);
        setConfirmation('');
      })
      .catch(() => undefined);
  return (
    <>
      <SurfaceCard className="settings-card--danger">
        <div className="settings-card-heading">
          <span className="eyebrow">Danger zone</span>
        </div>
        <p className="settings-muted">
          Restore the workspace to its original starting data. Your session and browser theme are preserved.
        </p>
        <Button variant="danger" onClick={() => setOpen(true)} disabled={blocked || mutations.resetDemoData.isPending}>
          Reset workspace data
        </Button>
      </SurfaceCard>
      {open && (
        <OverlayDialog
          label="Reset workspace data"
          onClose={() => !mutations.resetDemoData.isPending && setOpen(false)}
          panelClassName="admin-dialog"
          showCloseButton
        >
          <div className="dialog-heading">
            <span className="eyebrow">Danger zone</span>
            <h2>Reset all workspace data?</h2>
          </div>
          <p>
            This restores the original workspace data and cannot be undone. Type {WORKSPACE_RESET_CONFIRMATION} to
            continue.
          </p>
          <TextField
            label="Confirmation"
            value={confirmation}
            onChange={setConfirmation}
            placeholder={WORKSPACE_RESET_CONFIRMATION}
          />
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutations.resetDemoData.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={reset}
              disabled={blocked || confirmation !== WORKSPACE_RESET_CONFIRMATION || mutations.resetDemoData.isPending}
            >
              Reset data
            </Button>
          </div>
        </OverlayDialog>
      )}
    </>
  );
}
