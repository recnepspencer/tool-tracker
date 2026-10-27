import { useRef } from 'react';
import { uploadPhoto } from './photos';

// A failed command keeps its staged evidence identity. Successful commands clear
// it so a later, independent record cannot try to claim an attached file again.
export function useStagedPhoto(companyId: string, purpose: Parameters<typeof uploadPhoto>[2], scope: string | number) {
  const staged = useRef<{ fingerprint: string; id: string | null } | null>(null);
  return {
    clear: () => {
      staged.current = null;
    },
    upload: async (form: FormData) => {
      const file = form.get('photo');
      if (!(file instanceof File) || !file.size) return null;
      if (file.size > 8 * 1024 * 1024) throw new Error('Choose a photo under 8 MB.');
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const fingerprint = `${companyId}:${purpose}:${scope}:${file.name}:${Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')}`;
      if (staged.current?.fingerprint !== fingerprint)
        staged.current = { fingerprint, id: await uploadPhoto(companyId, form, purpose) };
      return staged.current.id;
    },
  };
}
