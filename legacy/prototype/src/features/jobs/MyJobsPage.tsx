import { useState } from 'react';
import { PageHeading } from '../../components/layout/PageHeading';
import { TextField } from '../../components/ui/TextField';
import { Switch } from '../../components/ui/Switch';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { useJobs, useJobMutation } from './use-jobs';
import './jobs.css';

export function MyJobsPage() {
  const query = useJobs();
  const mutation = useJobMutation();
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState('');
  if (query.isPending) return <LoadingState label="Loading your jobs…" />;
  if (query.isError)
    return <ErrorState message="Your jobs could not be loaded." onRetry={() => void query.refetch()} />;
  const jobs = query.data.filter(
    (job) => !job.archivedAt && job.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="page-content jobs-page">
      <PageHeading
        title="My jobs"
        description="Choose all the jobs you’re working on. Your tools stay with you when your jobs change."
      />
      <TextField
        label="Search jobs"
        type="search"
        compact
        value={search}
        onChange={setSearch}
        placeholder="Search jobs"
      />
      {mutation.error && (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      <span className="sr-only" role="status">
        {saved}
      </span>
      {!query.data.length ? (
        <p className="jobs-muted">No active jobs yet. An administrator can add them in Settings.</p>
      ) : !jobs.length ? (
        <p className="jobs-muted">No jobs match your search.</p>
      ) : (
        <SurfaceCard className="job-selection">
          {jobs.map((job) => (
            <Switch
              key={job.id}
              label={job.name}
              description={job.joined ? 'On this job' : 'Not on this job'}
              checked={job.joined}
              disabled={mutation.isPending || query.isFetching || query.isPaused}
              onCheckedChange={(joined) => {
                setSaved('');
                mutation.mutate(
                  { action: 'membership', jobId: job.id, expectedRevision: job.revision, joined },
                  { onSuccess: () => setSaved(`${joined ? 'Joined' : 'Left'} ${job.name}`) },
                );
              }}
            />
          ))}
        </SurfaceCard>
      )}
    </div>
  );
}
