import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SearchField, TextAreaField, TextField } from './TextField';
import { SelectField } from './SelectField';
import { Switch } from './Switch';

function TextHarness() {
  const [value, setValue] = useState('');
  return <TextField label="Tool name" hint="required" value={value} onChange={setValue} placeholder="Rotary hammer" />;
}

function SelectHarness() {
  const [value, setValue] = useState('');
  return (
    <SelectField
      label="Send to"
      value={value}
      onChange={setValue}
      placeholder="Choose a destination"
      options={[
        { value: 'warehouse:south-shop', label: 'South Shop', description: 'Warehouse' },
        { value: 'ray-torres', label: 'Ray Torres', description: 'Worker' },
        { value: 'sam-ochoa', label: 'Sam Ochoa', description: 'Administrator' },
      ]}
    />
  );
}

function SwitchHarness() {
  const [checked, setChecked] = useState(false);
  return (
    <Switch label="Light mode" description="Saved in this browser" checked={checked} onCheckedChange={setChecked} />
  );
}

describe('shared field primitives', () => {
  it('labels text, search, and textarea controls with the same field chrome', async () => {
    const user = userEvent.setup();
    render(
      <>
        <TextHarness />
        <SearchField label="Search tools" value="" onChange={() => undefined} />
        <TextAreaField label="Note" hint="optional" value="" onChange={() => undefined} />
      </>,
    );
    const name = screen.getByLabelText('Tool name');
    expect(name.closest('.field')).toBeTruthy();
    expect(screen.getByText('required')).toBeInTheDocument();
    await user.type(name, 'Hammer drill');
    expect(name).toHaveValue('Hammer drill');
    expect(screen.getByRole('searchbox', { name: 'Search tools' })).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  it('opens a filterable datalist overlay and keeps the selected label in the field', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    const combobox = screen.getByRole('combobox', { name: 'Send to' });
    await user.click(combobox);
    expect(screen.getByRole('listbox', { name: 'Send to' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /South Shop/ })).toBeInTheDocument();
    await user.type(combobox, 'ray');
    expect(screen.getByRole('option', { name: /Ray Torres/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /South Shop/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Ray Torres/ }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(combobox).toHaveValue('Ray Torres');
  });

  it('moves through overlay options with the keyboard and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    const combobox = screen.getByRole('combobox', { name: 'Send to' });
    await user.click(combobox);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(combobox).toHaveValue('Ray Torres');
    await user.click(combobox);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('toggles a labeled switch and ignores locked controls', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SwitchHarness />
        <Switch label="Locked rule" checked locked onCheckedChange={() => undefined} />
      </>,
    );
    const theme = screen.getByRole('switch', { name: 'Light mode' });
    expect(theme).toHaveAttribute('aria-checked', 'false');
    await user.click(theme);
    expect(theme).toHaveAttribute('aria-checked', 'true');
    const locked = screen.getByRole('switch', { name: 'Locked rule' });
    expect(locked).toBeDisabled();
    expect(locked).toHaveAttribute('aria-checked', 'true');
  });
});
