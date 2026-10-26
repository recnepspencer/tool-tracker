import { api, errorMessage, type Model } from './client';
import { RecordSheet } from './experience/RecordSheet';
import type { JobsState } from './jobs-state';
import { Badge, Empty, Field, Form, human, Loading, Notice, Section, Select, text } from './ui';

export function ProjectList({ state }: { state: Pick<JobsState, 'projects' | 'open'> }) {
  const { projects, open } = state;
  return (
    <Section title="Projects">
      {projects.isPending && <Loading />}
      {projects.error && <Notice error>{errorMessage(projects.error)}</Notice>}
      {projects.data?.map((project) => (
        <div className="job-row" key={project.id}>
          <div className="job-row-copy">
            <strong>
              {project.number} · {project.name}
            </strong>
            <Badge>{human(project.lifecycle)}</Badge>
          </div>
          <button aria-label={`Edit project ${project.name}`} onClick={() => open(`edit-project:${project.id}`)}>
            Edit project
          </button>
        </div>
      ))}
      {projects.data?.length === 0 && <Empty>No projects yet.</Empty>}
    </Section>
  );
}

export function JobDialogs({ state }: { state: Pick<JobsState, 'c' | 'dialog' | 'open' | 'projects' | 'jobs'> }) {
  const { c, dialog, open, projects, jobs } = state;
  if (!c.can('jobs.manage') || !dialog) return null;
  const [action, id] = dialog.split(':');
  const job = jobs.data?.find((item) => item.id === id);
  const project = projects.data?.find((item) => item.id === id);
  const close = () => open('');
  const path = { ...c.path, job_id: id };
  if (action === 'new-project' || (action === 'edit-project' && project))
    return (
      <RecordSheet title={project ? 'Edit project' : 'Add project'} onClose={close}>
        <h1>{project ? 'Edit project' : 'Add project'}</h1>
        <Form
          label={project ? 'Save project' : 'Create project'}
          onDone={close}
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
          <Field label="Project name" name="name" defaultValue={project?.name ?? ''} required maxLength={200} />
          <Select label="Project status" name="lifecycle" defaultValue={project?.lifecycle ?? 'active'}>
            {['prospective', 'active', 'closed', 'cancelled'].map((status) => (
              <option key={status} value={status}>
                {human(status)}
              </option>
            ))}
          </Select>
        </Form>
      </RecordSheet>
    );
  if (action === 'new-job' || (action === 'edit-job' && job))
    return (
      <RecordSheet title={job ? 'Edit job' : 'Add job'} onClose={close}>
        <h1>{job ? 'Edit job' : 'Add job'}</h1>
        {projects.error && <Notice error>{errorMessage(projects.error)}</Notice>}
        <Form
          label={job ? 'Save job' : 'Create job'}
          onDone={close}
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
              <Select label="Project" name="project">
                <option value="">Choose a project</option>
                {projects.data
                  ?.filter((item) => ['active', 'prospective'].includes(item.lifecycle))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.number} · {item.name}
                    </option>
                  ))}
              </Select>
              <Field label="Job number" name="number" required maxLength={50} />
            </>
          )}
          <Field label="Job name" name="name" defaultValue={job?.name ?? ''} required maxLength={200} />
          <Select label="Status" name="status" defaultValue={job?.status ?? 'active'}>
            {['planned', 'active', 'on_hold', 'completed', 'cancelled'].map((status) => (
              <option key={status} value={status}>
                {human(status)}
              </option>
            ))}
          </Select>
        </Form>
      </RecordSheet>
    );
  if ((action === 'archive' || action === 'restore') && job)
    return (
      <RecordSheet title={action === 'archive' ? 'Archive job' : 'Restore job'} onClose={close}>
        <h1>
          {action === 'archive' ? 'Archive' : 'Restore'} {job.name}?
        </h1>
        <p>
          {action === 'archive'
            ? 'Current assignments will end and pending requests will close. History and tool custody are preserved.'
            : 'The job will return to the current list. Former assignments will stay ended; people must be assigned or join again.'}
        </p>
        <Form
          label={action === 'archive' ? 'Archive job' : 'Restore job'}
          onDone={close}
          submit={() =>
            api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
              params: { path },
              body: {
                expected_revision: job.revision,
                name: job.name,
                status: job.status,
                archived: action === 'archive',
              },
            })
          }
        >
          <></>
        </Form>
      </RecordSheet>
    );
  return null;
}
