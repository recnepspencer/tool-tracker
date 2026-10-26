import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, result } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';

export function usePeoplePageState() {
  const c = useCompany();
  const cache = useQueryClient();
  const location = useListLocation();
  const selectedId = location.params.get('person');
  const inviting = location.params.get('invite') === 'true';
  const [link, setLink] = useState('');
  const inactiveLocation = useListLocation();
  const inactive = inactiveLocation.params.get('inactive') === 'true';
  const setInactive = (value: boolean) => inactiveLocation.update('inactive', value ? 'true' : '');
  const people = useQuery({
    queryKey: [c.company_id, 'people', inactive],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/people', {
            params: { path: c.path, query: { offset, include_inactive: inactive } },
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

  return {
    c,
    link,
    setLink,
    inactive,
    setInactive,
    people,
    invites,
    selectedId,
    inviting,
    select: (id: string) => location.update('person', id),
    invite: (open: boolean) => {
      if (open) setLink('');
      location.update('invite', open ? 'true' : '');
    },
    saved: () => {
      location.update('person', '');
      void cache.invalidateQueries({ queryKey: ['session'] });
    },
  };
}
