import type { ReactNode } from 'react';
import { cx } from './cx';

export function PageHeading({
  eyebrow,
  title,
  description,
  status,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  status?: string;
  action?: ReactNode;
  /** Links to related pages, kept with the heading rather than floating above the page's content. */
  children?: ReactNode;
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
        {children}
      </div>
      {action ? <div className="page-heading-action">{action}</div> : null}
      {!action && status ? <span className="page-heading-status">{status}</span> : null}
    </div>
  );
}
