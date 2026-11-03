import { Wrench } from 'lucide-react';
import { cx } from './cx';
import './ToolPhoto.css';

/** The demo's matted tool photo. A tool without a registration photo shows a wrench on the same matte. */
export function ToolPhoto({
  src,
  alt,
  size = 'medium',
  priority = false,
}: {
  src: string | null;
  alt: string;
  size?: 'small' | 'medium' | 'large' | 'card';
  priority?: boolean;
}) {
  return (
    <div className={cx('tool-photo', `tool-photo--${size}`, !src && 'tool-photo--empty')}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          {...{ fetchpriority: priority ? 'high' : 'auto' }}
          decoding="async"
        />
      ) : (
        <Wrench aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />
      )}
    </div>
  );
}
