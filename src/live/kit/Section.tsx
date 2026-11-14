import { useId, type PropsWithChildren, type ReactNode } from 'react';
import { cx } from './cx';
import './Section.css';

/**
 * One group of related content on a page. Its title and action sit above the cards, outside them,
 * and sections stand further apart than the cards inside one, so the page reads as groups.
 */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: PropsWithChildren<{ title: string; description?: ReactNode; action?: ReactNode; className?: string }>) {
  const id = useId();
  return (
    <section className={cx('page-section', className)} aria-labelledby={id}>
      <header className="page-section__head">
        <div className="page-section__titles">
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="page-section__action">{action}</div> : null}
      </header>
      <div className="page-section__body">{children}</div>
    </section>
  );
}
