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
        eyebrow="Invitation preview"
        title="That invitation is unavailable"
        description="This static demo only includes one sample invitation and never validates real tokens."
      >
        <EmptyState
          label="No demo invitation matches this link."
          actionLabel="Back to demo profiles"
          onAction={() => navigate('/login')}
        />
      </AuthExperienceLayout>
    );
  }

  if (accepted) {
    return (
      <AuthExperienceLayout
        eyebrow="Walkthrough complete"
        title="Invitation preview accepted"
        description="No member was activated and no invite token was stored. The real product would continue through its account setup flow here."
      >
        <div className="auth-complete" role="status" aria-live="polite">
          <strong>{invitation.name}</strong>
          <span>
            {invitation.role} · {invitation.company}
          </span>
        </div>
        <Button fullWidth onClick={() => navigate('/login')}>
          Return to demo profiles
        </Button>
      </AuthExperienceLayout>
    );
  }

  return (
    <AuthExperienceLayout
      eyebrow="Invitation preview"
      title="Join the demo workspace"
      description="Review a sample invite without creating a person record or changing the shared demo database."
      footer={
        <p className="auth-experience-links">
          <Link to="/login">Back to demo profiles</Link>
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
        Preview acceptance
      </Button>
    </AuthExperienceLayout>
  );
}
