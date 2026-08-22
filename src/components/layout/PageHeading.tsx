import '../ui/Typography.css';

export function PageHeading({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {status ? (
        <span className="live-indicator">
          <i /> {status}
        </span>
      ) : null}
    </div>
  );
}
