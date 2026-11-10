import type { ReactNode } from 'react';
import { cx } from './cx';

/** A page's title row: just the title, with an optional action or status beside it. */
export function PageHeading({
  title,
  status,
  action,
  info,
  children,
}: {
  title: string;
  status?: string;
  action?: ReactNode;
  /** A small icon button beside the title, such as an explainer. */
  info?: ReactNode;
  /** Links to related pages, kept with the heading rather than floating above the page's content. */
  children?: ReactNode;
}) {
  return (
    <div className={cx('page-heading', Boolean(action) && 'page-heading--with-action')}>
      <div>
        {info ? (
          <div className="page-heading-title">
            <h1>{title}</h1>
            {info}
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        {children}
      </div>
      {action ? <div className="page-heading-action">{action}</div> : null}
      {!action && status ? <span className="page-heading-status">{status}</span> : null}
    </div>
  );
}
