import { useState } from 'react';
import './experience/company-logo.css';

/**
 * The company's logo at its own shape, beside its name. A logo two and a half times as wide as
 * it is tall usually spells the name out, so the name is then left to screen readers.
 */
export function CompanyMark({ logoId, name }: { logoId?: string | null; name: string }) {
  const [wide, setWide] = useState(false);
  return (
    <>
      {logoId && (
        <img
          key={logoId}
          className="company-logo desktop-wordmark-mark"
          src={`/api/logos/${logoId}`}
          alt=""
          onLoad={(event) => setWide(event.currentTarget.naturalWidth >= 2.5 * event.currentTarget.naturalHeight)}
        />
      )}
      <span className={logoId && wide ? 'desktop-wordmark-copy visually-hidden' : 'desktop-wordmark-copy'}>{name}</span>
    </>
  );
}
