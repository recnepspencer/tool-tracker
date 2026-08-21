import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import type {
  HandoffReviewInput,
  ReportConditionInput,
  RequestToolInput,
  StartTransferInput,
} from '../../api/contracts/custody-api';
import { invalidateCustodyProjections } from './query-invalidation';

export function useCustodyMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const onSuccess = (result: { toolUnitId: string }) => invalidateCustodyProjections(queryClient, result.toolUnitId);
  return {
    requestTool: useMutation({ mutationFn: (input: RequestToolInput) => api.custody.requestTool(input), onSuccess }),
    startTransfer: useMutation({
      mutationFn: (input: StartTransferInput) => api.custody.startTransfer(input),
      onSuccess,
    }),
    acceptTransfer: useMutation({
      mutationFn: (input: HandoffReviewInput) => api.custody.acceptTransfer(input),
      onSuccess,
    }),
    declineTransfer: useMutation({
      mutationFn: (input: HandoffReviewInput) => api.custody.declineTransfer(input),
      onSuccess,
    }),
    cancelTransfer: useMutation({
      mutationFn: (input: HandoffReviewInput) => api.custody.cancelTransfer(input),
      onSuccess,
    }),
    withdrawRequest: useMutation({
      mutationFn: (input: HandoffReviewInput) => api.custody.withdrawRequest(input),
      onSuccess,
    }),
    reportToolCondition: useMutation({
      mutationFn: (input: ReportConditionInput) => api.custody.reportToolCondition(input),
      onSuccess,
    }),
  };
}
