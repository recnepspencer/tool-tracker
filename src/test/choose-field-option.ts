import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

export async function chooseFieldOption(user: UserEvent, combobox: HTMLElement, optionName: string | RegExp) {
  await user.click(combobox);
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: optionName }));
}

export async function openFieldOptions(user: UserEvent, combobox: HTMLElement) {
  await user.click(combobox);
  return screen.findByRole('listbox');
}

export async function chooseTransferDestination(
  user: UserEvent,
  container: HTMLElement,
  mode: 'warehouse' | 'person',
  destinationName: string | RegExp,
) {
  await user.click(
    within(container).getByRole('button', {
      name: mode === 'warehouse' ? /Back to a warehouse/ : /To a person/,
    }),
  );
  await user.click(await within(container).findByRole('option', { name: destinationName }));
}
