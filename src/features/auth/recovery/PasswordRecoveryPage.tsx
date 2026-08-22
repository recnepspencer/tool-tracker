import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/AsyncState';
import { TextField } from '../../../components/ui/TextField';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';
import { isValidEmailAddress } from '../../../domain/email-address';

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidEmailAddress(email)) return setError('Enter a valid email address.');
    setError('Account recovery is currently unavailable. No reset request was sent.');
  };

  return (
    <AuthExperienceLayout
      eyebrow="Account recovery"
      title="Recover access"
      description="Enter your email to request account recovery."
      footer={
        <p className="auth-experience-links">
          <Link to="/login">Back to sign in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <TextField label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        {error && <ErrorState message={error} />}
        <Button type="submit" fullWidth>
          Request recovery link
        </Button>
      </form>
    </AuthExperienceLayout>
  );
}
