import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AuthHero } from './AuthHero';
import '../../../styles/auth.css';

export function AuthExperienceLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [title]);

  return (
    <main className="auth-page">
      <AuthHero />
      <section className="auth-panel" aria-labelledby="auth-experience-heading">
        <div className="panel-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="auth-experience-heading" ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
          <p>{description}</p>
        </div>
        <div className="auth-experience-content">{children}</div>
        {footer ?? (
          <p className="auth-experience-links">
            <Link to="/login">Back to sign in</Link>
          </p>
        )}
      </section>
    </main>
  );
}
