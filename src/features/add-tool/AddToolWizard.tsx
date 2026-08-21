import { useState } from 'react';
import { useSession } from '../../app/session-context';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { MockPhotoCapture } from './MockPhotoCapture';
import { ToolDetailsForm } from './ToolDetailsForm';
import { initialToolDraft, type ToolDraft } from './add-tool-types';
import { useAddToolController } from './use-add-tool-controller';
import '../../styles/add-tool.css';

export function AddToolWizard({ onClose }: { onClose(): void }) {
  const { session } = useSession();
  const [step, setStep] = useState<'capture' | 'details'>('capture');
  const [captured, setCaptured] = useState(false);
  const [draft, setDraft] = useState<ToolDraft>(() => ({
    ...initialToolDraft,
    warehouseId: session?.homeWarehouseId ?? '',
  }));
  const controller = useAddToolController({ session, captured, draft, onClose });
  if (!session) return null;
  const update = (key: keyof ToolDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <OverlayDialog
      label="Add a tool"
      onClose={onClose}
      backdropClassName="add-tool-backdrop"
      panelClassName="add-tool-dialog"
    >
      <div className="add-tool-header">
        <div>
          <span className="eyebrow">New custody record</span>
          <h2>Add a tool</h2>
        </div>
        <button type="button" className="icon-button" aria-label="Close add tool" onClick={onClose}>
          ×
        </button>
      </div>
      {step === 'capture' ? (
        <MockPhotoCapture
          captured={captured}
          onCapture={() => setCaptured((value) => !value)}
          onContinue={() => setStep('details')}
        />
      ) : (
        <ToolDetailsForm
          draft={draft}
          error={controller.error}
          busy={controller.busy}
          onUpdate={update}
          onBack={() => setStep('capture')}
          onSave={() => void controller.save()}
          categories={controller.categories}
        />
      )}
    </OverlayDialog>
  );
}
