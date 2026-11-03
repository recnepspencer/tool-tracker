import './AsyncState.css';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="async-state" role="status" aria-live="polite" aria-busy="true">
      <span className="pulse-dot" aria-hidden="true" />
      {label}
    </div>
  );
}

export function PausedState({
  label = 'Waiting for the connection to return…',
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="async-state async-state--paused" role="status" aria-live="polite">
      <span>{label}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="async-state async-state--empty" role="status" aria-live="polite">
      <span>{label}</span>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong loading this view.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="async-state async-state--error" role="alert" aria-live="assertive">
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
