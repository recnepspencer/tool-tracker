export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectSection {
  title?: string;
  options: SelectOption[];
}

/** Lists longer than this get a search field unless the caller says otherwise. */
export const SEARCH_THRESHOLD = 7;
/** Lists longer than this are sorted into Recent and A–Z sections while the search is empty. */
export const SECTION_THRESHOLD = 30;

/** Every word of the query has to appear somewhere in the label, description or value, in any order. */
export function filterSelectOptions(options: SelectOption[], query: string): SelectOption[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return options;
  return options.filter((option) => {
    const haystack = `${option.label} ${option.description ?? ''} ${option.value}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Groups a long list the way a phone contact list reads: the recent picks first, then the rest
 * alphabetically under letter headings. Short lists, and search results, stay one plain section.
 */
export function sectionSelectOptions(options: SelectOption[], query: string, recent: string[]): SelectSection[] {
  const filtered = filterSelectOptions(options, query);
  if (options.length <= SECTION_THRESHOLD || query.trim()) return [{ options: filtered }];
  const recentOptions = recent
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is SelectOption => Boolean(option));
  const rest = options
    .filter((option) => !recentOptions.includes(option))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  const sections: SelectSection[] = recentOptions.length ? [{ title: 'Recent', options: recentOptions }] : [];
  for (const option of rest) {
    const initial = option.label.trim().charAt(0).toUpperCase();
    const title = /[A-Z]/.test(initial) ? initial : '#';
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.options.push(option);
    else sections.push({ title, options: [option] });
  }
  return sections;
}

export function selectedSelectOption(options: SelectOption[], value: string): SelectOption | undefined {
  return options.find((option) => option.value === value);
}

export function optionDomId(listboxId: string, value: string): string {
  return `${listboxId}-${value.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
