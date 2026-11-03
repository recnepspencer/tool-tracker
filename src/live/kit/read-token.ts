export function readTokenPx(name: `--${string}`): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Design token ${name} is missing or is not a pixel length`);
  }
  return value;
}
