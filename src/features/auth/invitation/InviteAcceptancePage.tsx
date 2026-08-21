import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/AsyncState';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';
import { getDemoInvitation } from './demo-invitation-scenario';

export function InviteAcceptancePage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const invitation = getDemoInvitation(token);
  const [accepted, setAccepted] = useState(false);

  if (!invitation) {
    return (
      <AuthExperienceLayout
        eyebrow="Invitation"
        title="That invitation is unavailable"
        description="This invitation link is no longer available."
      >
        <EmptyState
          label="No invitation matches this link."
          actionLabel="Back to sign in"
          onAction={() => navigate('/login')}
        />
      </AuthExperienceLayout>
    );
  }

  if (accepted) {
    return (
      <AuthExperienceLayout
        eyebrow="Invitation accepted"
        title="Your invitation is ready"
        description="Continue to sign in and finish setting up your workspace access."
      >
        <div className="auth-complete" role="status" aria-live="polite">
          <strong>{invitation.name}</strong>
          <span>
            {invitation.role} · {invitation.company}
          </span>
        </div>
        <Button fullWidth onClick={() => navigate('/login')}>
          Continue to sign in
        </Button>
      </AuthExperienceLayout>
    );
  }

  return (
    <AuthExperienceLayout
      eyebrow="Invitation"
      title="Join the workspace"
      description="Review your invitation and continue setting up workspace access."
      footer={
        <p className="auth-experience-links">
          <Link to="/login">Back to sign in</Link>
        </p>
      }
    >
      <div className="auth-invitation-card">
        <strong>{invitation.name}</strong>
        <span>{invitation.email}</span>
        <span>
          {invitation.role} · {invitation.company}
        </span>
      </div>
      <Button fullWidth onClick={() => setAccepted(true)}>
        Accept invitation
      </Button>
    </AuthExperienceLayout>
  );
}
