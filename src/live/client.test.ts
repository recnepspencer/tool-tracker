import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function client(fetch: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.stubGlobal('fetch', fetch);
  return import('./client');
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

it('gets fresh CSRF authority for each mutation and keeps credentials in cookies', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({ csrf_token: 'first' }))
    .mockResolvedValueOnce(response({ message: 'ok' }))
    .mockResolvedValueOnce(response({ csrf_token: 'rotated' }))
    .mockResolvedValueOnce(response({ message: 'ok' }));
  const { api } = await client(fetch);
  await api.POST('/api/auth/signup', { body: { name: 'Person', email: 'person@example.com', invitation_token: '' } });
  await api.POST('/api/auth/sign-out');
  const first = fetch.mock.calls[1][0] as Request;
  const second = fetch.mock.calls[3][0] as Request;
  expect(first.headers.get('X-CSRFToken')).toBe('first');
  expect(second.headers.get('X-CSRFToken')).toBe('rotated');
  expect(first.credentials).toBe('same-origin');
  expect(first.headers.has('Authorization')).toBe(false);
});

it('does not queue or send a mutation while offline', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const fetch = vi.fn();
  const { api } = await client(fetch);
  await expect(api.POST('/api/auth/sign-out')).rejects.toThrow('offline');
  expect(fetch).not.toHaveBeenCalled();
});

it('preserves a useful stale revision conflict and never retries the write', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response({ csrf_token: 'csrf' }))
    .mockResolvedValueOnce(response({ message: 'This record changed.', code: 'stale_revision' }, 409));
  const { api } = await client(fetch);
  await expect(
    api.POST('/api/companies/{company_id}/tool-registration-policy', {
      params: { path: { company_id: 'company' } },
      body: { expected_revision: 1, employee_tool_creation_enabled: false },
    }),
  ).rejects.toThrow('Refresh the record');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('notifies the session boundary on expired reads, without treating bad passwords as logout', async () => {
  const expired = vi.fn();
  window.addEventListener('session-expired', expired);
  const fetch = vi.fn().mockResolvedValueOnce(response({ message: 'Sign in required' }, 401));
  const { api } = await client(fetch);
  await expect(api.GET('/api/me')).rejects.toThrow('Sign in required');
  expect(expired).toHaveBeenCalledOnce();
  fetch
    .mockResolvedValueOnce(response({ csrf_token: 'fresh' }))
    .mockResolvedValueOnce(response({ message: 'Invalid password' }, 401));
  await expect(
    api.POST('/api/auth/sign-in', { body: { email: 'person@example.com', password: 'wrong' } }),
  ).rejects.toThrow('Invalid password');
  expect(expired).toHaveBeenCalledOnce();
  window.removeEventListener('session-expired', expired);
});
