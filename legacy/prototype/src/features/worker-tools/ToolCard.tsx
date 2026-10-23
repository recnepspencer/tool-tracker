import type { ToolView } from '../../domain/read-models/tools';
import { ToolPhoto } from '../../components/ui/ToolPhoto';

export type ToolTransferState = 'ready' | 'pending' | 'checking' | 'unavailable';

export function ToolCard({
  tool,
  transferState,
  onSelect,
  onTransfer,
}: {
  tool: ToolView;
  transferState: ToolTransferState;
  onSelect(toolUnitId: string): void;
  onTransfer(toolUnitId: string): void;
}) {
  return (
    <article
      className={`worker-tool-row worker-tool-row--${tool.status}${
        transferState === 'pending' ? ' worker-tool-row--transfer-pending' : ''
      }`}
    >
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
      <span className="worker-transfer-control">
        <span className="worker-transfer-label">{transferSummary(transferState)}</span>
        {transferState === 'ready' ? (
          <button
            type="button"
            className="worker-transfer-button"
            onClick={() => onTransfer(tool.id)}
            aria-label={`Transfer ${tool.name} unit ${tool.id}`}
          >
            Start transfer
          </button>
        ) : (
          <span className={`worker-transfer-state worker-transfer-state--${transferState}`}>
            {transferStateLabel(transferState)}
          </span>
        )}
      </span>
    </article>
  );
}

function transferStateLabel(state: Exclude<ToolTransferState, 'ready'>) {
  if (state === 'pending') return 'Pending';
  if (state === 'checking') return 'Checking…';
  return 'Unavailable';
}

function transferSummary(state: ToolTransferState) {
  if (state === 'ready') return 'Ready to transfer';
  if (state === 'pending') return 'In transfer';
  return 'Transfer status';
}

function statusLabel(status: ToolView['status']) {
  if (status === 'checked-out') return 'In use';
  if (status === 'in-stock') return 'Available';
  if (status === 'damaged') return 'Damaged';
  return 'Lost';
}
