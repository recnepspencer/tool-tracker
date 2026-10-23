import { cx } from '../../lib/cx';
import { responsiveToolImageSource } from './responsive-image';
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
  const srcSet = responsiveToolImageSource(src);
  return (
    <div className={cx('tool-photo', `tool-photo--${size}`)}>
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? imageSizes[size] : undefined}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        {...{ fetchpriority: priority ? 'high' : 'auto' }}
        decoding="async"
      />
    </div>
  );
}

const imageSizes = {
  small: '44px',
  medium: '(max-width: 620px) 104px, 148px',
  card: '(max-width: 620px) 104px, 148px',
  large: '(max-width: 620px) calc(100vw - 40px), 500px',
} as const;
