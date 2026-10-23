import type { AdminHeldToolView } from '../../domain/read-models/admin';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export function LongHeldTools({ tools }: { tools: AdminHeldToolView[] }) {
  return (
    <SurfaceCard className="long-held-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">Long-held tools</span>
          <h2>Needs a check-in</h2>
        </div>
        <span className="section-count">{tools.length} open</span>
      </div>
      {tools.length ? (
        <div className="long-held-list">
          {tools.map((tool) => (
            <div className="long-held-row" key={tool.toolUnitId}>
              <div>
                <strong>{tool.toolName}</strong>
                <span>
                  {tool.toolUnitId} · {tool.warehouseName}
                </span>
              </div>
              <time>{tool.holderSince}</time>
            </div>
          ))}
        </div>
      ) : (
        <p className="admin-empty">No worker-held tools are past the seven-day review window.</p>
      )}
    </SurfaceCard>
  );
}
