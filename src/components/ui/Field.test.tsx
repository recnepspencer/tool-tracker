import { render, screen, within } from '@testing-library/react';
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

function SheetSelectHarness() {
  const [value, setValue] = useState('');
  return (
    <SelectField
      label="Category"
      value={value}
      onChange={setValue}
      placeholder="Select a category"
      options={[
        { value: 'meters', label: 'Meters & testers' },
        { value: 'hand-tools', label: 'Hand tools' },
      ]}
      searchable={false}
      presentation="sheet"
    />
  );
}

function SearchableSheetSelectHarness() {
  const [value, setValue] = useState('');
  return (
    <SelectField
      label="Category"
      value={value}
      onChange={setValue}
      placeholder="Select a category"
      options={[
        { value: 'meters', label: 'Meters & testers' },
        { value: 'hand-tools', label: 'Hand tools' },
      ]}
      presentation="sheet"
      searchable
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

  it('uses a sheet trigger without rendering a raw input', async () => {
    const user = userEvent.setup();
    const { container } = render(<SheetSelectHarness />);
    const combobox = screen.getByRole('combobox', { name: 'Category' });
    expect(combobox.tagName).toBe('BUTTON');
    expect(container.querySelector('input')).not.toBeInTheDocument();

    await user.click(combobox);
    const dialog = screen.getByRole('dialog', { name: 'Choose Category' });
    expect(within(dialog).queryByRole('searchbox')).not.toBeInTheDocument();
    const listbox = within(dialog).getByRole('listbox', { name: 'Category' });
    await user.click(within(listbox).getByRole('option', { name: 'Meters & testers' }));
    expect(combobox).toHaveTextContent('Meters & testers');
    expect(screen.queryByRole('dialog', { name: 'Choose Category' })).not.toBeInTheDocument();

    await user.click(combobox);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Choose Category' })).not.toBeInTheDocument();
  });

  it('keeps optional sheet search inside the menu without auto-focusing it', async () => {
    const user = userEvent.setup();
    render(<SearchableSheetSelectHarness />);
    const combobox = screen.getByRole('combobox', { name: 'Category' });

    await user.click(combobox);
    const dialog = screen.getByRole('dialog', { name: 'Choose Category' });
    const search = within(dialog).getByRole('searchbox', { name: 'Search Category' });
    expect(search).not.toHaveFocus();

    await user.click(search);
    await user.type(search, 'hand');
    const listbox = within(dialog).getByRole('listbox', { name: 'Category' });
    expect(within(listbox).getByRole('option', { name: 'Hand tools' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Meters & testers' })).not.toBeInTheDocument();

    await user.click(within(listbox).getByRole('option', { name: 'Hand tools' }));
    expect(combobox).toHaveTextContent('Hand tools');
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
