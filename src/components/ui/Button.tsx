import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', fullWidth = false, className, ...props }: ButtonProps) {
  return <button className={cx('button', `button--${variant}`, fullWidth && 'button--full', className)} {...props} />;
}
