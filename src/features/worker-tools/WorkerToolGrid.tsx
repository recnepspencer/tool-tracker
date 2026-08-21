import type { ToolView } from '../../domain/read-models/tools';
import { ToolCard } from './ToolCard';

export function WorkerToolGrid({ tools, onSelect }: { tools: ToolView[]; onSelect(toolUnitId: string): void }) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Current custody</span>
          <h2>Held by you</h2>
        </div>
        <span className="section-count">{tools.length} tools</span>
      </div>
      <div className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
