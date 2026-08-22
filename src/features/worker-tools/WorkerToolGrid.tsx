import type { ToolView } from '../../domain/read-models/tools';
import { ToolCard, type ToolTransferState } from './ToolCard';

export function WorkerToolGrid({
  tools,
  pendingToolUnitIds,
  transferStatus,
  onSelect,
  onTransfer,
}: {
  tools: ToolView[];
  pendingToolUnitIds: ReadonlySet<string>;
  transferStatus: Exclude<ToolTransferState, 'pending'>;
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
        {tools.map((tool) => {
          const toolTransferState = pendingToolUnitIds.has(tool.id) ? 'pending' : transferStatus;
          return (
            <ToolCard
              key={tool.id}
              tool={tool}
              transferState={toolTransferState}
              onSelect={onSelect}
              onTransfer={onTransfer}
            />
          );
        })}
      </div>
    </section>
  );
}
