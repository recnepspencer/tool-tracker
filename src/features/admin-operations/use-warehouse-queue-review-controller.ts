import { useEffect, useState } from 'react';
import type { WarehouseQueueItemView } from '../../domain/read-models/warehouse-operations';
import { useWarehouseQueueMutations } from './use-warehouse-queue';

type QueueDecision = 'approve' | 'decline';

export function useWarehouseQueueReviewController({
  items,
  queryBlocked,
}: {
  items?: readonly WarehouseQueueItemView[];
  queryBlocked: boolean;
}) {
  const [review, setReview] = useState<WarehouseQueueItemView | null>(null);
  const [note, setNote] = useState('');
  const mutations = useWarehouseQueueMutations();

  useEffect(() => {
    if (!review) return;
    const current = items?.find((item) => item.id === review.id);
    if (!current || current.kind !== review.kind || current.toolUnitId !== review.toolUnitId) {
      setReview(null);
      setNote('');
    }
  }, [items, review]);

  const closeReview = () => {
    setReview(null);
    setNote('');
  };

  const resolve = async (decision: QueueDecision) => {
    if (!review) return;
    const mutation =
      decision === 'decline'
        ? mutations.declineQueueItem
        : review.kind === 'request'
          ? mutations.approveRequest
          : mutations.acceptReturn;
    mutation.reset();
    const input = {
      handoffId: review.id,
      toolUnitId: review.toolUnitId,
      ...(note.trim() ? { evidence: { note } } : {}),
    };
    try {
      await mutation.mutateAsync(input);
      closeReview();
    } catch {
      // Keep the review and evidence note mounted so this operation can be retried.
    }
  };

  const errorFor = (mutation: { isError: boolean; error: unknown }) =>
    mutation.isError && mutation.error instanceof Error ? mutation.error.message : undefined;
  const decisionError =
    review?.kind === 'request'
      ? (errorFor(mutations.approveRequest) ?? errorFor(mutations.declineQueueItem))
      : (errorFor(mutations.acceptReturn) ?? errorFor(mutations.declineQueueItem));
  return {
    review,
    note,
    setReview,
    setNote,
    closeReview,
    resolve,
    decisionError,
    busy:
      queryBlocked ||
      mutations.approveRequest.isPending ||
      mutations.acceptReturn.isPending ||
      mutations.declineQueueItem.isPending,
  };
}
