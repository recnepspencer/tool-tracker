export function safeNext(value: string | null): string {
  return value && /^\/(invite\/[\w-]+|app(?:\/[\w-]+)*|company-setup)$/.test(value) ? value : '/app';
}
