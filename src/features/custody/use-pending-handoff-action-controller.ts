import { useState } from 'react';
import type { HandoffAction } from '../../domain/custody';
import type { PendingHandoffView } from '../../domain/read-models/custody';
import { useCustodyMutations } from './use-custody-mutations';

interface PendingHandoffActionControllerInput {
  handoff: PendingHandoffView;
  profileId: string;
  note: string;
  mockPhoto: boolean;
  queryBlocked: boolean;
}

export function usePendingHandoffActionController({
  handoff,
  profileId,
  note,
  mockPhoto,
  queryBlocked,
}: PendingHandoffActionControllerInput) {
  const mutations = useCustodyMutations();
  const [error, setError] = useState<string | null>(null);
  const mutationBusy =
    mutations.acceptTransfer.isPending ||
    mutations.declineTransfer.isPending ||
    mutations.cancelTransfer.isPending ||
    mutations.withdrawRequest.isPending;

  const act = async (action: HandoffAction) => {
    setError(null);
    const evidence =
      note.trim() || mockPhoto
        ? { ...(note.trim() ? { note: note.trim() } : {}), ...(mockPhoto ? { mockPhoto: true } : {}) }
        : undefined;
    try {
      const input = { handoffId: handoff.id, toolUnitId: handoff.toolUnitId, actorId: profileId, evidence };
      if (action === 'accept') await mutations.acceptTransfer.mutateAsync(input);
      if (action === 'decline') await mutations.declineTransfer.mutateAsync(input);
      if (action === 'cancel') await mutations.cancelTransfer.mutateAsync(input);
      if (action === 'withdraw') await mutations.withdrawRequest.mutateAsync(input);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This handoff could not be updated.');
    }
  };

  return { act, busy: mutationBusy, queryBlocked, error };
}
