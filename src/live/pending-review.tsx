import { useId } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Wrench } from 'lucide-react';
import { formatDateTime } from './format';
import { Callout, OverlayDialog, cx } from './kit';
import {
  pendingActionLabel,
  pendingDirectionLabel,
  pendingStatusLabel,
  usePendingDecision,
  type PendingItem,
} from './pending-state';
import { CustodyEvidenceFields } from './photos';
import { useCompany } from './session';
import { photoSrc } from './tool-status';

/**
 * The demo's `PendingHandoffReviewSheet`. One footer button per allowed
 * decision; Accept stays locked until the receiver confirms the inspection.
 * The live decision endpoints take a note but no photo, so the picker is hidden.
 */
export function PendingHandoffReviewSheet({ item, onClose }: { item: PendingItem; onClose(): void }) {
  const c = useCompany();
  const formId = useId();
  const decision = usePendingDecision(item, onClose);
  const incoming = item.variant === 'incoming';
  const DirectionIcon = incoming ? ArrowDownToLine : ArrowUpFromLine;
  const image = photoSrc(c.company_id, item.asset?.registration_photo_id);
  const voidOnly = item.actions.length === 1 && item.actions[0] === 'void';
  return (
    <OverlayDialog
      label={`${item.toolName} transfer review`}
      onClose={onClose}
      backdropClassName="worker-pending-review-backdrop"
      panelClassName={`worker-pending-review-sheet worker-pending-review-sheet--${incoming ? 'incoming' : 'outgoing'}`}
    >
      <div className="worker-pending-review-handle-wrap">
        <span className="worker-sheet-handle" />
      </div>
      <form
        id={formId}
        className="worker-pending-review-scroll"
        data-overlay-scroll
        aria-busy={decision.busy}
        onSubmit={decision.submit}
      >
        {/* Enter in the note must not pick a decision: the default button is inert. */}
        <button type="submit" disabled hidden aria-hidden="true" tabIndex={-1} />
        <div className="worker-pending-review-heading">
          <span
            className={
              incoming ? 'worker-pending-review-tag worker-pending-review-tag--incoming' : 'worker-pending-review-tag'
            }
          >
            <DirectionIcon aria-hidden="true" className="worker-pending-direction-icon" />
            {pendingDirectionLabel(item)}
          </span>
          <time dateTime={item.requestedAt}>{formatDateTime(item.requestedAt)}</time>
        </div>
        <span className="worker-pending-review-status">{pendingStatusLabel(item)}</span>
        <div className="worker-pending-review-hero">
          <div className={cx('worker-pending-review-photo', !image && 'tool-photo--empty')}>
            {image ? (
              <img src={image} alt={`${item.toolName} transfer photo`} loading="lazy" decoding="async" />
            ) : (
              <Wrench aria-label={`${item.toolName} transfer photo`} />
            )}
          </div>
          <div>
            <h2>{item.toolName}</h2>
            {item.asset && <p>{item.asset.asset_tag}</p>}
          </div>
        </div>
        {item.actions.includes('void') && (
          <div className="worker-pending-review-evidence">
            <Callout
              tone="amber"
              eyebrow="Administrator"
              title="Void this transfer"
              description="Cancels the proposal without changing custody. Your reason and identity stay in the history."
            />
          </div>
        )}
        <div className="worker-pending-review-evidence">
          <CustodyEvidenceFields
            context={incoming ? 'review' : item.source === 'handoff' ? 'transfer' : 'request'}
            noteLabel={voidOnly ? 'Reason' : 'Note'}
            noteRequired={voidOnly}
            notePlaceholder={
              incoming ? 'e.g. chuck is loose' : item.source === 'handoff' ? 'e.g. reason for the transfer' : undefined
            }
            showPhoto={false}
          />
        </div>
        {incoming && item.actions.includes('accept') && (
          <button
            type="button"
            className={`worker-pending-verification${decision.inspected ? ' worker-pending-verification--checked' : ''}`}
            role="checkbox"
            aria-checked={decision.inspected}
            onClick={decision.toggleInspected}
          >
            <span aria-hidden="true">{decision.inspected ? '✓' : ''}</span>
            <strong>I have inspected this tool</strong>
          </button>
        )}
        {decision.error && (
          <small className="pending-handoff-error" role="alert">
            {decision.error}
          </small>
        )}
        {decision.conflict && (
          <button
            type="button"
            className="text-button"
            onClick={(event) => void decision.reload(event.currentTarget.form!)}
          >
            Load latest values
          </button>
        )}
      </form>
      <div className="worker-pending-review-footer">
        {item.actions.map((action) => (
          <button
            type="submit"
            form={formId}
            name="action"
            value={action}
            key={action}
            className={
              action === 'accept' ? 'worker-primary-button worker-primary-button--compact' : 'worker-secondary-button'
            }
            disabled={decision.busy || (action === 'accept' && !decision.inspected)}
          >
            {decision.busy ? 'Saving…' : pendingActionLabel[action]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="worker-pending-review-close icon-button"
        aria-label="Close transfer review"
        onClick={onClose}
      >
        ×
      </button>
    </OverlayDialog>
  );
}
