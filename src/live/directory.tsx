import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage } from './client';
import { AssetPhoto } from './field';
import { useDirectoryPageState } from './settings-state';
import { Badge, Empty, Field, Loading, Notice } from './ui';

export function DirectoryPage() {
  const { c, search, setSearch, directory, job, setJob, jobs } = useDirectoryPageState();
  return (
    <div className="foremen-page">
      <header className="page-heading">
        <div>
          <h1>Foremen</h1>
          <p>See who has each tool and which jobs they’re working on.</p>
        </div>
        {c.can('jobs.assign') && (
          <Link className="button" to="/app/jobs">
            Manage assignments
          </Link>
        )}
      </header>
      <div className="foremen-filters">
        <Field
          label="Search foremen, jobs, or tools"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="field">
          <label htmlFor="directory-job">Filter by job</label>
          <select id="directory-job" value={job} onChange={(event) => setJob(event.target.value)}>
            <option value="">All jobs</option>
            <option value="none">No current jobs</option>
            {jobs.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {(directory.isPending || jobs.isPending) && <Loading />}
      {(directory.error || jobs.error) && <Notice error>{errorMessage(directory.error || jobs.error)}</Notice>}
      {directory.data?.length === 0 && <Empty>No people match these filters.</Empty>}
      <div className="foremen-list">
        {directory.data?.map((person) => (
          <details className="foreman-card" key={`${person.membership_id}:${search}`} open={search ? true : undefined}>
            <summary>
              <span className="session-avatar">{person.name.slice(0, 1)}</span>
              <div className="foreman-copy">
                <h2>
                  {person.name}
                  {person.membership_id === c.membership_id && <span className="foreman-self"> · You</span>}
                </h2>
                <p>{person.jobs.map((item) => item.name).join(' / ') || 'No current jobs'}</p>
              </div>
              <span className="foreman-count">
                {person.tools.length} {person.tools.length === 1 ? 'tool' : 'tools'}
              </span>
              <ChevronDown className="foreman-chevron" aria-hidden="true" />
            </summary>
            <div className="foreman-tools">
              {person.tools.length === 0 && <Empty>No tools in custody.</Empty>}
              {person.tools.map((tool) => (
                <div className="foreman-tool" key={tool.asset_id}>
                  <AssetPhoto asset={tool} companyId={c.company_id} />
                  <div className="foreman-tool-copy">
                    <Link to={`/app/tools/${tool.asset_id}`}>{tool.name}</Link>
                    <small>
                      {tool.asset_tag} · {tool.manufacturer} · {tool.model_number}
                      {tool.serial_number ? ` · ${tool.serial_number}` : ''}
                    </small>
                    <Badge>{tool.missing ? 'Missing' : tool.serviceability}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
