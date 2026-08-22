import type userEvent from '@testing-library/user-event';

export async function attachPhoto(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Photo input not found.');
  await user.upload(input, new File(['tool photo'], 'tool-photo.jpg', { type: 'image/jpeg' }));
  return input;
}
