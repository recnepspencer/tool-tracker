import type { PropsWithChildren } from 'react';
import { cx } from '../../lib/cx';
import './SurfaceCard.css';

export function SurfaceCard({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={cx('surface-card', className)}>{children}</section>;
}
