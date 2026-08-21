import type { ToolView } from '../../domain/read-models/tools';
import { ToolCard } from './ToolCard';

export function WorkerToolGrid({
  tools,
  onSelect,
  onTransfer,
}: {
  tools: ToolView[];
  onSelect(toolUnitId: string): void;
  onTransfer(toolUnitId: string): void;
}) {
  return (
    <section className="worker-possession-section">
      <div className="worker-section-heading">
        <div>
          <span className="worker-eyebrow">In my possession</span>
        </div>
        <span className="worker-section-count">{tools.length}</span>
      </div>
      <div className="worker-tool-list">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onSelect={onSelect} onTransfer={onTransfer} />
        ))}
      </div>
    </section>
  );
}
