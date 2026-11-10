import { HandoffReviewDialog } from './handoff-review';
import { ErrorState, LoadingState, PageHeading, SearchField } from './kit';
import { useOperationsPageState, useQueueDecision } from './operations-state';
import type { QueueAction, QueueEntry } from './queue-groups';
import { AskRow, HistoryRow, LinkRow, QueueSection } from './queue-list';
import { RequestReviewDialog } from './queue-review';
import { photoSrc } from './tool-status';
import './experience/queue.css';

export { ReconciliationsPage } from './reconciliation-page';

/**
 * The queue: everything waiting on the viewer, in sections, then what waits on someone else,
 * then recent decisions behind one toggle.
 */
export function OperationsPage() {
  const queue = useOperationsPageState();
  const quick = useQueueDecision();
  if (!queue.loaded && !queue.error) return <LoadingState label="Loading queue…" />;
  if (!queue.loaded) return <ErrorState message="The queue could not be loaded." onRetry={queue.retry} />;
  const photo = (assetId: string) => photoSrc(queue.c.company_id, queue.photo(assetId));
  const act = (entry: QueueEntry, action: QueueAction) => {
    if (action === 'approve' || action === 'reject' || action === 'withdraw') {
      if (entry.request) void quick.decideRequest(entry.request, action);
    } else if (entry.handoff) void quick.decideHandoff(entry.handoff, action);
  };
  const ask = (entry: QueueEntry) => (
    <AskRow
      key={entry.key}
      entry={entry}
      photo={photo(entry.assetId)}
      busy={quick.busy}
      onReview={(item) => queue.openReview(item.key)}
      onAction={act}
    />
  );
  return (
    <div className="page-content queue-page">
      <PageHeading title="Queue" />
      {queue.searchable && (
        <SearchField label="Search queue" placeholder="Search" value={queue.search} onChange={queue.setSearch} />
      )}
      {queue.error && <ErrorState message="The queue could not be refreshed." onRetry={queue.retry} />}
      {!queue.review && quick.error && (
        <p className="form-error" role="alert">
          {quick.error}
        </p>
      )}
      {queue.nothingNeedsYou ? (
        <div className="queue-empty" role="status">
          <strong>Nothing needs you</strong>
        </div>
      ) : (
        <>
          {queue.needsYou.length > 0 && (
            <QueueSection title="Needs you" count={queue.needsYou.length}>
              {queue.needsYou.map(ask)}
            </QueueSection>
          )}
          {queue.flagged.length > 0 && (
            <QueueSection title="Damaged & lost" count={queue.flagged.length}>
              {queue.flagged.map((entry) => (
                <LinkRow
                  key={entry.assetId}
                  to={entry.to}
                  state={{ returnTo: queue.returnTo }}
                  label={`Open ${entry.toolName}`}
                  title={entry.title}
                  note={entry.note}
                  at={entry.at}
                  photo={photo(entry.assetId)}
                />
              ))}
            </QueueSection>
          )}
          {queue.records.length > 0 && (
            <QueueSection title="Records to fix" count={queue.records.length}>
              {queue.records.map((entry) => (
                <LinkRow
                  key={entry.id}
                  to={entry.to}
                  label={`Fix the record for ${entry.toolName}`}
                  title={entry.title}
                  note={entry.note}
                  at={entry.at}
                  photo={photo(entry.assetId)}
                />
              ))}
            </QueueSection>
          )}
        </>
      )}
      {queue.waiting.length > 0 && (
        <QueueSection title="Waiting on others" count={queue.waiting.length} quiet>
          {queue.waiting.map(ask)}
        </QueueSection>
      )}
      <button
        type="button"
        className="queue-history-toggle"
        aria-expanded={queue.history}
        onClick={() => queue.setHistory(!queue.history)}
      >
        {queue.history ? 'Hide history' : 'Show history'}
      </button>
      {queue.history &&
        (queue.historyLoading ? (
          <LoadingState label="Loading history…" />
        ) : queue.historyError ? (
          <ErrorState message="History could not be loaded." />
        ) : queue.historyEntries.length ? (
          <QueueSection title="History" quiet>
            {queue.historyEntries.map((entry) => (
              <HistoryRow key={entry.key} entry={entry} photo={photo(entry.assetId)} />
            ))}
          </QueueSection>
        ) : (
          <p className="queue-history-empty">No decisions yet.</p>
        ))}
      {queue.reviewRequest && (
        <RequestReviewDialog
          key={queue.review}
          request={queue.reviewRequest}
          entry={queue.reviewEntry}
          toolName={queue.reviewTool}
          onClose={() => queue.openReview('')}
        />
      )}
      {queue.reviewHandoff && (
        <HandoffReviewDialog
          key={queue.review}
          handoff={queue.reviewHandoff}
          asset={queue.asset(queue.reviewHandoff.asset_id)}
          entry={queue.reviewEntry}
          pickupRequest={queue.reviewPickupRequest}
          toolName={queue.reviewTool}
          onClose={() => queue.openReview('')}
        />
      )}
    </div>
  );
}
