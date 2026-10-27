import { Link } from 'react-router-dom';
import { api, errorMessage, type Model } from './client';
import { PhotoField } from './photos';
import { useStagedPhoto } from './photo-state';
import type { useToolDetailState } from './tools-state';
import { useTransferPicker } from './tools-state';
import { TransferPicker, type TransferTarget } from './transfer-picker';
import { Field, Form, Notice, Section, Select, text } from './ui';

type Props = { state: ReturnType<typeof useToolDetailState>; asset: Model<'AssetView'> };

export function ToolRequest({ state, asset: t }: Props) {
  const { c, path, key, renewKey, requests } = state;
  if (requests.isPending) return <Notice>Checking your requests…</Notice>;
  if (requests.error) return <Notice error>{errorMessage(requests.error)}</Notice>;
  const own = requests.data?.[0];
  if (own)
    return (
      <Section title="Your request">
        <Notice>
          {own.status === 'approved'
            ? 'Approved. Confirm receipt in the queue when you have the tool.'
            : 'Your request is waiting for review.'}
        </Notice>
        <Link to={`/app/operations?review=request:${own.id}`}>Review or withdraw request</Link>
      </Section>
    );
  if (!t.requestable || !c.can('tools.request'))
    return <Notice>This tool is not currently available to request.</Notice>;
  return (
    <Section title="Request this tool">
      <p className="muted">
        You are requesting {t.asset_tag} from {t.warehouse_name}. Custody changes when receipt is accepted.
      </p>
      <Form
        label="Request tool"
        onDone={renewKey}
        submit={(f) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/requests', {
            params: { path },
            body: { request_key: key, note: text(f, 'note') },
          })
        }
      >
        <Field label="Note (optional)" name="note" maxLength={2000} />
      </Form>
    </Section>
  );
}

export function ToolTransfer({ state, asset: t }: Props) {
  const { c, refs, path, key, renewKey } = state;
  const photo = useStagedPhoto(c.company_id, 'handoff', key);
  const picker = useTransferPicker();
  const targets: TransferTarget[] = [
    ...(refs.people.data ?? [])
      .filter(
        (person) =>
          t.serviceability === 'serviceable' &&
          person.id !== t.holder_membership_id &&
          person.capabilities.includes('tools.transfer'),
      )
      .map((person) => ({
        value: `person:${person.id}`,
        kind: 'person' as const,
        name: person.preferred_name,
        detail: person.title || 'Team member',
      })),
    ...(refs.warehouses.data ?? [])
      .filter((warehouse) => warehouse.id !== t.warehouse_id)
      .map((warehouse) => ({
        value: `warehouse:${warehouse.id}`,
        kind: 'warehouse' as const,
        name: warehouse.name,
        detail: warehouse.code,
      })),
  ];
  if (t.pending_handoff_id)
    return <Notice>This tool has a pending handoff. Review it in the queue before proposing another.</Notice>;
  return (
    <Section title="Transfer or return">
      <p className="muted">
        The current holder remains accountable until the recipient or warehouse manager accepts receipt.
      </p>
      {(refs.people.error || refs.warehouses.error) && (
        <Notice error>{errorMessage(refs.people.error || refs.warehouses.error)}</Notice>
      )}
      <Form
        label="Propose handoff"
        disabled={
          !targets.some((target) => target.value === picker.selected) || !!refs.people.error || !!refs.warehouses.error
        }
        onDone={() => {
          photo.clear();
          renewKey();
        }}
        submit={async (f) => {
          const [kind, id] = text(f, 'destination').split(':');
          await api.POST('/api/companies/{company_id}/tools/{asset_id}/handoffs', {
            params: { path },
            body: {
              request_key: key,
              expected_revision: t.revision,
              destination_membership_id: kind === 'person' ? id : null,
              destination_warehouse_id: kind === 'warehouse' ? id : null,
              note: text(f, 'note'),
              photo_id: await photo.upload(f),
            },
          });
        }}
      >
        <TransferPicker targets={targets} picker={picker} />
        <Field label="Handoff note" name="note" maxLength={2000} />
        <PhotoField />
      </Form>
    </Section>
  );
}

export function ToolReport({ state, asset: t }: Props) {
  const { c, path, action, setAction } = state;
  const photo = useStagedPhoto(c.company_id, 'incident', t.revision);
  return (
    <Section title="Report a problem">
      <Form
        label="Submit report"
        onDone={() => {
          photo.clear();
          setAction('');
        }}
        submit={async (f) =>
          api.POST('/api/companies/{company_id}/tools/{asset_id}/incidents', {
            params: { path },
            body: {
              expected_revision: t.revision,
              kind: text(f, 'kind') as 'damage' | 'missing',
              description: text(f, 'description'),
              photo_id: await photo.upload(f),
            },
          })
        }
      >
        <Select label="Problem" name="kind" defaultValue={action === 'missing' ? 'missing' : 'damage'}>
          <option value="damage">Damaged</option>
          <option value="missing">Missing</option>
        </Select>
        <Field label="What happened?" name="description" required maxLength={2000} />
        <PhotoField />
      </Form>
    </Section>
  );
}
