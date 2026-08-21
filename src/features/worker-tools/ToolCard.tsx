import type { ToolView } from '../../domain/read-models/tools';
import { ToolPhoto } from '../../components/ui/ToolPhoto';

export function ToolCard({
  tool,
  onSelect,
  onTransfer,
}: {
  tool: ToolView;
  onSelect(toolUnitId: string): void;
  onTransfer(toolUnitId: string): void;
}) {
  return (
    <article className="worker-tool-row">
      <button
        type="button"
        className="worker-tool-main"
        onClick={() => onSelect(tool.id)}
        aria-label={`Open details for ${tool.name} unit ${tool.id}`}
        data-tool-unit-id={tool.id}
      >
        <ToolPhoto src={tool.imageSrc} alt={`${tool.name} product photo`} size="small" />
        <span className="worker-tool-copy">
          <strong>{tool.name}</strong>
          <span className="worker-tool-subtitle">
            {[tool.brand, tool.model, tool.holder.name].filter(Boolean).join(' · ')}
          </span>
          <span className="worker-tool-meta">
            <span className={`worker-tool-status worker-tool-status--${tool.status}`}>{statusLabel(tool.status)}</span>
            <span className="worker-tool-meta-dot" />
            <span>{tool.lastMoved}</span>
            <span className="worker-tool-unit">{tool.id}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        className="worker-transfer-button"
        onClick={() => onTransfer(tool.id)}
        aria-label={`Transfer ${tool.name} unit ${tool.id}`}
      >
        Transfer
      </button>
    </article>
  );
}

function statusLabel(status: ToolView['status']) {
  if (status === 'checked-out') return 'In use';
  if (status === 'in-stock') return 'Available';
  if (status === 'damaged') return 'Damaged';
  return 'Lost';
}
