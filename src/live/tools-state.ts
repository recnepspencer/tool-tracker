import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, requestKey, result } from './client';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';

export function useToolsPageState() {
  const c = useCompany();
  const refs = useReferences();
  const searchLocation = useListLocation();
  const search = searchLocation.params.get('search') ?? '';
  const setSearch = (value: string) => searchLocation.update('search', value);
  const mineLocation = useListLocation();
  const mine = mineLocation.params.get('mine') === 'true';
  const setMine = (value: boolean) => mineLocation.update('mine', value ? 'true' : '');
  const { offset, setOffset } = useListLocation();
  const tools = useQuery({
    queryKey: [c.company_id, 'tools', search, mine, offset],
    queryFn: () =>
      api
        .GET('/api/companies/{company_id}/tools', {
          params: {
            path: c.path,
            query: { search, offset, limit: 24, ...(mine ? { holder_membership_id: c.membership_id } : {}) },
          },
        })
        .then(result),
  });

  return { c, refs, search, setSearch, mine, setMine, offset, setOffset, tools };
}
export function useRegisterToolState() {
  const c = useCompany();
  const refs = useReferences();
  const [key] = useState(requestKey);
  const [created, setCreated] = useState('');
  const policy = useQuery({
    queryKey: [c.company_id, 'registration-policy'],
    queryFn: () =>
      api.GET('/api/companies/{company_id}/tool-registration-policy', { params: { path: c.path } }).then(result),
  });

  return { c, refs, key, created, setCreated, policy };
}
export function useToolDetailState() {
  const c = useCompany();
  const refs = useReferences();
  const { assetId = '' } = useParams();
  const path = { ...c.path, asset_id: assetId };
  const [key, setKey] = useState(requestKey);
  const tool = useQuery({
    queryKey: [c.company_id, 'tool', assetId],
    queryFn: () => api.GET('/api/companies/{company_id}/tools/{asset_id}', { params: { path } }).then(result),
  });
  const history = useQuery({
    queryKey: [c.company_id, 'custody', assetId],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}/custody', {
            params: { path, query: { offset, limit: 100 } },
          })
          .then(result),
      ),
  });
  const incidents = useQuery({
    queryKey: [c.company_id, 'incidents', assetId],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/incidents', {
            params: { path: c.path, query: { asset_id: assetId, offset } },
          })
          .then(result),
      ),
  });
  const service = useQuery({
    queryKey: [c.company_id, 'service', assetId],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/tools/{asset_id}/service', { params: { path, query: { offset } } })
          .then(result),
      ),
  });

  return { c, refs, path, key, renewKey: () => setKey(requestKey()), tool, history, incidents, service };
}
