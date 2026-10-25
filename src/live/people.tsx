import { usePeoplePageState } from './people-state';

import { api, errorMessage, result, type Model } from './client';
import { useCompany } from './session';

import { Badge, date, Empty, Field, Form, human, Loading, Notice, Section, Select, text } from './ui';

const roles = ['field_member', 'equipment_manager', 'dispatcher', 'estimator', 'company_admin'] as const;
export function PeoplePage() {
  const { c, link, setLink, inactive, setInactive, people, invites } = usePeoplePageState();
  return (
    <>
      <h1>People</h1>
      <p className="muted">Manage team access and invitations.</p>
      {c.can('people.manage') && (
        <Section title="Invite a teammate">
          <Form
            label="Send invitation"
            submit={async (f) => {
              const created = result(
                await api.POST('/api/companies/{company_id}/invitations', {
                  params: { path: c.path },
                  body: {
                    email: text(f, 'email'),
                    preferred_name: text(f, 'name'),
                    role: text(f, 'role') as (typeof roles)[number],
                  },
                }),
              );
              setLink(`${window.location.origin}/invite/${created.token}`);
            }}
          >
            <Field label="Name" name="name" required maxLength={120} />
            <Field label="Email address" name="email" type="email" required />
            <Select label="Role" name="role">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {human(r)}
                </option>
              ))}
            </Select>
          </Form>
          {link && (
            <Notice>
              Invitation sent. You can also share this link: <a href={link}>{link}</a>
            </Notice>
          )}
        </Section>
      )}
      {c.can('people.manage') && (
        <label className="check">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Include suspended
          and former employees
        </label>
      )}
      {people.isPending && <Loading />}
      {people.error && <Notice error>{errorMessage(people.error)}</Notice>}
      {people.data?.map((person) => (
        <Person key={person.id} person={person} />
      ))}
      {c.can('people.manage') && (
        <Section title="Invitations">
          {invites.error && <Notice error>{errorMessage(invites.error)}</Notice>}
          {invites.data?.map((i) => (
            <article className="row" key={i.id}>
              <div>
                <strong>{i.preferred_name}</strong>
                <p>
                  {i.email} · {human(i.role_code)}
                </p>
                <small>{i.accepted_at ? 'Accepted' : i.revoked_at ? 'Revoked' : `Expires ${date(i.expires_at)}`}</small>
              </div>
              {!i.accepted_at && !i.revoked_at && (
                <Form
                  label="Revoke invitation"
                  submit={() =>
                    api.POST('/api/companies/{company_id}/invitations/{invitation_id}/revoke', {
                      params: { path: { ...c.path, invitation_id: i.id } },
                    })
                  }
                >
                  <></>
                </Form>
              )}
            </article>
          ))}
          {invites.data?.length === 0 && <Empty>No invitations yet.</Empty>}
        </Section>
      )}
    </>
  );
}
function Person({ person: p }: { person: Model<'MemberView'> }) {
  const c = useCompany();
  return (
    <article className="panel">
      <div className="row">
        <div>
          <h2>{p.preferred_name}</h2>
          <p>{p.title || p.roles.map(human).join(', ')}</p>
        </div>
        <Badge>{p.ended_at ? 'Former employee' : human(p.access_state)}</Badge>
      </div>
      {c.can('people.manage') && (
        <details>
          <summary>Manage access</summary>
          <Form
            label="Save member access"
            submit={(f) =>
              api.POST('/api/companies/{company_id}/people/{membership_id}/update', {
                params: { path: { ...c.path, membership_id: p.id } },
                body: {
                  expected_revision: p.revision,
                  title: text(f, 'title'),
                  access_state: text(f, 'access') as 'active' | 'suspended' | 'disabled',
                  roles: f.getAll('roles') as (typeof roles)[number][],
                  end_membership: f.get('end') === 'on',
                  reason: text(f, 'reason'),
                },
              })
            }
          >
            <Field name="title" label="Job title" defaultValue={p.title} maxLength={120} />
            <Select label="Access" name="access" defaultValue={p.access_state}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="disabled">Disabled</option>
            </Select>
            <div className="field">
              <span>Roles (choose at least one)</span>
              {roles.map((role) => (
                <label className="check" key={role}>
                  <input type="checkbox" name="roles" value={role} defaultChecked={p.roles.includes(role)} />
                  {human(role)}
                </label>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" name="end" defaultChecked={!!p.ended_at} /> End employment and current job
              assignments
            </label>
            <Field label="Reason for change" name="reason" required maxLength={2000} />
          </Form>
        </details>
      )}
    </article>
  );
}
