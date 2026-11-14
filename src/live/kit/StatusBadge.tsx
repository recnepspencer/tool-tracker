import type { ReactNode } from 'react';
import { cx } from './cx';
import './StatusBadge.css';

export type StatusTone = 'in-stock' | 'with-you' | 'checked-out' | 'damaged' | 'lost' | 'retired';

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cx('status-badge', `status-badge--${tone}`)}>{children}</span>;
}
