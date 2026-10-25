import { api, result } from './client';
import { Field } from './ui';
export async function uploadPhoto(
  company_id: string,
  f: FormData,
  purpose: 'registration' | 'incident' | 'handoff' | 'service' | 'reconciliation',
) {
  const file = f.get('photo');
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose a photo under 8 MB.');
  return result(
    await api.POST('/api/companies/{company_id}/files', {
      params: { path: { company_id } },
      body: { file: '', purpose },
      bodySerializer: () => {
        const body = new FormData();
        body.set('file', file);
        body.set('purpose', purpose);
        return body;
      },
    }),
  ).id;
}
export function PhotoField() {
  return (
    <Field
      label="Photo (optional, up to 8 MB)"
      name="photo"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
    />
  );
}
