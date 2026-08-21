import './Callout.css';

export function Callout({
  eyebrow,
  title,
  description,
  tone = 'blue',
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: 'blue' | 'amber';
}) {
  return (
    <section className={'callout callout--' + tone}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="callout-mark" aria-hidden="true">
        →
      </span>
    </section>
  );
}
