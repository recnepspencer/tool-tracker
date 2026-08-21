import { cx } from '../../lib/cx';
import './ToolPhoto.css';

export function ToolPhoto({
  src,
  alt,
  size = 'medium',
}: {
  src: string;
  alt: string;
  size?: 'small' | 'medium' | 'large' | 'card';
}) {
  return (
    <div className={cx('tool-photo', `tool-photo--${size}`)}>
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}
