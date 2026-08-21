export const pathWithBase = (basePath: string, path: string) => basePath.replace(/\/$/, '') + path;

export const responseArray = <T>(value: unknown, label: string): T[] => {
  if (!Array.isArray(value)) throw new Error('Invalid API response: ' + label);
  return value as T[];
};

export const assertUniqueIds = <T extends { id: string }>(items: T[], label: string): T[] => {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('Invalid API response: ' + label + ' ids');
  }
  return items;
};
