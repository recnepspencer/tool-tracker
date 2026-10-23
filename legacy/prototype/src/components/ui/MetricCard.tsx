import { SurfaceCard } from './SurfaceCard';
import './MetricCard.css';

export function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'default' | 'blue' | 'green' | 'amber';
}) {
  return (
    <SurfaceCard className={`metric-card metric-card--${tone}`}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </SurfaceCard>
  );
}
