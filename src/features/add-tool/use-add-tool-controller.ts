import { useState } from 'react';
import type { AuthSession } from '../../domain/auth';
import { useCreateTool } from './use-create-tool';
import type { ToolDraft } from './add-tool-types';
import { useToolCategories } from '../settings/use-tool-categories';

interface AddToolControllerInput {
  session: AuthSession | null;
  captured: boolean;
  draft: ToolDraft;
  onClose(): void;
}

export function useAddToolController({ session, captured, draft, onClose }: AddToolControllerInput) {
  const createTool = useCreateTool();
  const categories = useToolCategories();
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!session) return;
    if (categories.isPending) {
      setError('Tool categories are still loading. Try again in a moment.');
      return;
    }
    if (categories.isError || !categories.data?.some((category) => category.id === draft.categoryId)) {
      setError('Choose a current category from the list.');
      return;
    }
    if (!captured || !draft.name.trim() || !draft.categoryId.trim() || !draft.warehouseId.trim()) {
      setError('Capture a photo, name the tool, choose a category, and confirm its warehouse.');
      return;
    }
    try {
      await createTool.mutateAsync({
        actorId: session.profileId,
        definition: {
          name: draft.name,
          brand: draft.brand || 'Unbranded',
          model: draft.model || 'Field record',
          categoryId: draft.categoryId,
          imageKey: 'tool-photo-placeholder.svg',
        },
        warehouseId: draft.warehouseId,
        photoCaptured: true,
        serial: draft.serial,
        price: draft.price,
        evidence: { ...(draft.note.trim() ? { note: draft.note.trim() } : {}), mockPhoto: true },
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The tool could not be added.');
    }
  };

  return { error, busy: createTool.isPending || categories.isPending, save, categories: categories.data ?? [] };
}
