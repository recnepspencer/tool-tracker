import { describe, expect, it } from 'vitest';
import { filterSelectOptions, sectionSelectOptions, type SelectOption } from './select-options';

const option = (label: string, description?: string): SelectOption => ({
  value: label.toLowerCase().replace(/\s+/g, '-'),
  label,
  description,
});

describe('filterSelectOptions', () => {
  const options = [option('Hammer drill', 'Milwaukee M18'), option('Impact driver', 'DeWalt'), option('Drill bits')];

  it('matches every word anywhere, in any order', () => {
    expect(filterSelectOptions(options, 'm18 drill').map((item) => item.label)).toEqual(['Hammer drill']);
    expect(filterSelectOptions(options, 'drill').map((item) => item.label)).toEqual(['Hammer drill', 'Drill bits']);
  });

  it('returns everything for a blank query', () => {
    expect(filterSelectOptions(options, '   ')).toBe(options);
  });
});

describe('sectionSelectOptions', () => {
  const many = Array.from({ length: 40 }, (_, index) =>
    option(`${String.fromCharCode(90 - (index % 26))} tool ${index}`),
  );

  it('keeps a short list as one plain section', () => {
    const short = many.slice(0, 5);
    expect(sectionSelectOptions(short, '', [])).toEqual([{ options: short }]);
  });

  it('puts recent picks first, then the rest under letters without repeating them', () => {
    const recent = [many[3].value, 'gone'];
    const sections = sectionSelectOptions(many, '', recent);
    expect(sections[0]).toEqual({ title: 'Recent', options: [many[3]] });
    const titles = sections.slice(1).map((section) => section.title);
    expect(titles).toEqual([...titles].sort());
    const values = sections.flatMap((section) => section.options.map((item) => item.value));
    expect(new Set(values).size).toBe(many.length);
  });

  it('shows search results flat', () => {
    expect(sectionSelectOptions(many, 'tool 1', [many[0].value])).toHaveLength(1);
  });
});
