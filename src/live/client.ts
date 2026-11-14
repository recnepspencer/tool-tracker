import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

export type Model<K extends keyof components['schemas']> = components['schemas'][K];
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** A dropped connection, timeout or server outage, as opposed to a decision from the server. */
export const isNetworkFailure = (error: unknown) =>
  !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429;

export const isStaleRecord = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 409 && ['stale_revision', 'stale_custody'].includes(error.code ?? '');

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function messageFrom(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'The server could not complete this request.';
  const value = body as Record<string, unknown>;
  if (typeof value.message === 'string') return value.message;
  if (typeof value.detail === 'string') return value.detail;
  if (Array.isArray(value.detail))
    return value.detail.map((v: { msg?: string }) => v.msg ?? 'Invalid input').join('. ');
  if (value.error) return messageFrom(value.error);
  return 'The server could not complete this request.';
}

function codeFrom(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = body as Record<string, unknown>;
  return typeof value.code === 'string' ? value.code : codeFrom(value.error);
}

// One CSRF token serves every write until sign-in or sign-out rotates it, so a
// save over a slow connection is one round trip instead of two.
let csrfToken: Promise<string> | null = null;
export const forgetCsrfToken = () => {
  csrfToken = null;
};
function csrf(): Promise<string> {
  csrfToken ??= fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new ApiError(response.status, 'Unable to prepare a secure request. Please retry.');
      return ((await response.json()) as { csrf_token: string }).csrf_token;
    })
    .catch((error: unknown) => {
      csrfToken = null;
      throw error;
    });
  return csrfToken;
}
// Django answers a rejected CSRF token with its HTML failure page; API errors are JSON.
const csrfRejected = (response: Response) =>
  response.status === 403 && !(response.headers.get('content-type') ?? '').includes('json');

async function send(request: Request): Promise<Response> {
  if (request.method === 'GET' || request.method === 'HEAD') return fetch(request);
  if (!navigator.onLine) throw new Error('You are offline. Reconnect before saving changes.');
  const retry = request.clone();
  request.headers.set('X-CSRFToken', await csrf());
  let response = await fetch(request);
  if (csrfRejected(response)) {
    forgetCsrfToken();
    retry.headers.set('X-CSRFToken', await csrf());
    response = await fetch(retry);
  }
  if (new URL(request.url).pathname.startsWith('/api/auth/')) forgetCsrfToken();
  return response;
}

export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: 'same-origin',
  // Revalidate with the server's ETag: an unchanged list answers 304 with no body.
  cache: 'no-cache',
  fetch: send,
});
api.use({
  async onResponse({ response, request }) {
    if (!response.ok) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (response.status === 401 && !new URL(request.url).pathname.startsWith('/api/auth/')) {
        forgetCsrfToken();
        window.dispatchEvent(new Event('session-expired'));
      }
      const error = new ApiError(response.status, messageFrom(body), codeFrom(body));
      if (
        response.status === 403 &&
        [
          'membership_required',
          'capability_required',
          'warehouse_authority_required',
          'employee_registration_disabled',
          'participation_disabled',
        ].includes(error.code ?? '')
      )
        window.dispatchEvent(new Event('company-access-changed'));
      if (isStaleRecord(error)) error.message += ' Refresh the record before trying again.';
      throw error;
    }
  },
});

export function result<T>({ data }: { data?: T }): T {
  if (data === undefined) throw new Error('The server returned an empty response.');
  return data;
}

export const requestKey = () => crypto.randomUUID();
