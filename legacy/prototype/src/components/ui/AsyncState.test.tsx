import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, LoadingState, PausedState } from './AsyncState';
import { render } from '@testing-library/react';

describe('async state semantics', () => {
  it('marks loading as busy and polite', () => {
    render(<LoadingState label="Loading profiles" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading profiles');
  });

  it('offers retry and recovery semantics for paused, empty, and error states', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <>
        <PausedState label="Offline" onRetry={retry} />
        <EmptyState label="Nothing here" actionLabel="Reload" onAction={retry} />
        <ErrorState message="Failed" onRetry={retry} />
      </>,
    );
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Offline');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    expect(retry).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });
});
