import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/AsyncState';
import { TextField } from '../../../components/ui/TextField';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';

interface SignupLocationState {
  name?: string;
  email?: string;
}

export function CompanySetupPage() {
  const location = useLocation();
  const state = (location.state as SignupLocationState | null) ?? null;
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company.trim()) {
      setError('Enter a company name to continue.');
      return;
    }
    setError('Workspace creation is currently unavailable. Nothing was saved.');
  };

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
