import type { PropsWithChildren } from 'react';
import { cx } from './cx';
import './FieldGroup.css';

/**
 * Fields as one group of rows, the way iOS Settings lays out a form: the label on the left, the
 * value on the right, hairlines between. A note or a photo stacks its label above instead.
 */
export function FieldGroup({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <div className={cx('field-group', className)}>{children}</div>;
}
