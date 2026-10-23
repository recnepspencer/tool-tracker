import { parseCanonicalInstant } from '../../domain/activity';

export const required = <T>(value: T, label: string): T => {
  if (value === undefined || value === null) throw new Error('Invalid API response: ' + label);
  return value;
};

export const stringValue = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error('Invalid API response: ' + label);
  return value;
};

export const nonBlankStringValue = (value: unknown, label: string): string => {
  const text = stringValue(value, label);
  if (!text.trim()) throw new Error('Invalid API response: ' + label);
  return text;
};

export const instantValue = (value: unknown, label: string): string => {
  const instant = nonBlankStringValue(value, label);
  if (parseCanonicalInstant(instant) === null) throw new Error('Invalid API response: ' + label);
  return instant;
};

export const numberValue = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid API response: ' + label);
  return value;
};

export const nonNegativeIntegerValue = (value: unknown, label: string): number => {
  const number = numberValue(value, label);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid API response: ' + label);
  return number;
};

export const positiveIntegerValue = (value: unknown, label: string): number => {
  const number = nonNegativeIntegerValue(value, label);
  if (number < 1) throw new Error('Invalid API response: ' + label);
  return number;
};

export const arrayValue = <T>(value: unknown, label: string, itemGuard?: (item: unknown, index: number) => T): T[] => {
  if (!Array.isArray(value)) throw new Error('Invalid API response: ' + label);
  return itemGuard ? value.map(itemGuard) : (value as T[]);
};

export const oneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error('Invalid API response: ' + label);
  }
  return value as T;
};
