import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, result, requestKey, errorMessage } from './client';
import { useSession } from './session';
import { Field, Notice, Loading, text, human } from './ui';
import { AuthLayout, AccountForm, AccountFooter, EmailDelivery, PasswordInput, PasswordFields } from './auth-ui';

export function safeNext(value: string | null): string {
  return value && /^\/(invite\/[\w-]+|app(?:\/[\w-]+)*|company-setup)$/.test(value) ? value : '/app';
}
export function Login() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading, refresh, error } = useSession();
  const next = safeNext(search.get('next'));
  if (loading)
    return (
      <AuthLayout title="Signing in" description="Checking your session.">
        <Loading />
      </AuthLayout>
    );
  if (session) return <Navigate to={next} replace />;
  return (
    <AuthLayout title="Sign in" description="Use your work email to continue.">
      {error && <Notice error>Unable to check your session. Check your connection and try again.</Notice>}
      <AccountForm
        label="Sign in"
        pendingLabel="Signing in…"
        submit={async (f) => {
          await api.POST('/api/auth/sign-in', {
            body: { email: text(f, 'email'), password: String(f.get('password')) },
          });
          await refresh();
          navigate(next, { replace: true });
        }}
      >
        <Field label="Email address" name="email" type="email" autoComplete="username" required />
        <PasswordInput label="Password" name="password" />
      </AccountForm>
      <Link className="text-link auth-recovery" to={`/forgot-password?next=${encodeURIComponent(next)}`}>
        Forgot password?
      </Link>
      <AccountFooter>
        Don’t have an account? <Link to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </AccountFooter>
    </AuthLayout>
  );
}
export function Signup() {
  const [search] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '' });
  const { session, loading } = useSession();
  const next = safeNext(search.get('next'));
  async function send(values: typeof draft) {
    await api.POST('/api/auth/signup', {
      body: { ...values, invitation_token: next.startsWith('/invite/') ? next.slice(8) : '' },
    });
  }
  if (!loading && session) return <Navigate to={next} replace />;
  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Create your account'}
      description={sent ? 'One more step to get started.' : 'Start with your name and work email.'}
    >
      {sent ? (
        <EmailDelivery email={draft.email} resend={() => send(draft)} changeEmail={() => setSent(false)} />
      ) : (
        <AccountForm
          label="Send verification link"
          pendingLabel="Sending verification…"
          submit={async (f) => {
            const values = { name: text(f, 'name'), email: text(f, 'email') };
            await send(values);
            setDraft(values);
            setSent(true);
          }}
        >
          <Field label="Your name" name="name" autoComplete="name" required maxLength={120} defaultValue={draft.name} />
          <Field
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={draft.email}
          />
        </AccountForm>
      )}
      <AccountFooter>
        Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        {sent && (
          <Link className="auth-footer-row" to={`/forgot-password?next=${encodeURIComponent(next)}`}>
            Reset your password
          </Link>
        )}
      </AccountFooter>
    </AuthLayout>
  );
}
function password(f: FormData) {
  const value = String(f.get('password'));
  if (value !== f.get('confirm')) throw new Error('Passwords do not match.');
  return value;
}
export function VerifyEmail() {
  const [search] = useSearchParams();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [invalid, setInvalid] = useState(!search.get('token'));
  const invite = search.get('invitation');
  const next = safeNext(invite ? `/invite/${invite}` : '/app');
  const signupUrl = `/signup?next=${encodeURIComponent(next)}`;
  return (
    <AuthLayout
      title={invalid ? 'Verification link unavailable' : 'Choose your password'}
      description={
        invalid ? 'This link is missing, expired, or already used.' : 'Finish creating your Nelson Electric account.'
      }
    >
      {invalid ? (
        <Link className="button primary" to={signupUrl}>
          Request a new verification link
        </Link>
      ) : (
        <AccountForm
          label="Create account"
          pendingLabel="Creating account…"
          submit={async (f) => {
            try {
              await api.POST('/api/auth/verify-signup', {
                body: { token: search.get('token') ?? '', password: password(f) },
              });
            } catch (error) {
              if (error instanceof ApiError && error.code === 'invalid_verification_link') {
                setInvalid(true);
                return;
              }
              throw error;
            }
            await refresh();
            navigate(invite ? next : '/company-setup', { replace: true });
          }}
        >
          <PasswordFields />
        </AccountForm>
      )}
      <AccountFooter>
        {invalid ? (
          <>
            Already verified? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
          </>
        ) : (
          <Link to={signupUrl}>Request a new verification link</Link>
        )}
      </AccountFooter>
    </AuthLayout>
  );
}
export function Recovery() {
  const [search] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(search.get('email') ?? '');
  const next = safeNext(search.get('next'));
  async function send(address: string) {
    await api.POST('/api/auth/recover', { body: { email: address } });
  }
  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Reset your password'}
      description={
        sent ? 'Follow the link to get back to your account.' : 'Enter your work email to receive a reset link.'
      }
    >
      {sent ? (
        <EmailDelivery email={email} recovery resend={() => send(email)} changeEmail={() => setSent(false)} />
      ) : (
        <AccountForm
          label="Send reset link"
          pendingLabel="Sending reset link…"
          submit={async (f) => {
            const address = text(f, 'email');
            await send(address);
            setEmail(address);
            setSent(true);
          }}
        >
          <Field label="Email address" name="email" type="email" autoComplete="email" required defaultValue={email} />
        </AccountForm>
      )}
      <AccountFooter>
        <Link to={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
      </AccountFooter>
    </AuthLayout>
  );
}
export function ResetPassword() {
  const [search] = useSearchParams();
  const [done, setDone] = useState(false);
  const { refresh } = useSession();
  const email = search.get('email') ?? '';
  const token = search.get('token') ?? '';
  const missing = !token || !email;
  const recoveryUrl = `/forgot-password?email=${encodeURIComponent(email)}`;
  return (
    <AuthLayout
      title={done ? 'Password updated' : missing ? 'Reset link unavailable' : 'Set a new password'}
      description={
        done
          ? 'Your account is ready to use.'
          : missing
            ? 'Open the complete link from your email, or request another.'
            : 'Choose a password you haven’t used before.'
      }
    >
      {done ? (
        <>
          <p className="auth-message" role="status">
            Your password has been updated. Your other sessions have been signed out.
          </p>
          <Link className="button primary" to="/login">
            Sign in
          </Link>
        </>
      ) : missing ? (
        <Link className="button primary" to={recoveryUrl}>
          Request a new reset link
        </Link>
      ) : (
        <>
          <p className="auth-account-email">{email}</p>
          <AccountForm
            label="Update password"
            pendingLabel="Updating password…"
            submit={async (f) => {
              try {
                await api.POST('/api/auth/reset', { body: { email, token, password: password(f) } });
              } catch (error) {
                if (error instanceof ApiError && error.code === 'password_reset_unavailable') {
                  throw new Error(
                    'Unable to reset your password. This link may have expired or already been used. Try again or request a new link below.',
                    { cause: error },
                  );
                }
                throw error;
              }
              // The password is already changed even if the following session refresh fails.
              setDone(true);
              await refresh().catch(() => undefined);
            }}
          >
            <PasswordFields />
          </AccountForm>
          <p className="auth-help">Changing your password signs out your other sessions.</p>
        </>
      )}
      {!done && (
        <AccountFooter>
          {missing ? <Link to="/login">Back to sign in</Link> : <Link to={recoveryUrl}>Request a new reset link</Link>}
        </AccountFooter>
      )}
    </AuthLayout>
  );
}
export function CompanySetup() {
  const { session, loading, refresh, logout } = useSession();
  const [key] = useState(requestKey);
  const navigate = useNavigate();
  if (loading)
    return (
      <AuthLayout title="Your workspace" description="Checking your account.">
        <Loading />
      </AuthLayout>
    );
  if (!session) return <Navigate to="/login?next=/company-setup" replace />;
  return (
    <AuthLayout
      title="Your company workspace"
      description="Have an invitation? Open the link in your email to join your team. Otherwise, create a company below."
    >
      <AccountForm
        label="Create company"
        pendingLabel="Creating workspace…"
        submit={async (f) => {
          await api.POST('/api/companies', {
            body: {
              request_key: key,
              name: text(f, 'company'),
              preferred_name: text(f, 'name'),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          });
          await refresh();
          navigate('/app', { replace: true });
        }}
      >
        <Field label="Company name" name="company" autoComplete="organization" maxLength={200} required />
        <Field label="Your name" name="name" autoComplete="name" maxLength={120} required />
      </AccountForm>
      {session.memberships.length > 0 && (
        <Link className="text-link" to="/app">
          Open existing company
        </Link>
      )}
      <AccountFooter>
        <AccountForm secondary label="Sign out" pendingLabel="Signing out…" submit={logout}>
          <></>
        </AccountForm>
      </AccountFooter>
    </AuthLayout>
  );
}
export function Invitation() {
  const { token = '' } = useParams();
  const { session, loading, refresh, logout, chooseCompany } = useSession();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState<{ name: string; membershipId: string }>();
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.GET('/api/invitations/{token}/preview', { params: { path: { token } } }).then(result),
    retry: false,
  });
  const next = encodeURIComponent(`/invite/${token}`);
  const unavailable = invitation.error instanceof ApiError && invitation.error.status === 404;
  const data = invitation.data;
  if (accepted)
    return (
      <AuthLayout title="Invitation accepted" description={`Your access to ${accepted.name} is ready.`}>
        <AccountForm
          label="Open workspace"
          pendingLabel="Opening workspace…"
          submit={async () => {
            const updated = await refresh();
            const membership = updated?.memberships.find((member) => member.membership_id === accepted.membershipId);
            if (!membership) throw new Error('Your access could not be loaded. Please try again.');
            chooseCompany(membership.company_id);
            navigate('/app', { replace: true });
          }}
        />
      </AuthLayout>
    );
  return (
    <AuthLayout
      title={unavailable ? 'Invitation unavailable' : 'Join your team'}
      description={
        unavailable
          ? 'This invitation has expired, been withdrawn, or already been accepted.'
          : 'You’ve been invited to a company workspace.'
      }
    >
      {invitation.isPending || loading ? (
        <Loading />
      ) : invitation.error ? (
        <>
          {unavailable ? (
            <p className="auth-message">
              If you’ve already joined, sign in to open your workspace. Otherwise, ask your manager for a new
              invitation.
            </p>
          ) : (
            <>
              <p className="auth-error" role="alert">
                {errorMessage(invitation.error)}
              </p>
              <AccountForm
                label="Try again"
                pendingLabel="Loading invitation…"
                submit={async () => {
                  const response = await invitation.refetch();
                  if (response.error) throw response.error;
                }}
              />
            </>
          )}
        </>
      ) : (
        data && (
          <>
            <div className="auth-invitation">
              <span className="auth-caption">WORKSPACE</span>
              <strong>{data.company_name}</strong>
              <dl>
                <div>
                  <dt>Invited email</dt>
                  <dd>{data.email}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{human(data.role)}</dd>
                </div>
              </dl>
            </div>
            {!session ? (
              <>
                <Link className="button primary" to={`/signup?next=${next}`}>
                  Create an account
                </Link>
                <AccountFooter>
                  Already registered? <Link to={`/login?next=${next}`}>Sign in to accept</Link>
                </AccountFooter>
              </>
            ) : session.email.toLowerCase() !== data.email.toLowerCase() ? (
              <>
                <p className="auth-message" role="status">
                  You’re signed in as <strong>{session.email}</strong>. Switch to <strong>{data.email}</strong> to
                  accept this invitation.
                </p>
                <AccountForm
                  label="Switch account"
                  pendingLabel="Signing out…"
                  submit={async () => {
                    await logout();
                    navigate(`/login?next=${next}`, { replace: true });
                  }}
                />
              </>
            ) : (
              <>
                <AccountForm
                  label="Accept invitation"
                  pendingLabel="Joining workspace…"
                  submit={async () => {
                    const member = result(await api.POST('/api/invitations/accept', { body: { token } }));

                    setAccepted({ name: data.company_name, membershipId: member.id });
                  }}
                />
                <p className="auth-help">Joining as {session.email}</p>
              </>
            )}
          </>
        )
      )}
      {(invitation.error || session) && (
        <AccountFooter>
          <Link to={session ? '/app' : '/login'}>{session ? 'Back to your workspace' : 'Back to sign in'}</Link>
        </AccountFooter>
      )}
    </AuthLayout>
  );
}
