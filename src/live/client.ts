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

export const api = createClient<paths>({
  baseUrl: window.location.origin,
  credentials: 'same-origin',
  cache: 'no-store',
});
api.use({
  async onRequest({ request }) {
    if (request.method !== 'GET') {
      if (!navigator.onLine) throw new Error('You are offline. Reconnect before saving changes.');
      const csrf = await fetch('/api/auth/csrf', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: request.signal,
      });
      if (!csrf.ok) throw new ApiError(csrf.status, 'Unable to prepare a secure request. Please retry.');
      request.headers.set('X-CSRFToken', (await csrf.json()).csrf_token);
    }
    return request;
  },
  async onResponse({ response, request }) {
    if (!response.ok) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (response.status === 401 && !new URL(request.url).pathname.startsWith('/api/auth/')) {
        window.dispatchEvent(new Event('session-expired'));
      }
      throw new ApiError(
        response.status,
        response.status === 409 && !new URL(request.url).pathname.startsWith('/api/auth/')
          ? `${messageFrom(body)} Refresh the record before trying again.`
          : messageFrom(body),
        codeFrom(body),
      );
    }
  },
});

export function result<T>({ data }: { data?: T }): T {
  if (data === undefined) throw new Error('The server returned an empty response.');
  return data;
}

export const requestKey = () => crypto.randomUUID();
