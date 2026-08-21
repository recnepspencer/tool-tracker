import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/query-keys';
import { useApi } from '../../../api/api-context';
import { useToolDecisionMutations } from '../use-tool-decisions';

export function SharedDefinitionProbe() {
  const api = useApi();
  const first = useQuery({
    queryKey: queryKeys.toolDetail('TL-101'),
    queryFn: () => api.tools.getToolDetail('TL-101'),
  });
  const sibling = useQuery({
    queryKey: queryKeys.toolDetail('TL-102'),
    queryFn: () => api.tools.getToolDetail('TL-102'),
  });
  const targets = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
  });
  return (
    <output data-testid="shared-definition-probe">
      <span data-testid="shared-definition-first">{first.data?.tool.name ?? ''}</span>
      <span data-testid="shared-definition-sibling">{sibling.data?.tool.name ?? ''}</span>
      <span data-testid="shared-definition-targets">{targets.data?.length ?? ''}</span>
    </output>
  );
}

export function SharedDefinitionHarness() {
  const api = useApi();
  const queryClient = useQueryClient();
  const mutation = useToolDecisionMutations();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-101'),
        queryFn: () => api.tools.getToolDetail('TL-101'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-102'),
        queryFn: () => api.tools.getToolDetail('TL-102'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
        queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
      }),
    ]).then(() => setReady(true));
  }, [api, queryClient]);
  if (!ready) return null;
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void mutation.updateTool.mutateAsync({
            toolUnitId: 'TL-101',
            expectedRevision: 1,
            expectedStatus: 'checked-out',
            expectedHolder: { type: 'worker', userId: 'ray-torres' },
            definition: {
              name: 'Hammer drill — revised',
              brand: 'DeWalt',
              model: 'DCD996',
              categoryId: 'category-hand-tools',
              imageKey: 'hammer-drill.png',
            },
          })
        }
      >
        Rename shared definition
      </button>
      <SharedDefinitionProbe />
    </>
  );
}
