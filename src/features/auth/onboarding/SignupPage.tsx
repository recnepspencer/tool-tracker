import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/AsyncState';
import { TextField } from '../../../components/ui/TextField';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';
import { validateOnboardingDraft } from './onboarding-draft';

export function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextError = validateOnboardingDraft({ name, email });
    setError(nextError);
    if (!nextError) navigate('/company-setup', { state: { name: name.trim(), email: email.trim() } });
  };

  return (
    <AuthExperienceLayout
      eyebrow="Create a workspace"
      title="Start a company space"
      description="Set up a new company workspace with your name and work email."
      footer={
        <p className="auth-experience-links">
          Already have an account? <Link to="/login">Return to sign in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField label="Your name" value={name} onChange={setName} autoComplete="name" required />
        <TextField label="Work email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        {error && <ErrorState message={error} />}
        <Button type="submit" fullWidth>
          Continue to company setup
        </Button>
      </form>
    </AuthExperienceLayout>
  );
}
