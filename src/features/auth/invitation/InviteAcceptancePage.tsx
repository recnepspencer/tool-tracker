import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../components/ui/AsyncState';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';

export function InviteAcceptancePage() {
  const navigate = useNavigate();

  return (
    <AuthExperienceLayout
      eyebrow="Invitation"
      title="That invitation is unavailable"
      description="This invitation link cannot be accepted here."
    >
      <EmptyState
        label="Ask an administrator for a current invitation."
        actionLabel="Back to sign in"
        onAction={() => navigate('/login')}
      />
    </AuthExperienceLayout>
  );
}
