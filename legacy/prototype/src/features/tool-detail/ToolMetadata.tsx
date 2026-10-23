import type { ToolDetailView } from '../../domain/read-models/tools';

export function ToolMetadata({ detail }: { detail: ToolDetailView }) {
  return (
    <dl className="detail-facts">
      <div>
        <dt>Unit</dt>
        <dd>{detail.tool.id}</dd>
      </div>
      <div>
        <dt>Category</dt>
        <dd>{detail.tool.category}</dd>
      </div>
      <div>
        <dt>Custody</dt>
        <dd>{detail.tool.holder.name}</dd>
      </div>
      <div>
        <dt>Origin warehouse</dt>
        <dd>{detail.originWarehouse.name}</dd>
      </div>
      <div>
        <dt>Serial</dt>
        <dd>{detail.tool.serial ?? 'Not recorded'}</dd>
      </div>
      <div>
        <dt>Condition</dt>
        <dd>{detail.condition[0].toUpperCase() + detail.condition.slice(1)}</dd>
      </div>
      <div>
        <dt>Lifecycle</dt>
        <dd>{detail.lifecycle[0].toUpperCase() + detail.lifecycle.slice(1)}</dd>
      </div>
      <div>
        <dt>Last moved</dt>
        <dd>{detail.tool.lastMoved}</dd>
      </div>
    </dl>
  );
}
