import {
  saveLogo,
  useCompanySetupState,
  useInvitationState,
  useLoginState,
  useRecoveryState,
  useResetPasswordState,
  useSignupState,
  useVerifyEmailState,
} from './auth-state';

import { Link, Navigate } from 'react-router-dom';

import { api, ApiError, errorMessage, result } from './client';

import {
  AccountField as Field,
  AccountForm,
  AuthLayout,
  EmailDelivery,
  LogoField,
  PasswordFields,
  PasswordInput,
} from './auth-ui';
import { Button, ErrorState, LoadingState } from './kit';
import { chosenProvider, ProviderButtons, ProviderFailure, startProvider } from './sign-in-providers';
import { human, text } from './ui';

const primaryLink = 'button button--primary button--full';

export function Login() {
  const { navigate, session, loading, refresh, error, next } = useLoginState();
  if (loading)
    return (
      <AuthLayout title="Signing in" description="Checking your session.">
        <LoadingState label="Checking your session…" />
      </AuthLayout>
    );
  if (session) return <Navigate to={next} replace />;
  return (
    <AuthLayout
      title="Sign in"
      footer={
        <span>
          New to Tool Tracker? <Link to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </span>
      }
    >
      {error && <ErrorState message="Unable to check your session. Check your connection and try again." />}
      <ProviderFailure />
      <AccountForm
        label="Sign in"
        pendingLabel="Signing in…"
        alternatives={<ProviderButtons />}
        submit={async (f) => {
          const provider = chosenProvider(f);
          if (provider) return startProvider({ provider, return_to: '/login', next });
          await api.POST('/api/auth/sign-in', {
            body: { email: text(f, 'email'), password: String(f.get('password')) },
          });
          await refresh();
          navigate(next, { replace: true });
        }}
      >
        <Field label="Email address" name="email" type="email" autoComplete="username" required />
        <PasswordInput
          label="Password"
          name="password"
          action={<Link to={`/forgot-password?next=${encodeURIComponent(next)}`}>Forgot password?</Link>}
        />
      </AccountForm>
    </AuthLayout>
  );
}
export function Signup() {
  const state = useSignupState();
  const { session, loading, next, path } = state;
  if (!loading && session) return <Navigate to={next} replace />;
  if (path === 'team') return <FindInvitation {...state} />;
  if (path === 'invited' || path === 'company') return <SignupForm {...state} />;
  const signIn = (
    <span>
      Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
    </span>
  );
  return (
    <AuthLayout
      title="Create an account"
      description="Are you joining a team that already uses Tool Tracker, or starting one for your company?"
      footer={signIn}
    >
      <div className="auth-paths">
        <Link className="auth-path" to={withPath(next, 'team')}>
          <strong>I’m joining my team</strong>
          <span>Your company admin invites you by email. We can send that link again.</span>
        </Link>
        <Link className="auth-path" to={withPath(next, 'company')}>
          <strong>I’m starting a company</strong>
          <span>Set up a new company with the signup code you were given.</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
type SignupState = ReturnType<typeof useSignupState>;
function withPath(next: string, path: 'team' | 'company') {
  const params = new URLSearchParams({ as: path });
  if (next !== '/app') params.set('next', next);
  return `/signup?${params}`;
}
function FindInvitation({ sent, setSent, draft, setDraft, next, findInvitation }: SignupState) {
  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Find your invitation'}
      description={
        sent
          ? 'Your invitation link creates your account.'
          : 'People join a company through an invitation from its admin. Enter your work email and we’ll send any waiting invitation again.'
      }
      footer={
        <>
          <span>
            Starting a company instead? <Link to={withPath(next, 'company')}>Use a signup code</Link>
          </span>
          <span>
            Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
          </span>
        </>
      }
    >
      {sent ? (
        <>
          <div className="auth-notice" role="status">
            <p>
              If an invitation is waiting for <strong>{draft.email}</strong>, we sent its link again.
            </p>
            <p>Open the link to create your account and join your team.</p>
          </div>
          <p className="auth-help">
            Nothing arrived? Check your spam folder, then ask your company admin to invite this address.
          </p>
          <Button variant="ghost" fullWidth onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </>
      ) : (
        <AccountForm
          label="Email my invitation"
          pendingLabel="Sending…"
          submit={async (f) => {
            const email = text(f, 'email');
            await findInvitation(email);
            setDraft({ ...draft, email });
            setSent(true);
          }}
        >
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
    </AuthLayout>
  );
}
function SignupForm(state: SignupState) {
  const { sent, setSent, draft, setDraft, logo, setLogo, next, invitation, send } = state;
  return (
    <AuthLayout
      title={sent ? 'Check your email' : invitation ? 'Create your account' : 'Set up your company'}
      description={
        sent
          ? 'One more step to get started.'
          : invitation
            ? 'Start with your name and work email.'
            : 'Enter the signup code you were given, then tell us about your company.'
      }
      footer={
        <>
          {!invitation && !sent && (
            <span>
              Joining your team? <Link to={withPath(next, 'team')}>Find your invitation</Link>
            </span>
          )}
          <span>
            Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
          </span>
          {sent && <Link to={`/forgot-password?next=${encodeURIComponent(next)}`}>Reset your password</Link>}
        </>
      }
    >
      {!sent && <ProviderFailure />}
      {sent ? (
        <EmailDelivery email={draft.email} resend={() => send(draft)} changeEmail={() => setSent(false)} />
      ) : (
        <AccountForm
          label="Send verification link"
          pendingLabel="Sending verification…"
          alternatives={<ProviderButtons />}
          submit={async (f) => {
            const provider = chosenProvider(f);
            if (provider && invitation)
              return startProvider({ provider, return_to: '/signup', next, invitation_token: invitation });
            if (provider) {
              const signup_code = text(f, 'signup_code');
              return startProvider({
                provider,
                return_to: '/signup',
                signup_code,
                company_name: text(f, 'company_name'),
                logo_id: await saveLogo(logo, signup_code),
              });
            }
            const values = { ...draft, name: text(f, 'name'), email: text(f, 'email') };
            if (!invitation) {
              values.signup_code = text(f, 'signup_code');
              values.company_name = text(f, 'company_name');
              values.logo_id = await saveLogo(logo, values.signup_code);
              // Keep the stored logo so a resend or retry does not upload it again.
              if (logo.file) setLogo({ ...logo, id: values.logo_id });
            }
            await send(values);
            setDraft(values);
            setSent(true);
          }}
        >
          {!invitation && (
            <Field
              label="Signup code"
              name="signup_code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              maxLength={40}
              defaultValue={draft.signup_code}
            />
          )}
          <Field label="Your name" name="name" autoComplete="name" required maxLength={120} defaultValue={draft.name} />
          <Field
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={draft.email}
          />
          {!invitation && (
            <>
              <Field
                label="Company name"
                name="company_name"
                autoComplete="organization"
                required
                maxLength={200}
                defaultValue={draft.company_name}
              />
              <LogoField value={logo} onChange={setLogo} />
            </>
          )}
        </AccountForm>
      )}
    </AuthLayout>
  );
}
function password(f: FormData) {
  const value = String(f.get('password'));
  if (value !== f.get('confirm')) throw new Error('Passwords do not match.');
  return value;
}
export function VerifyEmail() {
  const { search, refresh, navigate, invalid, setInvalid, invite, next, signupUrl } = useVerifyEmailState();
  return (
    <AuthLayout
      title={invalid ? 'Verification link unavailable' : 'Choose your password'}
      description={
        invalid ? 'This link is missing, expired, or already used.' : 'Finish creating your Tool Tracker account.'
      }
      footer={
        invalid ? (
          <span>
            Already verified? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
          </span>
        ) : (
          <Link to={signupUrl}>Request a new verification link</Link>
        )
      }
    >
      {invalid ? (
        <Link className={primaryLink} to={signupUrl}>
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
    </AuthLayout>
  );
}
export function Recovery() {
  const { sent, setSent, email, setEmail, next, send } = useRecoveryState();
  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Reset your password'}
      description={
        sent ? 'Follow the link to get back to your account.' : 'Enter your work email to receive a reset link.'
      }
      footer={<Link to={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</Link>}
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
    </AuthLayout>
  );
}
export function ResetPassword() {
  const { done, setDone, refresh, email, token, missing, recoveryUrl } = useResetPasswordState();
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
      footer={
        !done &&
        (missing ? <Link to="/login">Back to sign in</Link> : <Link to={recoveryUrl}>Request a new reset link</Link>)
      }
    >
      {done ? (
        <>
          <div className="auth-notice" role="status">
            <p>Your password has been updated. Your other sessions have been signed out.</p>
          </div>
          <Link className={primaryLink} to="/login">
            Sign in
          </Link>
        </>
      ) : missing ? (
        <Link className={primaryLink} to={recoveryUrl}>
          Request a new reset link
        </Link>
      ) : (
        <>
          <p className="auth-help">
            Resetting the password for <strong>{email}</strong>. Changing it signs out your other sessions.
          </p>
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
        </>
      )}
    </AuthLayout>
  );
}
export function CompanySetup() {
  const {
    session,
    loading,
    refresh,
    logout,
    key,
    createdCompanyId,
    setCreatedCompanyId,
    navigate,
    chooseCompany,
    signup,
    logo,
    setLogo,
    ownerElse,
    setOwnerElse,
  } = useCompanySetupState();
  const pending = signup?.pending;
  if (loading)
    return (
      <AuthLayout title="Your workspace" description="Checking your account.">
        <LoadingState label="Checking your account…" />
      </AuthLayout>
    );
  if (!session) return <Navigate to="/login?next=/company-setup" replace />;
  if (createdCompanyId && session.memberships.some((membership) => membership.company_id === createdCompanyId))
    return <Navigate to="/app" replace />;
  return (
    <AuthLayout
      title="Your company workspace"
      description={
        pending
          ? 'Confirm your company details and who owns the company.'
          : session.memberships.length
            ? 'Choose an available workspace, or create another company with a signup code.'
            : 'Open your invitation, refresh restored access, or create a company with a signup code.'
      }
    >
      {session.memberships.length > 0 && (
        <div className="auth-workspaces">
          {session.memberships.map((membership) => (
            <AccountForm
              key={membership.company_id}
              variant="secondary"
              label={`Open ${membership.company_name}`}
              pendingLabel="Opening workspace…"
              submit={async () => {
                chooseCompany(membership.company_id);
                navigate('/app', { replace: true });
              }}
            />
          ))}
        </div>
      )}
      <AccountForm
        label="Create company"
        pendingLabel="Creating workspace…"
        submit={async (f) => {
          const logo_id = await saveLogo(logo);
          // A stored logo is reused if creating the company has to be retried.
          if (logo.file) setLogo({ ...logo, id: logo_id });
          const company = result(
            await api.POST('/api/companies', {
              body: {
                request_key: key,
                name: text(f, 'company'),
                preferred_name: text(f, 'name'),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                signup_code: pending ? '' : text(f, 'signup_code'),
                logo_id,
                owner_email: ownerElse ? text(f, 'owner_email') : null,
                owner_name: ownerElse ? text(f, 'owner_name') : '',
              },
            }),
          );
          await refresh();
          chooseCompany(company.id);
          setCreatedCompanyId(company.id);
        }}
      >
        {!pending && (
          <Field
            label="Signup code"
            name="signup_code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            required
          />
        )}
        <Field
          label="Company name"
          name="company"
          autoComplete="organization"
          maxLength={200}
          required
          defaultValue={pending?.company_name}
        />
        <LogoField value={logo} onChange={setLogo} />
        <Field label="Your name" name="name" autoComplete="name" maxLength={120} required defaultValue={signup?.name} />
        <fieldset className="auth-choice">
          <legend>Company owner</legend>
          <label>
            <input type="radio" name="owner" checked={!ownerElse} onChange={() => setOwnerElse(false)} />I own this
            company
          </label>
          <label>
            <input type="radio" name="owner" checked={ownerElse} onChange={() => setOwnerElse(true)} />
            Someone else owns it
          </label>
        </fieldset>
        {ownerElse && (
          <>
            <Field label="Owner’s name" name="owner_name" autoComplete="off" maxLength={120} required />
            <Field label="Owner’s email" name="owner_email" type="email" autoComplete="off" required />
            <p className="auth-help">
              We’ll email them an invitation. You hold ownership until they accept, and you stay an administrator.
            </p>
          </>
        )}
      </AccountForm>
      <p className="auth-help">If an administrator changed your access, refresh it here.</p>
      <AccountForm
        variant="secondary"
        label="Refresh access"
        pendingLabel="Checking access…"
        submit={async () => {
          const next = await refresh();
          if (next?.memberships.length === 1) {
            chooseCompany(next.memberships[0].company_id);
            navigate('/app', { replace: true });
          }
        }}
      />
      <AccountForm variant="ghost" label="Sign out" pendingLabel="Signing out…" submit={logout} />
    </AuthLayout>
  );
}
export function Invitation() {
  const {
    session,
    loading,
    refresh,
    logout,
    chooseCompany,
    navigate,
    accepted,
    accept,
    invitation,
    next,
    unavailable,
    data,
  } = useInvitationState();
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
      title={unavailable ? 'Invitation unavailable' : data?.owner ? 'Take ownership' : 'Join your team'}
      description={
        unavailable
          ? 'This invitation has expired, been withdrawn, or already been accepted.'
          : data?.owner
            ? 'You’ve been named the owner of a company workspace.'
            : 'You’ve been invited to a company workspace.'
      }
      footer={
        session ? (
          <Link to="/app">Back to your workspace</Link>
        ) : invitation.error ? (
          <Link to="/login">Back to sign in</Link>
        ) : (
          data && (
            <span>
              Already registered? <Link to={`/login?next=${next}`}>Sign in to accept</Link>
            </span>
          )
        )
      }
    >
      {invitation.isPending || loading ? (
        <LoadingState label="Loading invitation…" />
      ) : invitation.error ? (
        unavailable ? (
          <p className="auth-help">
            If you’ve already joined, sign in to open your workspace. Otherwise, ask your manager for a new invitation.
          </p>
        ) : (
          <>
            <ErrorState message={errorMessage(invitation.error)} />
            <AccountForm
              label="Try again"
              pendingLabel="Loading invitation…"
              submit={async () => {
                const response = await invitation.refetch();
                if (response.error) throw response.error;
              }}
            />
          </>
        )
      ) : (
        data && (
          <>
            <div className="auth-invitation-card">
              <strong>{data.company_name}</strong>
              <span>{data.email}</span>
              <span>{data.owner ? 'Owner · Company admin' : human(data.role)}</span>
            </div>
            {!session ? (
              <Link className={primaryLink} to={`/signup?next=${next}`}>
                Create an account
              </Link>
            ) : session.email.toLowerCase() !== data.email.toLowerCase() ? (
              <>
                <div className="auth-notice" role="status">
                  <p>
                    You’re signed in as <strong>{session.email}</strong>. Switch to <strong>{data.email}</strong> to
                    accept this invitation.
                  </p>
                </div>
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
                <AccountForm label="Accept invitation" pendingLabel="Joining workspace…" submit={accept} />
                <p className="auth-help">Joining as {session.email}</p>
              </>
            )}
          </>
        )
      )}
    </AuthLayout>
  );
}
