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
      setError('Enter a company name to preview the setup.');
      return;
    }
    setError(null);
    setComplete(true);
  };

  if (complete) {
    return (
      <AuthExperienceLayout
        eyebrow="Walkthrough complete"
        title="Your preview is ready"
        description="No company, account, or session was created. The real product would hand this setup to an administrator here."
      >
        <div className="auth-complete" role="status" aria-live="polite">
          <strong>{company.trim()}</strong>
          <span>{state?.email ?? 'Demo owner'} · setup preview</span>
        </div>
        <Button fullWidth onClick={() => navigate('/login')}>
          Return to demo profiles
        </Button>
      </AuthExperienceLayout>
    );
  }

  return (
    <AuthExperienceLayout
      eyebrow="Company setup preview"
      title="Name the company space"
      description={
        state?.name
          ? `Welcome, ${state.name}. Choose a name to see the next step without changing demo data.`
          : 'This direct link is safe to explore; start from signup if you want to carry a preview owner.'
      }
      footer={
        <p className="auth-experience-links">
          <Link to="/signup">Back to signup</Link> · <Link to="/login">Demo profiles</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField label="Company name" value={company} onChange={setCompany} autoComplete="organization" required />
        {error && <ErrorState message={error} />}
        <Button type="submit" fullWidth>
          Preview workspace
        </Button>
      </form>
    </AuthExperienceLayout>
  );
}
