import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import '../ui/Typography.css';

export function PageHeading({
  eyebrow,
  title,
  description,
  status,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  status?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cx(
        'page-heading',
        Boolean(action) && 'page-heading--with-action',
        !eyebrow && 'page-heading--without-eyebrow',
      )}
    >
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-heading-action">{action}</div> : null}
      {!action && status ? <span className="page-heading-status">{status}</span> : null}
    </div>
  );
}
