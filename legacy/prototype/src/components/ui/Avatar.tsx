import { cx } from '../../lib/cx';
import './Avatar.css';

export function Avatar({
  initials,
  tone = 'blue',
  size = 'medium',
}: {
  initials: string;
  tone?: 'blue' | 'amber' | 'neutral';
  size?: 'small' | 'medium' | 'large';
}) {
  return (
    <span className={cx('avatar', `avatar--${tone}`, `avatar--${size}`)} aria-hidden="true">
      {initials}
    </span>
  );
}
