import type { PropsWithChildren } from 'react';
import './MetricGrid.css';

export function MetricGrid({ children, columns = 3 }: PropsWithChildren<{ columns?: 3 | 4 }>) {
  return <div className={`metric-grid metric-grid--${columns}`}>{children}</div>;
}
