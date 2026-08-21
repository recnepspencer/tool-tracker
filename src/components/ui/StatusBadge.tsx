import type { ToolStatus } from '../../domain/tool';
import { cx } from '../../lib/cx';
import './StatusBadge.css';

const statusLabel: Record<ToolStatus, string> = {
  'in-stock': 'In stock',
  'checked-out': 'Checked out',
  damaged: 'Damaged',
  lost: 'Lost',
};

export function StatusBadge({ status }: { status: ToolStatus }) {
  return <span className={cx('status-badge', `status-badge--${status}`)}>{statusLabel[status]}</span>;
}
