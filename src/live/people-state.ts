import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, result, type Model } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { ROLE_LABELS, memberLifecycle } from './people-roles';
import { useCompany } from './session';
import { useCommand } from './settings-command-state';

export type PeopleFilter = 'everyone' | 'invited' | 'admins' | 'no-access';
const filters: readonly PeopleFilter[] = ['everyone', 'invited', 'admins', 'no-access'];

export type InvitationState = 'invited' | 'expired' | 'revoked' | 'accepted';
export const invitationState = (invite: Model<'InvitationView'>, now = Date.now()): InvitationState =>
  invite.accepted_at
    ? 'accepted'
    : invite.revoked_at
      ? 'revoked'
      : new Date(invite.expires_at).getTime() <= now
        ? 'expired'
        : 'invited';

export type PeopleRow =
  | { kind: 'member'; id: string; member: Model<'MemberView'> }
  | { kind: 'invite'; id: string; invite: Model<'InvitationView'>; state: InvitationState };

export function usePeoplePageState() {
  const c = useCompany();
  const cache = useQueryClient();
  const location = useListLocation();
  const selectedId = location.params.get('person') ?? '';
  const inviting = location.params.get('invite') === 'true';
  const search = location.params.get('search') ?? '';
  const rawFilter = location.params.get('filter') as PeopleFilter | null;
  const filter: PeopleFilter = rawFilter && filters.includes(rawFilter) ? rawFilter : 'everyone';
  const [revokingId, setRevokingId] = useState('');
  const revoke = useCommand();

  const people = useQuery({
    queryKey: [c.company_id, 'people', true],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/people', {
            params: { path: c.path, query: { offset, include_inactive: true } },
          })
          .then(result),
      ),
  });
  const invites = useQuery({
    queryKey: [c.company_id, 'invitations'],
    enabled: c.can('people.manage'),
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/invitations', { params: { path: c.path, query: { offset } } })
          .then(result),
      ),
  });
  // The inventory's asset collection: custody counts for every holder, including former employees.
  const assets = useQuery({
    queryKey: [c.company_id, 'asset-collection', false],
    enabled: c.can('tools.read'),
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools', { params: { path: c.path, query: { offset, limit: 100 } } })
          .then(result),
      ),
  });
  // Current jobs for active members (the directory lists active members only).
  const directory = useQuery({
    queryKey: [c.company_id, 'directory', '', ''],
    enabled: c.can('jobs.read') && c.can('tools.read'),
    queryFn: () =>
      collect((offset) =>
        api.GET('/api/companies/{company_id}/directory', { params: { path: c.path, query: { offset } } }).then(result),
      ),
  });

  const held = (membershipId: string) =>
    assets.data?.filter((asset) => asset.holder_membership_id === membershipId && asset.lifecycle === 'active');
  const custody = (membershipId: string) => {
    const tools = held(membershipId);
    if (!tools) return null;
    const pending = tools.filter((asset) => asset.pending_handoff_id).length;
    return tools.length || pending ? `${tools.length} held · ${pending} pending` : 'None';
  };

  const term = search.trim().toLocaleLowerCase();
  const matches = (...values: string[]) => !term || values.some((value) => value.toLocaleLowerCase().includes(term));
  const memberRows: PeopleRow[] = (people.data ?? [])
    .filter((member) => matches(member.preferred_name, member.title, ROLE_LABELS[member.role]))
    .filter((member) => {
      if (filter === 'invited') return false;
      if (filter === 'admins') return member.role !== 'foreman';
      if (filter === 'no-access') return memberLifecycle(member) !== 'active';
      return true;
    })
    .map((member) => ({ kind: 'member', id: member.id, member }));
  const inviteRows: PeopleRow[] = (invites.data ?? [])
    .map((invite) => ({ kind: 'invite' as const, id: invite.id, invite, state: invitationState(invite) }))
    .filter((row) => matches(row.invite.preferred_name, row.invite.email, ROLE_LABELS[row.invite.role_code]))
    .filter((row) => (filter === 'invited' ? true : filter === 'everyone' ? row.state === 'invited' : false));

  const selected = people.data?.find((person) => person.id === selectedId);
  const revoking = invites.data?.find((invite) => invite.id === revokingId);

  return {
    c,
    people,
    invites,
    assets,
    directory,
    rows: [...memberRows, ...inviteRows],
    search,
    setSearch: (value: string) => location.update('search', value),
    filter,
    setFilter: (value: PeopleFilter) => location.update('filter', value === 'everyone' ? '' : value),
    selectedId,
    selected,
    held,
    custody,
    jobs: (membershipId: string) => directory.data?.find((person) => person.membership_id === membershipId)?.jobs,
    inviting,
    select: (id: string) => location.update('person', id),
    personHref: (id: string) => {
      const next = new URLSearchParams(location.params);
      next.set('person', id);
      next.delete('offset');
      return `?${next}`;
    },
    invite: (open: boolean) => location.update('invite', open ? 'true' : ''),
    revoking,
    revoke,
    startRevoke: (id: string) => {
      revoke.reset();
      setRevokingId(id);
    },
    confirmRevoke: (invite: Model<'InvitationView'>) =>
      void revoke.run(
        () =>
          api.POST('/api/companies/{company_id}/invitations/{invitation_id}/revoke', {
            params: { path: { ...c.path, invitation_id: invite.id } },
          }),
        () => setRevokingId(''),
      ),
    cancelRevoke: () => setRevokingId(''),
    refreshSession: () => void cache.invalidateQueries({ queryKey: ['session'] }),
  };
}
export type PeoplePageState = ReturnType<typeof usePeoplePageState>;
