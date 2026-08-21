import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../app/session-context';
import { useModalFocusTrap } from '../../components/ui/use-modal-focus-trap';
import { useToolCatalog } from '../worker-catalog/use-tool-catalog';
import { MockPhotoCapture } from './MockPhotoCapture';
import { ToolDetailsForm } from './ToolDetailsForm';
import { initialToolDraft, type ToolDraft } from './add-tool-types';
import { useAddToolController } from './use-add-tool-controller';
import '../../styles/add-tool.css';

export function AddToolWizard({ onClose }: { onClose(): void }) {
  const { session } = useSession();
  const panelRef = useRef<HTMLElement>(null);
  const uploadTimerRef = useRef<number | null>(null);
  const [step, setStep] = useState<'capture' | 'details'>('capture');
  const [captured, setCaptured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [draft, setDraft] = useState<ToolDraft>(() => ({
    ...initialToolDraft,
    warehouseId: session?.homeWarehouseId ?? '',
  }));
  const controller = useAddToolController({ session, captured, draft, onClose });
  const catalog = useToolCatalog();
  useModalFocusTrap(Boolean(session), onClose, panelRef);

  useEffect(() => {
    return () => {
      if (uploadTimerRef.current !== null) window.clearInterval(uploadTimerRef.current);
    };
  }, []);

  const warehouses = useMemo(() => {
    const options = new Map<string, string>();
    if (session?.homeWarehouseId && session.homeWarehouse) options.set(session.homeWarehouseId, session.homeWarehouse);
    catalog.data?.forEach((item) => item.warehouses.forEach((warehouse) => options.set(warehouse.id, warehouse.name)));
    return [...options.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog.data, session?.homeWarehouse, session?.homeWarehouseId]);

  if (!session) return null;

  const update = (key: keyof ToolDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const capture = () => {
    setCaptured(true);
    setStep('details');
    setUploadProgress(5);
    setUploading(true);
    if (uploadTimerRef.current !== null) window.clearInterval(uploadTimerRef.current);
    uploadTimerRef.current = window.setInterval(() => {
      setUploadProgress((current) => {
        const next = Math.min(100, current + 8 + Math.round(Math.random() * 9));
        if (next >= 100) {
          if (uploadTimerRef.current !== null) window.clearInterval(uploadTimerRef.current);
          setUploading(false);
        }
        return next;
      });
    }, 600);
  };

  const retake = () => {
    if (uploadTimerRef.current !== null) window.clearInterval(uploadTimerRef.current);
    setCaptured(false);
    setUploading(false);
    setUploadProgress(0);
    setStep('capture');
  };

  return (
    <div
      className="worker-add-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section ref={panelRef} className="worker-add-panel" role="dialog" aria-modal="true" aria-label="Add a tool">
        <div className={`worker-add-track worker-add-track--${step}`}>
          <MockPhotoCapture onCapture={capture} onClose={onClose} active={step === 'capture'} />
          <ToolDetailsForm
            draft={draft}
            error={controller.error}
            busy={controller.busy}
            categories={controller.categories}
            warehouses={warehouses}
            uploading={uploading}
            uploadProgress={uploadProgress}
            active={step === 'details'}
            onUpdate={update}
            onRetake={retake}
            onClose={onClose}
            onSave={() => void controller.save()}
          />
        </div>
      </section>
    </div>
  );
}
