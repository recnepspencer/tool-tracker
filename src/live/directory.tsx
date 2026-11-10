import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from './client';
import { useDirectoryState } from './directory-state';
import { initials } from './format';
import {
  Avatar,
  Button,
  ChevronDownIcon,
  ErrorState,
  LoadingState,
  PageHeading,
  SelectField,
  StatusBadge,
  TextField,
  ToolPhoto,
} from './kit';
import { photoSrc, statusLabel } from './tool-status';

/** Demo `ForemenPage`. */
export function DirectoryPage() {
  const { c, search, setSearch, directory, job, setJob, jobs, needle, visibleTools, status, toolRoute } =
    useDirectoryState();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = { returnTo: location.pathname + location.search };
  return (
    <div className="page-content foremen-page">
      <PageHeading
        title="Foremen"
        action={
          c.can('jobs.assign') ? (
            <Button variant="secondary" onClick={() => navigate('/app/jobs')}>
              Manage assignments
            </Button>
          ) : undefined
        }
      />
      <div className="foremen-filters">
        <TextField
          label="Search foremen, jobs, or tools"
          type="search"
          compact
          value={search}
          onChange={setSearch}
          placeholder="Search names, jobs, or tools"
        />
        <SelectField
          label="Filter by job"
          hideLabel
          compact
          value={job || 'all'}
          onChange={setJob}
          options={[
            { value: 'all', label: 'All jobs' },
            { value: 'none', label: 'No current jobs' },
            ...(jobs.data ?? []).map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
      </div>
      {directory.isPending ? (
        <LoadingState label="Loading foremen…" />
      ) : directory.isError || jobs.isError ? (
        <ErrorState
          message={`Foremen could not be loaded. ${errorMessage(directory.error ?? jobs.error)}`}
          onRetry={() => {
            void directory.refetch();
            void jobs.refetch();
          }}
        />
      ) : null}
      {directory.data?.length === 0 && (
        <p className="jobs-muted">{search || job ? 'No foremen match these filters.' : 'No active foremen yet.'}</p>
      )}
      <div className="foremen-list">
        {directory.data?.map((person) => {
          const tools = visibleTools(person);
          return (
            <details className="foreman-card" key={`${person.membership_id}:${needle}`} open={Boolean(needle)}>
              <summary>
                <Avatar tone="neutral" initials={initials(person.name)} />
                <div className="foreman-copy">
                  <h2>
                    {person.name}
                    {person.membership_id === c.membership_id && <span className="foreman-self"> · You</span>}
                  </h2>
                  <p>{person.jobs.length ? person.jobs.map((item) => item.name).join(' / ') : 'No current jobs'}</p>
                </div>
                <span className="foreman-count">
                  {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
                </span>
                <ChevronDownIcon className="foreman-chevron" />
              </summary>
              <div className="foreman-tools">
                {!tools.length ? (
                  <p className="jobs-muted">No tools in custody.</p>
                ) : (
                  tools.map((tool) => {
                    const tone = status(person, tool);
                    return (
                      <div className="foreman-tool" key={tool.asset_id}>
                        <ToolPhoto
                          src={photoSrc(c.company_id, tool.registration_photo_id)}
                          alt={tool.name}
                          size="small"
                        />
                        <div className="foreman-tool-copy">
                          <strong>
                            <Link to={toolRoute(person, tool)} state={returnTo}>
                              {tool.name}
                            </Link>
                          </strong>
                          <small>
                            {tool.manufacturer} · {tool.model_number}
                            {tool.serial_number ? ` · ${tool.serial_number}` : ''}
                          </small>
                          <div className="foreman-tool-status">
                            <StatusBadge tone={tone}>{statusLabel[tone]}</StatusBadge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
