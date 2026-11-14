import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { LogoChoice } from './auth-ui';
import { api, ApiError, requestKey, result } from './client';
import { safeNext } from './navigation';
import { useSession } from './session';

export function useLoginState() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading, refresh, error } = useSession();
  const next = safeNext(search.get('next'));

  return { navigate, session, loading, refresh, error, next };
}
/** Store a chosen logo, or keep the one already stored. Signed-out uploads need a signup code. */
export async function saveLogo(choice: LogoChoice, signup_code = '') {
  if (choice.id || !choice.file) return choice.id ?? null;
  const file = choice.file;
  return result(
    await api.POST('/api/auth/logos', {
      body: { file: '', signup_code },
      bodySerializer: () => {
        const body = new FormData();
        body.set('file', file);
        body.set('signup_code', signup_code);
        return body;
      },
    }),
  ).id;
}

type SignupDraft = { name: string; email: string; signup_code: string; company_name: string; logo_id: string | null };

export type SignupPath = 'invited' | 'team' | 'company' | '';

export function useSignupState() {
  const [search] = useSearchParams();
  const [sentOn, setSentOn] = useState<SignupPath | null>(null);
  const [draft, setDraft] = useState<SignupDraft>({
    name: '',
    email: '',
    signup_code: search.get('code') ?? '',
    company_name: '',
    logo_id: null,
  });
  const [logo, setLogo] = useState<LogoChoice>({});
  const { session, loading } = useSession();
  const next = safeNext(search.get('next'));
  // Invited people join an existing company; everyone else is starting one with a code.
  const invitation = next.startsWith('/invite/') ? new URL(next, window.location.origin).pathname.slice(8) : '';
  // An invitation link decides the path; otherwise the visitor says whether they are joining or starting.
  const as = search.get('as');
  const path: SignupPath = invitation
    ? 'invited'
    : as === 'team' || as === 'company'
      ? as
      : search.get('code')
        ? 'company'
        : '';
  // A "check your email" notice belongs to the path it was sent from.
  const sent = sentOn === path;
  const setSent = (value: boolean) => setSentOn(value ? path : null);
  async function findInvitation(email: string) {
    await api.POST('/api/auth/invitation-links', { body: { email } });
  }
  async function send(values: SignupDraft) {
    await api.POST('/api/auth/signup', {
      body: invitation
        ? { ...values, signup_code: '', company_name: '', logo_id: null, invitation_token: invitation }
        : { ...values, invitation_token: '' },
    });
  }

  return {
    sent,
    setSent,
    draft,
    setDraft,
    logo,
    setLogo,
    session,
    loading,
    next,
    invitation,
    path,
    findInvitation,
    send,
  };
}
export function useVerifyEmailState() {
  const [search] = useSearchParams();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [invalid, setInvalid] = useState(!search.get('token'));
  const invite = search.get('invitation');
  const next = safeNext(invite ? `/invite/${invite}` : '/app');
  const signupUrl = `/signup?next=${encodeURIComponent(next)}`;

  return { search, refresh, navigate, invalid, setInvalid, invite, next, signupUrl };
}
export function useRecoveryState() {
  const [search] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(search.get('email') ?? '');
  const next = safeNext(search.get('next'));
  async function send(address: string) {
    await api.POST('/api/auth/recover', { body: { email: address } });
  }

  return { sent, setSent, email, setEmail, next, send };
}
export function useResetPasswordState() {
  const [search] = useSearchParams();
  const [done, setDone] = useState(false);
  const { refresh } = useSession();
  const email = search.get('email') ?? '';
  const token = search.get('token') ?? '';
  const missing = !token || !email;
  const recoveryUrl = `/forgot-password?email=${encodeURIComponent(email)}`;

  return { done, setDone, refresh, email, token, missing, recoveryUrl };
}
export function useCompanySetupState() {
  const [createdCompanyId, setCreatedCompanyId] = useState('');
  const { session, loading, refresh, logout, chooseCompany } = useSession();
  const [key] = useState(requestKey);
  const navigate = useNavigate();
  // The company name and logo entered at signup wait on the claimed code until setup.
  const signup = useQuery({
    queryKey: ['company-signup', session?.user_id],
    queryFn: () => api.GET('/api/company-signup').then(result),
    enabled: Boolean(session),
    staleTime: Infinity,
  });
  const [logo, setLogo] = useState<LogoChoice>();
  const [ownerElse, setOwnerElse] = useState(false);
  const pending = signup.data?.pending;
  const shownLogo = logo ?? { id: pending?.logo_id };

  return {
    session,
    loading: loading || (Boolean(session) && signup.isPending),
    refresh,
    logout,
    chooseCompany,
    key,
    navigate,
    createdCompanyId,
    setCreatedCompanyId,
    signup: signup.data,
    logo: shownLogo,
    setLogo,
    ownerElse,
    setOwnerElse,
  };
}
export function useInvitationState() {
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
  async function accept() {
    if (!data) return;
    try {
      const member = result(await api.POST('/api/invitations/accept', { body: { token } }));
      setAccepted({ name: data.company_name, membershipId: member.id });
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'invitation_expired' || error.code === 'invitation_used')) {
        await invitation.refetch();
      }
      throw error;
    }
  }

  async function register(form: FormData) {
    if (!data) return;
    if (form.get('password') !== form.get('confirm')) throw new Error('Passwords do not match.');
    try {
      const joined = result(
        await api.POST('/api/auth/invitation-signup', {
          body: { token, name: String(form.get('name') ?? '').trim(), password: String(form.get('password')) },
        }),
      );
      const membership = joined.memberships[0];
      if (!membership) throw new Error('Your access could not be loaded. Please try again.');
      setAccepted({ name: data.company_name, membershipId: membership.membership_id });
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid_invitation') await invitation.refetch();
      throw error;
    }
  }

  return {
    session,
    loading,
    refresh,
    logout,
    chooseCompany,
    navigate,
    accepted,
    accept,
    register,
    invitation,
    next,
    unavailable,
    data,
  };
}
