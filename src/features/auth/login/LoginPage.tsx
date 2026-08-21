import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../../app/session-context';
import { DemoProfileCard } from './DemoProfileCard';
import { LoadingState, ErrorState, EmptyState, PausedState } from '../../../components/ui/AsyncState';
import { Button } from '../../../components/ui/Button';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';
import { useDemoProfiles } from './use-demo-profiles';

export function LoginPage() {
  const { status, restoreError, retryRestore, signIn, signInPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const profiles = useDemoProfiles();
  const unsettled = profiles.isPending || profiles.isFetching || profiles.isPaused || profiles.isError;

  if (status === 'loading') {
    return (
      <main className="auth-page">
        <LoadingState label="Preparing demo profiles…" />
      </main>
    );
  }

  const enterProfile = async (profileId: string) => {
    if (unsettled || signInPending) return;
    setError(null);
    try {
      await signIn(profileId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open that demo profile.');
    }
  };

  return (
    <AuthExperienceLayout
      eyebrow="Choose a demo profile"
      title="Sign in to continue"
      description="Click a profile to explore the experience for that role."
      footer={
        <div className="auth-experience-links">
          <Link to="/signup">Preview company setup</Link>
          <Link to="/reset-password">Preview password recovery</Link>
          <Link to="/invite/sample-invite">Preview an invitation</Link>
        </div>
      }
    >
      {profiles.isPending && !profiles.isPaused && <LoadingState label="Loading demo profiles…" />}
      {profiles.isFetching && !profiles.isPending && !profiles.isPaused && (
        <LoadingState label="Refreshing demo profiles…" />
      )}
      {profiles.isPaused && (
        <PausedState
          label="Demo profiles are waiting for the connection to return."
          onRetry={() => void profiles.refetch()}
        />
      )}
      {profiles.isError && (
        <ErrorState message="Demo profiles could not be loaded." onRetry={() => void profiles.refetch()} />
      )}
      {restoreError && (
        <div className="restore-recovery">
          <ErrorState message={restoreError} />
          <Button variant="secondary" onClick={retryRestore}>
            Retry restore
          </Button>
        </div>
      )}
      {error && <ErrorState message={error} />}
      {!unsettled && profiles.data?.length === 0 && (
        <EmptyState
          label="No demo profiles are available."
          actionLabel="Reload profiles"
          onAction={() => void profiles.refetch()}
        />
      )}
      {!unsettled && profiles.data && profiles.data.length > 0 && (
        <div className="profile-grid" aria-busy={signInPending}>
          {profiles.data.map((profile) => (
            <DemoProfileCard key={profile.id} profile={profile} onSelect={enterProfile} busy={signInPending} />
          ))}
        </div>
      )}
      <p className="auth-footnote">Static demo · walkthroughs below never create accounts or send messages.</p>
    </AuthExperienceLayout>
  );
}
