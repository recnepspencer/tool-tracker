import { useState } from 'react';
import { api, type Model } from './client';
import { formatDate } from './format';
import { Button, OverlayDialog, Switch, TextField } from './kit';
import {
  LIFECYCLE_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  memberLifecycle,
  memberRoles,
  type AccessState,
  type RoleCode,
} from './people-roles';
import type { PeoplePageState } from './people-state';
import { useCompany } from './session';
import { CommandError, CommandForm } from './settings-command';
import { useCommand } from './settings-command-state';
import { Field, text } from './ui';

type Member = Model<'MemberView'>;

/** The demo's PersonDrawer: record summary, role editor, custody, access actions and removal. */
export function PersonDrawer({
  person,
  state,
  onClose,
}: {
  person: Member;
  state: Pick<PeoplePageState, 'c' | 'held' | 'jobs' | 'refreshSession'>;
  onClose(): void;
}) {
  const { c, held, jobs, refreshSession } = state;
  const lifecycle = memberLifecycle(person);
  const tools = held(person.id);
  const currentJobs = jobs(person.id);
  const pending = tools?.filter((asset) => asset.pending_handoff_id).length;
  return (
    <OverlayDialog
      label={'Person details for ' + person.preferred_name}
      onClose={onClose}
      panelClassName="admin-drawer admin-drawer--person"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Person record</span>
        <h2>{person.preferred_name}</h2>
        <p>{person.title || memberRoles(person)}</p>
      </div>
      <div className="person-detail-grid">
        <div>
          <span className="eyebrow">Access</span>
          <strong>{LIFECYCLE_LABELS[lifecycle]}</strong>
        </div>
        <div>
          <span className="eyebrow">Role</span>
          <strong>{memberRoles(person)}</strong>
        </div>
        <div>
          <span className="eyebrow">Held tools</span>
          <strong>{tools ? tools.length : '—'}</strong>
        </div>
        <div>
          <span className="eyebrow">Pending</span>
          <strong>{pending ?? '—'}</strong>
        </div>
      </div>
      {c.can('people.manage') && <PersonRoleEditor person={person} onSaved={refreshSession} />}
      {currentJobs && (
        <div className="admin-detail-list">
          <span className="eyebrow">Current jobs</span>
          {currentJobs.length ? (
            currentJobs.map((job) => (
              <div key={job.job_id}>
                <strong>{job.name}</strong>
                <span>{job.number}</span>
              </div>
            ))
          ) : (
            <span>No current jobs.</span>
          )}
        </div>
      )}
      {tools && (
        <div className="admin-detail-list">
          <span className="eyebrow">Custody held</span>
          {tools.map((tool) => (
            <div key={tool.id}>
              <strong>{tool.name}</strong>
              <span>
                {tool.asset_tag}
                {tool.custody_started_at ? ` · since ${formatDate(tool.custody_started_at)}` : ''}
              </span>
            </div>
          ))}
          {!tools.length && <span>No tools in this person’s custody.</span>}
        </div>
      )}
      {c.is_owner && !person.is_owner && lifecycle === 'active' && (
        <OwnershipTransfer person={person} onSaved={refreshSession} />
      )}
      {c.can('people.manage') &&
        (person.is_owner ? (
          <p className="admin-danger-zone">
            The owner’s access and administrator role can’t be changed. The owner can make someone else the owner first.
          </p>
        ) : (
          <>
            <PersonAccessActions person={person} onSaved={refreshSession} />
            <PersonRemovalForm person={person} onSaved={refreshSession} />
          </>
        ))}
    </OverlayDialog>
  );
}

function update(
  companyPath: { company_id: string },
  person: Member,
  change: { access_state?: AccessState; end_membership?: boolean; roles?: RoleCode[]; title?: string; reason: string },
) {
  return api.POST('/api/companies/{company_id}/people/{membership_id}/update', {
    params: { path: { ...companyPath, membership_id: person.id } },
    body: {
      expected_revision: person.revision,
      access_state: change.access_state ?? person.access_state,
      end_membership: change.end_membership ?? Boolean(person.ended_at),
      roles: change.roles ?? person.roles,
      title: change.title ?? person.title,
      reason: change.reason,
    },
  });
}

