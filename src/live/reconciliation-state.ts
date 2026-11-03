import { useQuery } from '@tanstack/react-query';
import { api, result, type Model } from './client';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
import { useAssetLookup } from './operations-state';
import { useCompany } from './session';

export type CaseFilter = 'all' | Model<'ReconciliationView'>['kind'];

export const caseKindLabels: Record<Model<'ReconciliationView'>['kind'], string> = {
  custody_dispute: 'Custody dispute',
  missing_asset: 'Missing tool',
  duplicate_asset: 'Duplicate record',
};

export function useReconciliationsPage() {
  const c = useCompany();
  const refs = useReferences();
  const location = useListLocation();
  const search = location.params.get('search') ?? '';
  const rawKind = location.params.get('kind') ?? 'all';
  const kind: CaseFilter = rawKind in caseKindLabels ? (rawKind as CaseFilter) : 'all';
  const resolving = location.params.get('resolve') ?? '';
  const cases = useQuery({
    queryKey: [c.company_id, 'cases'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/reconciliations', {
            params: { path: c.path, query: { offset, open_only: true } },
          })
          .then(result),
      ),
  });
  const asset = useAssetLookup((cases.data ?? []).map((item) => item.asset_id));
  const query = search.trim().toLocaleLowerCase();
  const rows = (cases.data ?? [])
    .map((item) => ({ item, asset: asset(item.asset_id) }))
    .filter(
      ({ item, asset }) =>
        (kind === 'all' || item.kind === kind) &&
        (!query ||
          `${asset?.name ?? ''} ${asset?.asset_tag ?? ''} ${caseKindLabels[item.kind]} ${item.narrative}`
            .toLocaleLowerCase()
            .includes(query)),
    );
  const open = rows.find(({ item }) => item.id === resolving);
  return {
    c,
    refs,
    cases,
    rows,
    search,
    kind,
    open,
    setSearch: (value: string) => location.update('search', value),
    setKind: (value: CaseFilter) => location.update('kind', value === 'all' ? '' : value),
    openResolve: (id: string) => location.update('resolve', id),
  };
}
