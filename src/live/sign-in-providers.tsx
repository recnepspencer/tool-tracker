import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, result } from './client';
import { Button } from './kit';

type Provider = 'google' | 'microsoft';

const LABELS: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft' };

// Why a Google or Microsoft round trip came back without signing anyone in (the `sso` query value).
const FAILURES: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. Choose an option to try again.',
  no_account:
    'No Tool Tracker account uses that email yet. Ask your company admin for an invitation, or start a company with a signup code.',
  account_exists: 'That email already has an account. Sign in first, then set up your company.',
  unverified_email: 'That account could not confirm its email address. Use your email and password instead.',
  wrong_email: 'Use the account for the email address this invitation was sent to.',
  invalid_invitation: 'This invitation is expired, revoked, or already used. Ask for a new link.',
  invalid_signup_code: 'This signup code is invalid, expired, or already used.',
  logo_unavailable: 'The logo upload expired. Choose the logo again.',
};

/** The sign-in options this server has keys for; none until the list arrives. */
function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    let live = true;
    api
      .GET('/api/auth/providers')
      .then((response) => {
        if (live) setProviders(result(response).providers.filter((name): name is Provider => name in LABELS));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return providers;
}

/** "Continue with Google" and friends: submit buttons that set the form's `provider` value. */
export function ProviderButtons() {
  const providers = useProviders();
  if (!providers.length) return null;
  return (
    <>
      <div className="auth-divider" aria-hidden="true">
        or
      </div>
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          fullWidth
          type="submit"
          name="provider"
          value={provider}
          formNoValidate
          className="auth-provider"
        >
          {provider === 'google' ? <GoogleMark /> : <MicrosoftMark />}
          Continue with {LABELS[provider]}
        </Button>
      ))}
    </>
  );
}

type StartBody = {
  provider: Provider;
  return_to: '/login' | '/signup';
  next?: string;
  invitation_token?: string;
  signup_code?: string;
  company_name?: string;
  logo_id?: string | null;
};

/** The provider a form was submitted with, or null for the form's own button. */
export function chosenProvider(f: FormData): Provider | null {
  const value = f.get('provider');
  return value === 'google' || value === 'microsoft' ? value : null;
}

/** Leave for the provider's sign-in page; it sends the browser back to the server, not here. */
export async function startProvider(body: StartBody) {
  const { url } = result(
    await api.POST('/api/auth/providers/start', {
      body: { next: '', invitation_token: '', signup_code: '', company_name: '', ...body },
    }),
  );
  window.location.assign(url);
  // Keep the form busy until the page is gone.
  await new Promise(() => undefined);
}

/** Explains a failed Google or Microsoft sign-in after the provider sends the person back. */
export function ProviderFailure() {
  const [search] = useSearchParams();
  const code = search.get('sso');
  if (!code) return null;
  return (
    <p className="form-error" role="alert">
      {FAILURES[code] ?? 'That sign-in did not finish. Try again, or use your email and password.'}
    </p>
  );
}

function GoogleMark() {
  return (
    <svg className="auth-provider-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg className="auth-provider-mark" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
