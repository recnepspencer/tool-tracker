import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../../api/api-context';
import { useSession } from '../../../app/session-context';
import { homePathForRole } from '../../../app/role-home-path';
import { Button } from '../../../components/ui/Button';
import { EmptyState, LoadingState } from '../../../components/ui/AsyncState';
import { MEMBER_ROLE_LABELS } from '../../../domain/people';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';

export function InviteAcceptancePage() {
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const api = useApi();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.auth.getInvitation?.(token) ?? null,
  });
  const accept = async () => {
    setBusy(true);
    try {
      if (!api.auth.acceptInvitation) throw new Error('This invitation is unavailable.');
      const profile = await api.auth.acceptInvitation(token);
      await session.signOut();
      await session.signIn(profile.id);
      navigate(homePathForRole(profile.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The invitation could not be accepted.');
      setBusy(false);
    }
  };

  return (
    <AuthExperienceLayout
      eyebrow="Invitation"
      title={invitation.data ? 'Join Nelson Electric' : 'Your invitation'}
      description={
        invitation.data
          ? `Welcome, ${invitation.data.name}. Your workspace is ready.`
          : 'Review your invitation to join the team.'
      }
    >
      {invitation.isPending ? (
        <LoadingState label="Loading invitation…" />
      ) : !invitation.data ? (
        <EmptyState
          label="This invitation is no longer available. Ask your administrator for a new link."
          actionLabel="Back to sign in"
          onAction={() => navigate('/login')}
        />
      ) : (
        <div className="auth-form">
          <div className="auth-invitation-card">
            <strong>{invitation.data.name}</strong>
            <span>{invitation.data.email}</span>
            <span>
              {MEMBER_ROLE_LABELS[invitation.data.role]} · {invitation.data.homeWarehouse}
            </span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button fullWidth disabled={busy} onClick={() => void accept()}>
            {busy ? 'Joining…' : 'Accept invitation'}
          </Button>
        </div>
      )}
    </AuthExperienceLayout>
  );
}
