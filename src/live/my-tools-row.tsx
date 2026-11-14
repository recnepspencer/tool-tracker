import type { Model } from './client';
import { formatDate } from './format';
import { ToolPhoto } from './kit';
import { photoSrc, toolStatus, workerStatusLabel } from './tool-status';

export type ToolTransferState = 'ready' | 'pending' | 'checking' | 'unavailable';

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' });

/** "5m ago", "2d ago"; a week or older reads as a date. */
export function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
  if (minutes > -1) return 'Just now';
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  return days > -7 ? relative.format(days, 'day') : formatDate(value);
}

const transferSummary: Record<ToolTransferState, string> = {
  ready: 'Ready to transfer',
  pending: 'In transfer',
  checking: 'Transfer status',
  unavailable: 'Transfer status',
};
const transferStateLabel: Record<Exclude<ToolTransferState, 'ready'>, string> = {
  pending: 'Pending',
  checking: 'Checking…',
  unavailable: 'Unavailable',
};

/** The demo's worker `ToolCard` row. */
export function ToolRow({
  tool,
  companyId,
  transferState,
  onSelect,
  onTransfer,
}: {
  tool: Model<'AssetView'>;
  companyId: string;
  transferState: ToolTransferState;
  onSelect(id: string): void;
  onTransfer(id: string): void;
}) {
  const status = toolStatus(tool);
  return (
    <article
      className={`worker-tool-row worker-tool-row--${status}${
        transferState === 'pending' ? ' worker-tool-row--transfer-pending' : ''
      }`}
    >
      <button
        type="button"
        className="worker-tool-main"
        onClick={() => onSelect(tool.id)}
        aria-label={`Open details for ${tool.name}`}
        data-tool-unit-id={tool.id}
      >
        <ToolPhoto
          src={photoSrc(companyId, tool.registration_photo_id)}
          alt={`${tool.name} product photo`}
          size="small"
        />
        <span className="worker-tool-copy">
          <strong>{tool.name}</strong>
          <span className="worker-tool-subtitle">
            {[tool.manufacturer, tool.model_number, tool.holder_name].filter(Boolean).join(' · ')}
          </span>
          <span className="worker-tool-meta">
            <span className={`worker-tool-status worker-tool-status--${status}`}>
              {tool.lifecycle === 'disposed' ? 'Disposed' : workerStatusLabel[status]}
            </span>
            <span className="worker-tool-meta-dot" />
            {tool.custody_started_at && (
              <time dateTime={tool.custody_started_at}>{relativeTime(tool.custody_started_at)}</time>
            )}
          </span>
        </span>
      </button>
      <span className="worker-transfer-control">
        <span className="worker-transfer-label">{transferSummary[transferState]}</span>
        {transferState === 'ready' ? (
          <button
            type="button"
            className="worker-transfer-button"
            onClick={() => onTransfer(tool.id)}
            aria-label={`Transfer ${tool.name}`}
          >
            Start transfer
          </button>
        ) : (
          <span className={`worker-transfer-state worker-transfer-state--${transferState}`}>
            {transferStateLabel[transferState]}
          </span>
        )}
      </span>
    </article>
  );
}
