import { cx } from '../../lib/cx';

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cx('icon-chevron-down', className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m3.5 5.5 4.5 4.5 4.5-4.5" />
    </svg>
  );
}
