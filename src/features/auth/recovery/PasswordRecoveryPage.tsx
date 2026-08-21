import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/AsyncState';
import { TextField } from '../../../components/ui/TextField';
import { AuthExperienceLayout } from '../layout/AuthExperienceLayout';
import { validDemoPassword, validRecoveryCode, validRecoveryEmail, type RecoveryStep } from './recovery-state';

export function PasswordRecoveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RecoveryStep>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'request') {
      if (!validRecoveryEmail(email)) return setError('Enter a valid email address.');
      setError(null);
      setStep('code');
      return;
    }
    if (step === 'code') {
      if (!validRecoveryCode(code)) return setError('Enter the six-digit demo code 123456.');
      setError(null);
      setStep('password');
      return;
    }
    if (!validDemoPassword(password)) return setError('Use at least eight characters for the demo password.');
    setError(null);
    setStep('complete');
  };

  if (step === 'complete') {
    return (
      <AuthExperienceLayout
        eyebrow="Walkthrough complete"
        title="Recovery preview finished"
        description="No password was stored, no email was sent, and no session was changed."
      >
        <div className="auth-complete" role="status" aria-live="polite">
          <strong>{email.trim()}</strong>
          <span>Demo recovery only</span>
        </div>
        <Button fullWidth onClick={() => navigate('/login')}>
          Return to demo profiles
        </Button>
      </AuthExperienceLayout>
    );
  }

  const title =
    step === 'request' ? 'Recover demo access' : step === 'code' ? 'Enter the demo code' : 'Choose a demo password';
  const description =
    step === 'request'
      ? 'Preview the recovery sequence. The static demo never sends an email.'
      : step === 'code'
        ? 'Use 123456 to continue this local walkthrough.'
        : 'This value is checked in memory only and is never persisted.';

  return (
    <AuthExperienceLayout
      eyebrow="Optional walkthrough"
      title={title}
      description={description}
      footer={
        <p className="auth-experience-links">
          <Link to="/login">Back to demo profiles</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {step === 'request' && (
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
        )}
        {step === 'code' && (
          <TextField
            label="Demo code"
            inputMode="numeric"
            value={code}
            onChange={setCode}
            autoComplete="one-time-code"
            required
          />
        )}
        {step === 'password' && (
          <TextField
            label="New demo password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
          />
        )}
        {error && <ErrorState message={error} />}
        <Button type="submit" fullWidth>
          {step === 'request' ? 'Continue' : step === 'code' ? 'Verify code' : 'Finish preview'}
        </Button>
        {step !== 'request' && (
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => {
              setError(null);
              setStep(step === 'password' ? 'code' : 'request');
            }}
          >
            Back
          </Button>
        )}
      </form>
    </AuthExperienceLayout>
  );
}
