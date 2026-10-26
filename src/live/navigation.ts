export function safeNext(value: string | null): string {
  if (!value || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
    return '/app';
  try {
    const next = new URL(value, 'https://nelson.invalid');
    if (
      next.origin !== 'https://nelson.invalid' ||
      !/^\/(invite\/[\w-]+|app(?:\/[\w-]+)*|company-setup)$/.test(next.pathname)
    )
      return '/app';
    return next.pathname + next.search + next.hash;
  } catch {
    return '/app';
  }
}
