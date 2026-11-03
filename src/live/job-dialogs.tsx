import { Plus } from 'lucide-react';
import { api, errorMessage, type Model } from './client';
import { JobForm } from './job-form';
import { jobStatusLabel, options, projectLifecycleLabel } from './jobs-labels';
import type { JobsState } from './jobs-state';
import { Button, ErrorState, LoadingState, OverlayDialog, SelectField } from './kit';
import { Field, text } from './ui';

/** Live-only projects card, in the demo `settings-card` / `job-row` idiom. */
export function ProjectList({ state }: { state: Pick<JobsState, 'projects' | 'open'> }) {
  const { projects, open } = state;
  const headingId = 'jobs-projects-heading';
  return (
    <section className="surface-card settings-card jobs-manager" aria-labelledby={headingId}>
      <div className="settings-card-heading">
        <h2 id={headingId}>Projects</h2>
        <Button variant="secondary" onClick={() => open('new-project')}>
          <Plus aria-hidden="true" /> Add project
        </Button>
      </div>
      <p className="jobs-muted">Every job belongs to a project. Close a project when its work is done.</p>
      {projects.isPending ? (
        <LoadingState label="Loading projects…" />
      ) : projects.isError ? (
        <ErrorState
          message={`Projects could not be loaded. ${errorMessage(projects.error)}`}
          onRetry={() => void projects.refetch()}
        />
      ) : (
        <div className="jobs-list">
          {!projects.data.length && <p className="jobs-muted">No projects yet. Add one before adding jobs.</p>}
          {projects.data.map((project) => (
            <div className="job-row" key={project.id}>
              <div className="job-row-copy">
                <strong>{project.name}</strong>
                <small>
                  {project.number} · {projectLifecycleLabel[project.lifecycle]}
                </small>
              </div>
              <div className="job-row-actions">
                <Button
                  variant="ghost"
                  aria-label={`Edit project ${project.name}`}
                  onClick={() => open(`edit-project:${project.id}`)}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Demo job `OverlayDialog`s: add/edit job, archive confirm, plus the live project dialogs. */
export function JobDialogs({ state }: { state: Pick<JobsState, 'c' | 'dialog' | 'open' | 'projects' | 'jobs'> }) {
  const { c, dialog, open, projects, jobs } = state;
  if (!c.can('jobs.manage') || !dialog) return null;
  const [action, id] = dialog.split(':');
  const job = jobs.data?.find((item) => item.id === id);
  const project = projects.data?.find((item) => item.id === id);
  const close = () => open('');
  const path = { ...c.path, job_id: id };
  const dialogProps = { onClose: close, showCloseButton: true, panelClassName: 'admin-dialog job-dialog' };
  if (action === 'new-project' || (action === 'edit-project' && project)) {
    const title = project ? 'Edit project' : 'Add project';
    return (
      <OverlayDialog label={title} {...dialogProps}>
        <h2>{title}</h2>
        <JobForm
          label={project ? 'Save' : 'Add project'}
          onDone={close}
          onCancel={close}
          submit={(form) =>
            project
              ? api.POST('/api/companies/{company_id}/projects/{project_id}/update', {
                  params: { path: { ...c.path, project_id: project.id } },
                  body: {
                    expected_revision: project.revision,
                    name: text(form, 'name'),
                    lifecycle: text(form, 'lifecycle') as Model<'ProjectView'>['lifecycle'],
                  },
                })
              : api.POST('/api/companies/{company_id}/projects', {
                  params: { path: c.path },
                  body: {
                    number: text(form, 'number'),
                    name: text(form, 'name'),
                    lifecycle: text(form, 'lifecycle') as Model<'ProjectView'>['lifecycle'],
                  },
                })
          }
        >
          {!project && <Field label="Project number" name="number" required maxLength={50} />}
          <Field
            label="Project name"
            name="name"
            defaultValue={project?.name ?? ''}
            required
            maxLength={200}
            placeholder="e.g. Riverside Medical Center"
          />
          <SelectField
            label="Project status"
            name="lifecycle"
            searchable={false}
            defaultValue={project?.lifecycle ?? 'active'}
            options={options(projectLifecycleLabel)}
          />
        </JobForm>
      </OverlayDialog>
    );
  }
  if (action === 'new-job' || (action === 'edit-job' && job)) {
    const title = job ? 'Edit job' : 'Add job';
    return (
      <OverlayDialog label={title} {...dialogProps}>
        <h2>{title}</h2>
        {projects.isError && (
          <p className="form-error" role="alert">
            Projects could not be loaded. {errorMessage(projects.error)}
          </p>
        )}
        <JobForm
          label={job ? 'Save' : 'Add job'}
          onDone={close}
          onCancel={close}
          submit={(form) =>
            job
              ? api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
                  params: { path },
                  body: {
                    expected_revision: job.revision,
                    name: text(form, 'name'),
                    status: text(form, 'status') as Model<'JobView'>['status'],
                    archived: !!job.archived_at,
                  },
                })
              : api.POST('/api/companies/{company_id}/jobs', {
                  params: { path: c.path },
                  body: {
                    project_id: text(form, 'project'),
                    number: text(form, 'number'),
                    name: text(form, 'name'),
                    status: text(form, 'status') as Model<'JobView'>['status'],
                  },
                })
          }
        >
          {!job && (
            <>
              <SelectField
                label="Project"
                name="project"
                required
                placeholder="Choose a project"
                emptyMessage="No open projects"
                options={(projects.data ?? [])
                  .filter((item) => ['active', 'prospective'].includes(item.lifecycle))
                  .map((item) => ({ value: item.id, label: item.name, description: item.number }))}
              />
              <Field label="Job number" name="number" required maxLength={50} />
            </>
          )}
          <Field
            label="Job name"
            name="name"
            defaultValue={job?.name ?? ''}
            required
            maxLength={200}
            placeholder="e.g. Riverside · Lighting"
          />
          <SelectField
            label="Status"
            name="status"
            searchable={false}
            defaultValue={job?.status ?? 'active'}
            options={options(jobStatusLabel)}
          />
        </JobForm>
      </OverlayDialog>
    );
  }
  if ((action === 'archive' || action === 'restore') && job) {
    const archive = action === 'archive';
    return (
      <OverlayDialog label={archive ? 'Archive job' : 'Restore job'} {...dialogProps}>
        <h2>
          {archive ? 'Archive' : 'Restore'} {job.name}?
        </h2>
        <p className="jobs-muted">
          {archive
            ? 'This closes current assignments and pending requests and removes the job from people’s current jobs. Job history and tool custody are kept.'
            : 'The job returns to the current list. Former assignments stay ended; people must be assigned or join again.'}
        </p>
        <JobForm
          label={archive ? 'Archive job' : 'Restore job'}
          busyLabel={archive ? 'Archiving…' : 'Restoring…'}
          onDone={close}
          onCancel={close}
          submit={() =>
            api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
              params: { path },
              body: { expected_revision: job.revision, name: job.name, status: job.status, archived: archive },
            })
          }
        />
      </OverlayDialog>
    );
  }
  return null;
}
