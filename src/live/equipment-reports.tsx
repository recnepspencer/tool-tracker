import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assetDetailsInput, AssetDetailsFields } from './asset-details';
import { api, requestKey, result, type Model } from './client';
import { collect, useReferences } from './data';
import { EquipmentTypePicker } from './equipment-type-picker';
import { useAssetCollection } from './field-state';
import { ErrorState, LoadingState, SelectField } from './kit';
import { useCompany } from './session';
import { CommandForm, SettingsCard } from './settings-command';
import { photoSrc } from './tool-status';
import { Field, TextArea, text } from './ui';

type Report = Model<'SubmissionView'>;
const statusLabels = {
  pending: 'Needs review',
  clarification: 'Needs clarification',
  registered: 'Registered',
  linked: 'Matched to existing equipment',
};

export function EquipmentReports({ managerOnly = false }: { managerOnly?: boolean }) {
  const c = useCompany();
  const manager = c.can('tools.manage');
  const [showSettled, setShowSettled] = useState(false);
  const query = useQuery({
    queryKey: [c.company_id, 'equipment-submissions'],
    enabled: !managerOnly || manager,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/equipment-submissions', {
            params: { path: c.path, query: { offset, limit: 100 } },
          })
          .then(result),
      ),
  });
  if (managerOnly && !manager) return null;
  if (query.isPending) return <LoadingState label="Loading reported equipment…" />;
  if (query.error)
    return <ErrorState message="Reported equipment could not be loaded." onRetry={() => void query.refetch()} />;
  const reports = (query.data ?? []).filter(
    (report) => !manager || showSettled || ['pending', 'clarification'].includes(report.status),
  );
  if (!manager && !reports.length) return null;
  return (
    <SettingsCard eyebrow={manager ? 'Equipment collection review' : 'Reported equipment'}>
      {manager && (
        <label>
          <input type="checkbox" checked={showSettled} onChange={(event) => setShowSettled(event.target.checked)} />{' '}
          Include reviewed submissions
        </label>
      )}
      {!reports.length && <p>No equipment is waiting for review.</p>}
      {reports.map((report) => (
        <article key={report.id} className="settings-card" aria-label={`Submission: ${report.description}`}>
          <h3>{report.description}</h3>
          <p>
            {statusLabels[report.status]} · {report.reporter_name}
          </p>
          <p>
            {report.in_my_possession ? `Reported in ${report.reporter_name}’s possession` : 'Reported location'}
            {report.location && ` · ${report.location}`}
          </p>
          {report.notes && <p>{report.notes}</p>}
          {report.photo_id && (
            <a
              className="text-link"
              href={photoSrc(c.company_id, report.photo_id, 'original') ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              View submitted photo
            </a>
          )}
          {report.discussion.map((message, index) => (
            <p key={index}>
              <strong>{message.author}:</strong> {message.text}
            </p>
          ))}
          {report.asset_id && (
            <Link className="text-link" to={`${manager ? '/app/tools' : '/app/mine'}/${report.asset_id}`}>
              View registered equipment
            </Link>
          )}
          {!manager && report.status === 'clarification' && (
            <CommandForm
              label="Send clarification"
              submit={(form) =>
                api.POST('/api/companies/{company_id}/equipment-submissions/{submission_id}/reply', {
                  params: { path: { ...c.path, submission_id: report.id } },
                  body: { expected_revision: report.revision, note: text(form, 'reply') },
                })
              }
            >
              <TextArea label="Your reply" name="reply" required maxLength={4000} />
            </CommandForm>
          )}
          {manager && ['pending', 'clarification'].includes(report.status) && (
            <details>
              <summary>Review submission</summary>
              <EquipmentReview report={report} />
            </details>
          )}
        </article>
      ))}
    </SettingsCard>
  );
}

function EquipmentReview({ report }: { report: Report }) {
  const c = useCompany();
  const { tools } = useAssetCollection();
  const refs = useReferences();
  const [decision, setDecision] = useState<'link' | 'register' | 'clarify'>('link');
  const [key] = useState(requestKey);
  return (
    <CommandForm
      key={decision}
      label={
        decision === 'clarify'
          ? 'Ask for clarification'
          : decision === 'link'
            ? 'Match existing equipment'
            : 'Register equipment'
      }
      submit={(form) =>
        api.POST('/api/companies/{company_id}/equipment-submissions/{submission_id}/review', {
          params: { path: { ...c.path, submission_id: report.id } },
          body: {
            expected_revision: report.revision,
            decision,
            note: text(form, 'review_note'),
            asset_id: text(form, 'asset') || null,
            registration:
              decision === 'register'
                ? {
                    request_key: key,
                    tool_model_id: text(form, 'model'),
                    warehouse_id: text(form, 'warehouse'),
                    asset_tag: text(form, 'tag'),
                    ...assetDetailsInput(form),
                    photo_id: null,
                  }
                : null,
          },
        })
      }
    >
      <SelectField
        label="Review decision"
        value={decision}
        onChange={(value) => setDecision(value as typeof decision)}
        options={[
          { value: 'link', label: 'Match an existing registered item' },
          { value: 'register', label: 'Register new equipment' },
          { value: 'clarify', label: 'Ask the reporter a question' },
        ]}
      />
      {decision === 'link' && (
        <>
          <p>Match the same physical item. This records the report without changing its existing custody.</p>
          <SelectField
            label="Existing equipment"
            name="asset"
            required
            options={(tools.data ?? []).map((asset) => ({
              value: asset.id,
              label: `${asset.asset_tag} · ${asset.name}`,
              description: asset.holder_name ?? asset.warehouse_name ?? '',
            }))}
          />
          {tools.isPending && <LoadingState label="Loading registered equipment…" />}
          {tools.error && (
            <ErrorState message="Registered equipment could not be loaded." onRetry={() => void tools.refetch()} />
          )}
        </>
      )}
      {decision === 'register' && (
        <>
          <p>
            {report.in_my_possession
              ? `Registration will record ${report.reporter_name} as the current holder.`
              : 'Choose the warehouse where this item is held.'}
          </p>
          <EquipmentTypePicker defaultValue={report.suggested_type_id ?? ''} />
          <SelectField
            label="Home warehouse"
            name="warehouse"
            required
            options={(refs.warehouses.data ?? [])
              .filter((item) => !item.archived_at)
              .map((item) => ({ value: item.id, label: item.name }))}
          />
          <Field label="Asset tag" name="tag" required maxLength={64} />
          <AssetDetailsFields />
        </>
      )}
      <TextArea
        label={decision === 'clarify' ? 'Question for the reporter' : 'Review note'}
        name="review_note"
        required={decision === 'clarify'}
        maxLength={4000}
      />
    </CommandForm>
  );
}
