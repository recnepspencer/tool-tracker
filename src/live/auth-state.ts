import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
export function useSignupState() {
  const [search] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '' });
  const { session, loading } = useSession();
  const next = safeNext(search.get('next'));
  async function send(values: typeof draft) {
    await api.POST('/api/auth/signup', {
      body: {
        ...values,
        invitation_token: next.startsWith('/invite/') ? new URL(next, window.location.origin).pathname.slice(8) : '',
      },
    });
  }

  return { sent, setSent, draft, setDraft, session, loading, next, send };
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

  return { session, loading, refresh, logout, chooseCompany, key, navigate, createdCompanyId, setCreatedCompanyId };
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

  return {
    token,
    session,
    loading,
    refresh,
    logout,
    chooseCompany,
    navigate,
    accepted,
    setAccepted,
    invitation,
    next,
    unavailable,
    data,
  };
}
