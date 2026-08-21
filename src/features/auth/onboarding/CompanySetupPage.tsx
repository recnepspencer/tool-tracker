import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/AsyncState';
import { TextField } from '../../../components/ui/TextField';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';

interface SignupLocationState {
  name?: string;
  email?: string;
}

export function CompanySetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as SignupLocationState | null) ?? null;
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company.trim()) {
      setError('Enter a company name to continue.');
      return;
    }
    setError(null);
    setComplete(true);
  };

  if (complete) {
    return (
      <AuthExperienceLayout
        eyebrow="Workspace setup"
        title="Your workspace is ready"
        description="Continue to sign in and access your new workspace."
      >
        <div className="auth-complete" role="status" aria-live="polite">
          <strong>{company.trim()}</strong>
          <span>{state?.email ?? 'Workspace owner'} · workspace setup</span>
        </div>
        <Button fullWidth onClick={() => navigate('/login')}>
          Continue to sign in
        </Button>
      </AuthExperienceLayout>
    );
  }

  return (
    <AuthExperienceLayout
      eyebrow="Workspace setup"
      title="Name the company space"
      description={
        state?.name
          ? `Welcome, ${state.name}. Choose a name for your workspace.`
          : 'Start from signup to include a workspace owner.'
      }
      footer={
        <p className="auth-experience-links">
          <Link to="/signup">Back to signup</Link> · <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField label="Company name" value={company} onChange={setCompany} autoComplete="organization" required />
        {error && <ErrorState message={error} />}
        <Button type="submit" fullWidth>
          Continue
        </Button>
      </form>
    </AuthExperienceLayout>
  );
}
