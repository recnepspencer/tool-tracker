import type { ToolView } from '../../domain/read-models/tools';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export function ToolCard({ tool, onSelect }: { tool: ToolView; onSelect(toolUnitId: string): void }) {
  const holder = tool.holder.name;
  return (
    <SurfaceCard className="tool-card">
      <button
        type="button"
        className="tool-card-button"
        onClick={() => onSelect(tool.id)}
        aria-label={`Open details for ${tool.name} unit ${tool.id}`}
        data-tool-unit-id={tool.id}
      >
        <ToolPhoto src={tool.imageSrc} alt={`${tool.name} product photo`} size="card" />
        <span className="tool-card-body">
          <span className="tool-card-title">
            <strong>{tool.name}</strong>
            <StatusBadge status={tool.status} />
          </span>
          <span className="tool-card-subtitle">
            {tool.brand} · {tool.model}
          </span>
          <span className="tool-card-meta">
            <span>{tool.category}</span>
            <span>{holder}</span>
          </span>
          <span className="tool-card-time">{tool.lastMoved}</span>
        </span>
      </button>
    </SurfaceCard>
  );
}
