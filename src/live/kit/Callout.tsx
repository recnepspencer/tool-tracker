import './Callout.css';

export function Callout({
  title,
  description,
  tone = 'blue',
}: {
  title: string;
  description: string;
  tone?: 'blue' | 'amber';
}) {
  return (
    <section className={'callout callout--' + tone}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="callout-mark" aria-hidden="true">
        →
      </span>
    </section>
  );
}
