import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, result, type Model } from './client';
import { collect, useReferences } from './data';
import { formatDate } from './format';
import { useListLocation } from './list-location';
import { useAssetLookup } from './operations-state';
import { useStagedPhoto } from './photo-state';
import { useCompany } from './session';
import { text } from './ui';

type Case = Model<'ReconciliationView'>;
export type CaseKind = Case['kind'];
export type CaseOutcome = NonNullable<Case['outcome']>;
export type CaseRecord = Model<'ReconciliationRecordView'>;
export type CaseFilter = 'all' | CaseKind;

export const caseKindLabels: Record<CaseKind, string> = {
  custody_dispute: 'Custody dispute',
  missing_asset: 'Missing tool',
  duplicate_asset: 'Possible duplicate',
};

/** What a person picks when opening a case from a tool, in plain words. */
export const caseKindOptions: { value: CaseKind; label: string; description: string }[] = [
  { value: 'custody_dispute', label: 'Someone else has it', description: 'The records name the wrong holder' },
  { value: 'missing_asset', label: 'It’s missing', description: 'Nobody can find it' },
  { value: 'duplicate_asset', label: 'It’s registered twice', description: 'Two records for one physical tool' },
];

export interface OutcomeOption {
  value: CaseOutcome;
  label: string;
  description: string;
  submit: string;
}

/** The ways each kind of case can be settled. The first is the default. */
export const outcomeOptions: Record<CaseKind, OutcomeOption[]> = {
  duplicate_asset: [
    {
      value: 'merge',
      label: 'Merge',
      description: 'Same tool. Keep one record and retire the other.',
      submit: 'Merge records',
    },
    {
      value: 'not_duplicate',
      label: 'Not a duplicate',
      description: 'Two different tools. Close the case and change nothing.',
      submit: 'Close case',
    },
  ],
  missing_asset: [
    { value: 'found', label: 'Found', description: 'Say who or where has it now.', submit: 'Mark found' },
    {
      value: 'write_off',
      label: 'Write off',
      description: 'It’s gone for good. The tool is disposed of and leaves inventory.',
      submit: 'Write off tool',
    },
  ],
  custody_dispute: [
    {
      value: 'move_custody',
      label: 'Someone else has it',
      description: 'Move the tool to whoever really has it.',
      submit: 'Move custody',
    },
    {
      value: 'records_correct',
      label: 'Records are right',
      description: 'Close the case and change nothing.',
      submit: 'Close case',
    },
  ],
};

/** Outcomes this case can actually take. A duplicate opened before cases named the other record can't merge. */
export const availableOutcomes = (item: Case) =>
  outcomeOptions[item.kind].filter((option) => option.value !== 'merge' || item.duplicate_record);

/** "Serial 12-345 · registered Oct 22, 2026" */
export const recordIdentity = (record: CaseRecord) =>
  [
    record.serial_number ? `Serial ${record.serial_number}` : 'No serial',
    `registered ${formatDate(record.registered_at)}`,
  ].join(' · ');

/** One plain sentence on what doesn't match. */
export function caseProblem(item: Case) {
  const holder = item.record.holder_name;
  if (item.kind === 'custody_dispute')
    return holder ? `Records say ${holder} has it, but that’s in doubt.` : 'Records don’t say who has it.';
  if (item.kind === 'missing_asset')
    return holder ? `Nobody can find it. Records say ${holder} has it.` : 'Nobody can find it.';
  const other = item.duplicate_record;
  return other
    ? `May be the same tool as another record (${recordIdentity(other)}).`
    : 'May be registered twice. The other record wasn’t named.';
}

/** The record registered first: the one a merge keeps unless the person picks the other. */
export const earlierRecord = (a: CaseRecord, b: CaseRecord) =>
  new Date(b.registered_at).getTime() < new Date(a.registered_at).getTime() ? b : a;

/**
 * Settling one case: the chosen outcome, the record a merge keeps (the earlier one by default), where a
 * found or disputed tool really is, and the request body carrying only what that outcome needs.
 */
export function useCaseResolution(
  item: Case,
  asset: Model<'AssetView'> | undefined,
  people: Model<'MemberView'>[],
  warehouses: Model<'WarehouseView'>[],
) {
  const c = useCompany();
  const photo = useStagedPhoto(c.company_id, 'reconciliation', item.revision);
  const options = availableOutcomes(item);
  const [outcome, setOutcome] = useState<CaseOutcome>(options[0]!.value);
  const chosen = options.find((option) => option.value === outcome) ?? options[0]!;
  const other = item.duplicate_record;
  const [keep, setKeep] = useState(other ? earlierRecord(item.record, other).id : item.record.id);
  const [destination, setDestination] = useState('');
  const moves = outcome === 'found' || outcome === 'move_custody';
  const holds = (kind: 'person' | 'warehouse', id: string) =>
    kind === 'person' ? asset?.holder_membership_id === id : !asset?.holder_membership_id && asset?.warehouse_id === id;
  const destinations = [
    ...people
      .filter((person) => person.access_state === 'active' && !person.ended_at)
      .map((person) => ({
        value: `person:${person.id}`,
        label: person.preferred_name,
        description: holds('person', person.id) ? 'Person · records say they have it' : 'Person',
      })),
    ...warehouses
      .filter((warehouse) => !warehouse.archived_at)
      .map((warehouse) => ({
        value: `warehouse:${warehouse.id}`,
        label: warehouse.name,
        description: holds('warehouse', warehouse.id) ? 'Warehouse · records say it’s here' : 'Warehouse',
      })),
  ];
  // The command form keeps the submit from when editing began, so the choices are read from the form.
  async function resolve(form: FormData) {
    const outcome = text(form, 'outcome') as CaseOutcome;
    const keep = text(form, 'keep_asset_id');
    const destination = text(form, 'destination');
    const moves = outcome === 'found' || outcome === 'move_custody';
    const base = {
      expected_revision: item.revision,
      outcome,
      note: text(form, 'note'),
      photo_id: await photo.upload(form),
    };
    const [kind, id] = destination.split(':');
    const body =
      outcome === 'merge' && other
        ? {
            ...base,
            keep_asset_id: keep,
            expected_asset_revision: item.record.revision,
            expected_duplicate_revision: other.revision,
          }
        : moves
          ? {
              ...base,
              expected_asset_revision: item.record.revision,
              destination_membership_id: kind === 'person' ? id : null,
              destination_warehouse_id: kind === 'warehouse' ? id : null,
            }
          : outcome === 'write_off'
            ? { ...base, expected_asset_revision: item.record.revision }
            : base;
    await api.POST('/api/companies/{company_id}/reconciliations/{case_id}/resolve', {
      params: { path: { ...c.path, case_id: item.id } },
      body,
    });
  }
  return {
    options,
    outcome,
    setOutcome,
    chosen,
    other,
    keep,
    setKeep,
    destination,
    setDestination,
    moves,
    destinations,
    photo,
    resolve,
  };
}

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
      ({ item }) =>
        (kind === 'all' || item.kind === kind) &&
        (!query ||
          [
            item.record.name,
            item.record.serial_number ?? '',
            item.duplicate_record?.serial_number ?? '',
            caseKindLabels[item.kind],
            item.narrative,
          ]
            .join(' ')
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
