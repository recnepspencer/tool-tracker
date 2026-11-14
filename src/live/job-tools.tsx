import { Link, useLocation } from 'react-router-dom';
import { errorMessage, type Model } from './client';
import type { JobsState } from './jobs-state';
import { ErrorState, LoadingState, StatusBadge, ToolPhoto } from './kit';
import { photoSrc, statusLabel, toolStatus } from './tool-status';

type Person = Model<'DirectoryPerson'>;
type Tool = Model<'DirectoryTool'>;

const tone = (person: Person, tool: Tool) =>
  toolStatus({
    lifecycle: 'active',
    missing: tool.missing,
    serviceability: tool.serviceability as Model<'AssetView'>['serviceability'],
    holder_membership_id: person.membership_id,
  });

/** The tools out on a job: whatever the people on it are holding right now. */
export function JobTools({ state }: { state: Pick<JobsState, 'c' | 'tools'> }) {
  const { c, tools } = state;
  const location = useLocation();
  if (tools.isPending) return <LoadingState label="Loading tools…" />;
  if (tools.isError)
    return (
      <ErrorState
        message={`Tools on this job could not be loaded. ${errorMessage(tools.error)}`}
        onRetry={() => void tools.refetch()}
      />
    );
  const rows = tools.data.flatMap((person) => person.tools.map((tool) => ({ person, tool })));
  if (!rows.length) return <p className="jobs-muted">No one on this job is holding a tool.</p>;
  return (
    <ul className="job-list" aria-label="Tools on this job">
      {rows.map(({ person, tool }) => {
        const status = tone(person, tool);
        return (
          <li className="job-list__row" key={tool.asset_id}>
            <ToolPhoto src={photoSrc(c.company_id, tool.registration_photo_id)} alt={tool.name} size="small" />
            <span className="job-list__copy">
              <Link to={`/app/tools/${tool.asset_id}`} state={{ returnTo: location.pathname + location.search }}>
                {tool.name}
              </Link>
              <span>With {person.name}</span>
            </span>
            {status !== 'checked-out' ? <StatusBadge tone={status}>{statusLabel[status]}</StatusBadge> : null}
          </li>
        );
      })}
    </ul>
  );
}
