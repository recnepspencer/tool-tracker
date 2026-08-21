import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { TextField } from '../../components/ui/TextField';
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
        <p className="settings-muted">Restore seeded demo data. Your session and browser theme are preserved.</p>
        <Button variant="danger" onClick={() => setOpen(true)} disabled={blocked || mutations.resetDemoData.isPending}>
          Reset demo data
        </Button>
      </SurfaceCard>
      {open && (
        <OverlayDialog label="Reset demo data" onClose={() => !mutations.resetDemoData.isPending && setOpen(false)}>
          <div className="dialog-heading">
            <span className="eyebrow">Danger zone</span>
            <h2>Reset all demo data?</h2>
          </div>
          <p>This restores the deterministic seed and cannot be undone. Type RESET DEMO DATA to continue.</p>
          <TextField
            label="Confirmation"
            value={confirmation}
            onChange={setConfirmation}
            placeholder="RESET DEMO DATA"
          />
          <div className="dialog-actions">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutations.resetDemoData.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={reset}
              disabled={blocked || confirmation !== 'RESET DEMO DATA' || mutations.resetDemoData.isPending}
            >
              Reset data
            </Button>
          </div>
        </OverlayDialog>
      )}
    </>
  );
}
