const emailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmailAddress = (value: string) => value.trim().toLocaleLowerCase();

export const isValidEmailAddress = (value: string) => emailAddressPattern.test(normalizeEmailAddress(value));
