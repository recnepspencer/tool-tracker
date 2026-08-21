export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export function filterSelectOptions(options: SelectOption[], query: string): SelectOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options;
  return options.filter((option) => {
    const haystack = `${option.label} ${option.description ?? ''} ${option.value}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function selectedSelectOption(options: SelectOption[], value: string): SelectOption | undefined {
  return options.find((option) => option.value === value);
}

export function optionDomId(listboxId: string, value: string): string {
  return `${listboxId}-${value.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
