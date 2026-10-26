import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, requestKey, result } from './client';
import { collect, useReferences } from './data';
import { useCompany } from './session';
import { uploadPhoto } from './photos';
import { text } from './ui';

export function useRegisterToolState() {
  const c = useCompany();
  const refs = useReferences();
  const [created, setCreated] = useState('');
  const [step, setStep] = useState<'photo' | 'details'>('photo');
  const [preview, setPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const selectedPhoto = useRef<File | null>(null);
  const uploadedPhoto = useRef<string | null>(null);
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  // A preview URL is a browser resource and must be released when its file changes.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setPhotoError('Choose a JPEG, PNG, or WebP photo under 8 MB.');
      return;
    }
    setPhotoError('');
    selectedPhoto.current = file;
    uploadedPhoto.current = null;
    setPreview(URL.createObjectURL(file));
    setStep('details');
  };
  const skipPhoto = () => {
    selectedPhoto.current = null;
    uploadedPhoto.current = null;
    setPreview('');
    setPhotoError('');
    setStep('details');
  };
  const register = async (form: FormData) => {
    if (selectedPhoto.current && !uploadedPhoto.current) {
      const photo = new FormData();
      photo.set('photo', selectedPhoto.current);
      uploadedPhoto.current = await uploadPhoto(c.company_id, photo, 'registration');
    }
    const body = {
      tool_model_id: text(form, 'model'),
      warehouse_id: text(form, 'warehouse'),
      asset_tag: text(form, 'tag'),
      serial_number: text(form, 'serial') || null,
      photo_id: uploadedPhoto.current,
    };
    const fingerprint = JSON.stringify(body);
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, key: requestKey() };
    const tool = result(
      await api.POST('/api/companies/{company_id}/tools', {
        params: { path: c.path },
        body: { ...body, request_key: submission.current.key },
      }),
    );
    setCreated(tool.id);
  };
  const policy = useQuery({
    queryKey: [c.company_id, 'registration-policy'],
    queryFn: () =>
      api.GET('/api/companies/{company_id}/tool-registration-policy', { params: { path: c.path } }).then(result),
  });

  return { c, refs, created, policy, step, setStep, preview, photoError, choosePhoto, skipPhoto, register };
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
