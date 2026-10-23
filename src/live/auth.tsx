import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { api, result, requestKey, errorMessage } from './client';
import { useSession } from './session';
import { Field, Form, Notice, Loading, text, human } from './ui';

export function safeNext(value: string | null): string {
  return value && /^\/(invite\/[\w-]+|app(?:\/[\w-]+)*|company-setup)$/.test(value) ? value : '/app';
}
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link to="/login" className="brand">
          <Zap aria-hidden="true" /> Nelson Electric
        </Link>
        <div>
          <span className="eyebrow">TOOLS. PEOPLE. ACCOUNTABILITY.</span>
          <h1>
            Ready for <br />
            the next job.
          </h1>
          <p>
            Your tools, your team, and every handoff.
            <br />
            One place to keep work moving.
          </p>
        </div>
        <small>Tool custody · Nelson Electric</small>
      </section>
      <section className="auth-card">
        <div className="auth-inner">
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
export function Login() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading, refresh, error } = useSession();
  const next = safeNext(search.get('next'));
  if (loading) return <Loading />;
  if (session) return <Navigate to={next} replace />;
  return (
    <AuthLayout title="Welcome back" description="Sign in with your work email to continue.">
      {error && <Notice error>Unable to check your session. Check your connection and try again.</Notice>}
      <Form
        label="Sign in"
        submit={async (f) => {
          await api.POST('/api/auth/sign-in', {
            body: { email: text(f, 'email'), password: String(f.get('password')) },
          });
          await refresh();
          navigate(next, { replace: true });
        }}
      >
        <Field label="Email address" name="email" type="email" autoComplete="username" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      </Form>
      <Link className="text-link" to="/forgot-password">
        Forgot password?
      </Link>
      <p className="muted">
        New here? <Link to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </AuthLayout>
  );
}
export function Signup() {
  const [search] = useSearchParams();
  const [sent, setSent] = useState(false);
  const next = safeNext(search.get('next'));
  return (
    <AuthLayout title="Create your account" description="Verify your work email, then choose a password.">
      {sent ? (
        <Notice>
          Check your inbox for a verification link. It expires in one hour. If you already have an account, sign in or
          reset your password.
        </Notice>
      ) : (
        <Form
          label="Send verification link"
          submit={async (f) => {
            await api.POST('/api/auth/signup', {
              body: {
                name: text(f, 'name'),
                email: text(f, 'email'),
                invitation_token: next.startsWith('/invite/') ? next.slice(8) : '',
              },
            });
            setSent(true);
          }}
        >
          <Field label="Your name" name="name" autoComplete="name" required maxLength={120} />
          <Field label="Work email" name="email" type="email" autoComplete="email" required />
        </Form>
      )}
      <p className="muted">
        Already registered? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
      <Link to="/forgot-password">Reset your password</Link>
    </AuthLayout>
  );
}
function PasswordFields() {
  return (
    <>
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        maxLength={200}
        required
      />
      <small className="muted">Use at least 12 characters.</small>
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
    </>
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
  return (
    <AuthLayout title="Choose your password" description="Finish setting up your verified account.">
      <Form
        label="Create account"
        submit={async (f) => {
          await api.POST('/api/auth/verify-signup', {
            body: { token: search.get('token') ?? '', password: password(f) },
          });
          await refresh();
          const invite = search.get('invitation');
          navigate(invite ? safeNext(`/invite/${invite}`) : '/company-setup', { replace: true });
        }}
      >
        <PasswordFields />
      </Form>
      <Link className="text-link" to="/signup">
        Request a new verification link
      </Link>
    </AuthLayout>
  );
}
export function Recovery() {
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout title="Forgot your password?" description="We’ll send you a link to regain access.">
      {sent ? (
        <Notice>If an account exists for that address, a reset link has been sent. Check your inbox.</Notice>
      ) : (
        <Form
          label="Send reset link"
          submit={async (f) => {
            await api.POST('/api/auth/recover', { body: { email: text(f, 'email') } });
            setSent(true);
          }}
        >
          <Field label="Email address" name="email" type="email" autoComplete="email" required />
        </Form>
      )}
      <Link className="text-link" to="/login">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
export function ResetPassword() {
  const [search] = useSearchParams();
  const [done, setDone] = useState(false);
  const { refresh } = useSession();
  if (!search.get('token') || !search.get('email')) return <Navigate to="/forgot-password" replace />;
  return (
    <AuthLayout title="Set a new password" description="Your other sessions will be signed out.">
      {done ? (
        <Notice>Your password has been updated. Sign in with your new password.</Notice>
      ) : (
        <Form
          label="Update password"
          submit={async (f) => {
            await api.POST('/api/auth/reset', {
              body: { email: search.get('email')!, token: search.get('token')!, password: password(f) },
            });
            await refresh();
            setDone(true);
          }}
        >
          <PasswordFields />
        </Form>
      )}
      <Link className="text-link" to="/login">
        Sign in
      </Link>
      <Link className="text-link" to="/forgot-password">
        Request a new reset link
      </Link>
    </AuthLayout>
  );
}
export function CompanySetup() {
  const { session, loading, refresh, logout } = useSession();
  const [key] = useState(requestKey);
  const navigate = useNavigate();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login?next=/company-setup" replace />;
  return (
    <AuthLayout
      title="Your company workspace"
      description="Have an invitation? Open the link in your email to join your team. Otherwise, create a company below."
    >
      <Form
        label="Create company"
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
      </Form>
      {session.memberships.length > 0 && (
        <Link className="text-link" to="/app">
          Open existing company
        </Link>
      )}
      <Form label="Sign out" submit={logout}>
        <></>
      </Form>
    </AuthLayout>
  );
}
export function Invitation() {
  const { token = '' } = useParams();
  const { session, loading, refresh, logout } = useSession();
  const navigate = useNavigate();
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.GET('/api/invitations/{token}/preview', { params: { path: { token } } }).then(result),
    retry: false,
  });
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <AuthLayout title="Join your team" description="Accept your invitation to get access to your company.">
      {invitation.isPending || loading ? (
        <Loading />
      ) : invitation.error ? (
        <Notice error>{errorMessage(invitation.error)}</Notice>
      ) : (
        invitation.data && (
          <>
            <div className="invitation">
              <strong>{invitation.data.company_name}</strong>
              <span>{invitation.data.email}</span>
              <span>{human(invitation.data.role)}</span>
            </div>
            {!session ? (
              <>
                <Link className="button primary" to={`/login?next=${next}`}>
                  Sign in to accept
                </Link>
                <Link className="text-link" to={`/signup?next=${next}`}>
                  Create an account
                </Link>
              </>
            ) : session.email.toLowerCase() !== invitation.data.email.toLowerCase() ? (
              <>
                <Notice error>
                  You are signed in as {session.email}. Use {invitation.data.email} to accept this invitation.
                </Notice>
                <Form label="Sign out and switch account" submit={logout}>
                  <></>
                </Form>
              </>
            ) : (
              <Form
                label="Accept invitation"
                submit={async () => {
                  await api.POST('/api/invitations/accept', { body: { token } });
                  await refresh();
                  navigate('/app', { replace: true });
                }}
              >
                <></>
              </Form>
            )}
          </>
        )
      )}
      <Link className="text-link" to="/login">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