/** Live roles are multi-valued, so the demo's role SelectField becomes Switch rows. */
function PersonRoleEditor({ person, onSaved }: { person: Member; onSaved(): void }) {
  const c = useCompany();
  return (
    <CommandForm
      label="Save roles"
      onDone={(form) => {
        const reason = form.elements.namedItem('reason');
        if (reason instanceof HTMLInputElement) reason.value = '';
        onSaved();
      }}
      submit={(form) => {
        const roles = form.getAll('roles') as RoleCode[];
        if (!roles.length) return Promise.reject(new Error('Choose at least one role.'));
        return update(c.path, person, { roles, title: text(form, 'title'), reason: text(form, 'reason') });
      }}
    >
      <Field label="Job title" name="title" defaultValue={person.title} maxLength={120} />
      <div className="admin-form" role="group" aria-label="Roles">
        {ROLES.map((role) => (
          <Switch
            key={role}
            name="roles"
            value={role}
            defaultChecked={person.roles.includes(role)}
            label={ROLE_LABELS[role]}
            description={ROLE_DESCRIPTIONS[role]}
          />
        ))}
      </div>
      <Field label="Reason for change" name="reason" placeholder="Required to save" required maxLength={2000} />
    </CommandForm>
  );
}

function PersonAccessActions({ person, onSaved }: { person: Member; onSaved(): void }) {
  const c = useCompany();
  const command = useCommand();
  const [reason, setReason] = useState('');
  const lifecycle = memberLifecycle(person);
  const disabled = command.busy || !reason.trim();
  const change = (access_state: AccessState) =>
    void command.run(
      () => update(c.path, person, { access_state, end_membership: false, reason: reason.trim() }),
      () => {
        setReason('');
        onSaved();
      },
    );
  return (
    <div className="admin-danger-zone">
      <span className="eyebrow">Access actions</span>
      <TextField
        label="Access change reason"
        value={reason}
        onChange={setReason}
        placeholder="Required to change access"
        maxLength={2000}
      />
      <div className="dialog-actions">
        <Button variant="secondary" disabled={disabled || lifecycle === 'active'} onClick={() => change('active')}>
          Restore access
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || lifecycle === 'suspended' || lifecycle === 'former'}
          onClick={() => change('suspended')}
        >
          Suspend
        </Button>
        <Button
          variant="secondary"
          disabled={disabled || lifecycle === 'disabled' || lifecycle === 'former'}
          onClick={() => change('disabled')}
        >
          Disable
        </Button>
      </div>
      <CommandError error={command.error} />
    </div>
  );
}

/** Only the owner sees this. The new owner also becomes a company admin; the old owner keeps their roles. */
function OwnershipTransfer({ person, onSaved }: { person: Member; onSaved(): void }) {
  const c = useCompany();
  const command = useCommand();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="admin-danger-zone">
      <span className="eyebrow">Ownership</span>
      {confirming ? (
        <>
          <p>
            Make {person.preferred_name} the owner? You stay a company admin, but only they can change ownership after
            this.
          </p>
          <div className="dialog-actions">
            <Button variant="secondary" disabled={command.busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              disabled={command.busy}
              onClick={() =>
                void command.run(
                  () =>
                    api.POST('/api/companies/{company_id}/ownership', {
                      params: { path: c.path },
                      body: { membership_id: person.id },
                    }),
                  onSaved,
                )
              }
            >
              Make owner
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Make {person.preferred_name} the owner
        </Button>
      )}
      <CommandError error={command.error} />
    </div>
  );
}

/** The demo's PersonRemovalForm. Live removal ends employment and current job assignments. */
function PersonRemovalForm({ person, onSaved }: { person: Member; onSaved(): void }) {
  const c = useCompany();
  const command = useCommand();
  const [reason, setReason] = useState('');
  const former = Boolean(person.ended_at);
  return (
    <div className="admin-danger-zone">
      <TextField
        label="Removal reason"
        value={reason}
        onChange={setReason}
        placeholder={former ? 'Employment already ended' : 'Required to remove'}
        disabled={former}
        maxLength={2000}
      />
      <Button
        variant="danger"
        disabled={command.busy || former || !reason.trim()}
        onClick={() =>
          void command.run(
            () => update(c.path, person, { access_state: 'disabled', end_membership: true, reason: reason.trim() }),
            () => {
              setReason('');
              onSaved();
            },
          )
        }
      >
        End employment
      </Button>
      <CommandError error={command.error} />
    </div>
  );
}
