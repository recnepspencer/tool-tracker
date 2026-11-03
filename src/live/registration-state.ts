import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage, requestKey, result } from './client';
import { assetDetailsInput } from './asset-details';
import { useCategoryOptions } from './catalog-state';
import { useCommandForm } from './command-state';
import { useReferences } from './data';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';
import { useCompany } from './session';
import { useSheetNavigation } from './sheet-navigation';
import { uploadPhoto } from './photos';
import { text } from './ui';
import { useRegistrationPolicy } from './registration-policy';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useRegisterToolState() {
  const c = useCompany();
  const { policy, canRegister } = useRegistrationPolicy();
  const refs = useReferences();
  const categories = useCategoryOptions({ enabled: canRegister });
  const navigate = useNavigate();
  const { root, close } = useSheetNavigation();
  const panelRef = useRef<HTMLElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  useModalFocusTrap(true, close, panelRef);
  const [step, setStep] = useState<'capture' | 'details'>('capture');
  const [preview, setPreview] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [warehouse, setWarehouse] = useState(() =>
    c.managed_warehouse_ids.length === 1 ? c.managed_warehouse_ids[0]! : '',
  );
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
  // The wizard covers the whole screen; the page behind it must not scroll.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > 8 * 1024 * 1024) {
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
  const retake = () => {
    selectedPhoto.current = null;
    uploadedPhoto.current = null;
    setPreview('');
    setStep('capture');
  };
  const command = useCommandForm(async (form: FormData) => {
    if (selectedPhoto.current && !uploadedPhoto.current) {
      const photo = new FormData();
      photo.set('photo', selectedPhoto.current);
      uploadedPhoto.current = await uploadPhoto(c.company_id, photo, 'registration');
    }
    const body = {
      tool_model_id: text(form, 'model'),
      warehouse_id: text(form, 'warehouse'),
      asset_tag: text(form, 'tag'),
      ...assetDetailsInput(form),
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
    // Close the wizard onto the new tool's sheet.
    navigate(`${root}/${tool.id}`, { replace: true });
  });
  const categoryName = (id: string) => categories.data?.find((category) => category.id === id)?.name;
  const models = refs.models.data ?? [];
  const modelOptions = models
    .filter((model) => model.registrable)
    .map((model) => ({
      value: model.id,
      label: [model.manufacturer, model.name].filter(Boolean).join(' '),
      description: [model.model_number, categoryName(model.category_id)].filter(Boolean).join(' · '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const warehouses = (refs.warehouses.data ?? []).filter((item) => !item.archived_at);
  const referenceError = refs.models.error || refs.warehouses.error;
  return {
    c,
    policy,
    canRegister,
    panelRef,
    photoInput,
    close,
    step,
    preview,
    photoError,
    choosePhoto,
    skipPhoto,
    retake,
    optionalOpen,
    toggleOptional: () => setOptionalOpen((current) => !current),
    warehouse,
    setWarehouse,
    warehouseName: warehouses.find((item) => item.id === warehouse)?.name,
    modelOptions,
    noModels: refs.models.isSuccess && models.length === 0,
    noRegistrableModels: models.length > 0 && modelOptions.length === 0,
    warehouseOptions: warehouses.map((item) => ({ value: item.id, label: item.name })),
    referenceError: referenceError ? errorMessage(referenceError) : '',
    command,
  };
}
