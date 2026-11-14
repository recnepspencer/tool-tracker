import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Returns from a page reached through another, such as Damaged & lost from the Queue. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="back-link" to={to}>
      <ChevronLeft aria-hidden="true" />
      {children}
    </Link>
  );
}

/** Pages reached from this one, which no longer have their own navigation entry. */
export function RelatedLinks({ label, links }: { label: string; links: { to: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <nav className="related-links" aria-label={label}>
      {links.map((link) => (
        <Link key={link.to} className="related-link" to={link.to}>
          {link.label}
          <ChevronRight aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
