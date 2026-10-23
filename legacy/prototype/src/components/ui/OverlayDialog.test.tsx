import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { OverlayDialog } from './OverlayDialog';

function RerenderingDialogHarness() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open ? (
        <OverlayDialog label="Rerendering dialog" onClose={() => setOpen(false)}>
          <button onClick={() => setCount((value) => value + 1)}>Increment {count}</button>
          <button onClick={() => setOpen(false)}>Close dialog</button>
        </OverlayDialog>
      ) : null}
    </>
  );
}

function FormDialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open form dialog</button>
      {open ? (
        <OverlayDialog label="Form dialog" onClose={() => setOpen(false)}>
          <input aria-label="Note" placeholder="Type a note" />
          <button onClick={() => setOpen(false)}>Continue</button>
        </OverlayDialog>
      ) : null}
    </>
  );
}

describe('OverlayDialog focus lifecycle', () => {
  it('does not focus the first text field when a form dialog opens', async () => {
    const user = userEvent.setup();
    render(<FormDialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open form dialog' }));
    expect(screen.getByRole('textbox', { name: 'Note' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
  });

  it('keeps focus inside the dialog when an owner rerenders and restores it on Escape', async () => {
    const user = userEvent.setup();
    render(<RerenderingDialogHarness />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const increment = screen.getByRole('button', { name: 'Increment 0' });
    await user.click(increment);
    expect(screen.getByRole('button', { name: 'Increment 1' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Increment 1' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Rerendering dialog' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
  });
});
