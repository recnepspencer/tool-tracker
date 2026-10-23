import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricGrid } from './MetricGrid';

describe('MetricGrid layout variants', () => {
  it('chooses three or four columns from its explicit layout contract', () => {
    const { rerender, container } = render(<MetricGrid>Three-column metrics</MetricGrid>);
    expect(container.firstElementChild).toHaveClass('metric-grid--3');
    rerender(<MetricGrid columns={4}>Four-column metrics</MetricGrid>);
    expect(container.firstElementChild).toHaveClass('metric-grid--4');
  });
});
