import { cx } from '../../lib/cx';
import './ToolPhoto.css';

export function ToolPhoto({
  src,
  alt,
  size = 'medium',
  priority = false,
}: {
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large' | 'card';
  priority?: boolean;
}) {
  return (
    <div className={cx('tool-photo', `tool-photo--${size}`)}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        {...{ fetchpriority: priority ? 'high' : 'auto' }}
        decoding="async"
      />
    </div>
  );
}
