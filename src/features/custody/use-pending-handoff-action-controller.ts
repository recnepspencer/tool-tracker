import { useState } from 'react';
import type { HolderRef } from '../../domain/custody';
import type { HandoffAction } from '../../domain/custody';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import type { CustodyPhotoEvidence } from '../../domain/evidence';
import { useCustodyMutations } from './use-custody-mutations';

interface PendingHandoffActionControllerInput {
  handoff: PendingHandoffView;
  profileId: string;
  note: string;
  photo: CustodyPhotoEvidence | null;
  photoBusy: boolean;
  queryBlocked: boolean;
}

export function usePendingHandoffActionController({
  handoff,
  profileId,
  note,
  photo,
  photoBusy,
  queryBlocked,
}: PendingHandoffActionControllerInput) {
  const mutations = useCustodyMutations();
  const [error, setError] = useState<string | null>(null);
  const mutationBusy =
    mutations.acceptTransfer.isPending ||
    mutations.declineTransfer.isPending ||
    mutations.cancelTransfer.isPending ||
    mutations.withdrawRequest.isPending ||
    mutations.updateTransfer.isPending;

  const act = async (action: HandoffAction): Promise<boolean> => {
    if (queryBlocked || mutationBusy || photoBusy) return false;
    setError(null);
    const evidence =
      note.trim() || photo ? { ...(note.trim() ? { note: note.trim() } : {}), ...(photo ? { photo } : {}) } : undefined;
    try {
      const input = { handoffId: handoff.id, toolUnitId: handoff.toolUnitId, actorId: profileId, evidence };
      if (action === 'accept') await mutations.acceptTransfer.mutateAsync(input);
      if (action === 'decline') await mutations.declineTransfer.mutateAsync(input);
      if (action === 'cancel') await mutations.cancelTransfer.mutateAsync(input);
      if (action === 'withdraw') await mutations.withdrawRequest.mutateAsync(input);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This handoff could not be updated.');
      return false;
    }
  };

  const saveEdit = async (to: HolderRef): Promise<boolean> => {
    if (queryBlocked || mutationBusy || photoBusy) return false;
    setError(null);
    const evidence =
      note.trim() || photo ? { ...(note.trim() ? { note: note.trim() } : {}), ...(photo ? { photo } : {}) } : undefined;
    try {
      await mutations.updateTransfer.mutateAsync({
        handoffId: handoff.id,
        toolUnitId: handoff.toolUnitId,
        actorId: profileId,
        to,
        evidence,
      });
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This transfer could not be updated.');
      return false;
    }
  };

  return { act, saveEdit, busy: mutationBusy, queryBlocked, error };
}
