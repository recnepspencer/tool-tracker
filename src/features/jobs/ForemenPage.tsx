import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PageHeading } from '../../components/layout/PageHeading';
import { Avatar } from '../../components/ui/Avatar';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { useSession } from '../../app/session-context';
import { useForemen, useJobs } from './use-jobs';
import './jobs.css';

export function ForemenPage() {
  const query = useForemen();
  const jobs = useJobs();
  const { session } = useSession();
  const [search, setSearch] = useState('');
  const [jobId, setJobId] = useState('all');
  if (query.isPending || jobs.isPending) return <LoadingState label="Loading foremen…" />;
  if (query.isError || jobs.isError)
    return (
      <ErrorState
        message="Foremen could not be loaded."
        onRetry={() => {
          void query.refetch();
          void jobs.refetch();
        }}
      />
    );
  const needle = search.trim().toLowerCase();
  const foremen = query.data.filter(
    (foreman) =>
      (jobId === 'all' || (jobId === 'none' ? !foreman.jobs.length : foreman.jobs.some((job) => job.id === jobId))) &&
      [
        foreman.name,
        ...foreman.jobs.map((job) => job.name),
        ...foreman.tools.flatMap((tool) => [tool.name, tool.id, tool.brand, tool.model, tool.serial ?? '']),
      ].some((value) => value.toLowerCase().includes(needle)),
  );
  return (
    <div className="page-content foremen-page">
      <PageHeading title="Foremen" description="See who has each tool and which jobs they’re working on." />
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
          compact
          value={jobId}
          onChange={setJobId}
          options={[
            { value: 'all', label: 'All jobs' },
            { value: 'none', label: 'No current jobs' },
            ...jobs.data.filter((job) => !job.archivedAt).map((job) => ({ value: job.id, label: job.name })),
          ]}
        />
      </div>
      {!foremen.length && (
        <p className="jobs-muted">{query.data.length ? 'No foremen match these filters.' : 'No active foremen yet.'}</p>
      )}
      <div className="foremen-list">
        {foremen.map((foreman) => (
          <details className="foreman-card" key={`${foreman.id}:${needle}`} open={Boolean(needle)}>
            <summary>
              <Avatar
                tone="neutral"
                initials={foreman.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')}
              />
              <div className="foreman-copy">
                <h2>
                  {foreman.name}
                  {foreman.id === session?.profileId && <span className="foreman-self"> · You</span>}
                </h2>
                <p>{foreman.jobs.length ? foreman.jobs.map((job) => job.name).join(' / ') : 'No current jobs'}</p>
              </div>
              <span className="foreman-count">
                {foreman.tools.length} {foreman.tools.length === 1 ? 'tool' : 'tools'}
              </span>
              <ChevronDown className="foreman-chevron" aria-hidden="true" />
            </summary>
            <div className="foreman-tools">
              {!foreman.tools.length ? (
                <p className="jobs-muted">No tools in custody.</p>
              ) : (
                foreman.tools.map((tool) => (
                  <div className="foreman-tool" key={tool.id}>
                    <ToolPhoto src={tool.imageSrc} alt={tool.name} size="small" />
                    <div className="foreman-tool-copy">
                      <strong>{tool.name}</strong>
                      <small>
                        {tool.brand} · {tool.model} · {tool.id}
                        {tool.serial ? ` · ${tool.serial}` : ''}
                      </small>
                      <div className="foreman-tool-status">
                        <StatusBadge status={tool.status} />
                        {tool.transferTo && <span>In transfer to {tool.transferTo}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
