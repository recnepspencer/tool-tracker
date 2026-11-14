import { useQuery } from '@tanstack/react-query';
import { api, result, type Model } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { toolStatus } from './tool-status';

/** Same rule the shell uses to pick the control room over the worker shell. */
const usesControlShell = (c: ReturnType<typeof useCompany>) =>
  c.can('tools.manage') || c.can('people.manage') || c.can('jobs.manage') || c.managed_warehouse_ids.length > 0;

type Person = Model<'DirectoryPerson'>;
type Tool = Model<'DirectoryTool'>;

export function useDirectoryState() {
  const c = useCompany();
  const control = usesControlShell(c);
  const { params, update } = useListLocation();
  const search = params.get('search') ?? '';
  const job = params.get('job') ?? '';
  const jobs = useQuery({
    queryKey: [c.company_id, 'jobs', false],
    queryFn: () =>
      collect((offset) =>
        api.GET('/api/companies/{company_id}/jobs', { params: { path: c.path, query: { offset } } }).then(result),
      ),
  });
  const directory = useQuery({
    queryKey: [c.company_id, 'directory', search, job],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/directory', {
            params: {
              path: c.path,
              query: { offset, search, ...(job === 'none' ? { unassigned: true } : job ? { job_id: job } : {}) },
            },
          })
          .then(result),
      ),
  });

  // The demo search also narrows the tools inside each card: a person or job
  // match keeps every tool, otherwise only the matching tools stay visible.
  const needle = search.trim().toLowerCase();
  const matches = (values: Array<string | null>) => values.some((value) => value?.toLowerCase().includes(needle));
  const toolMatches = (tool: Tool) => matches([tool.name, tool.manufacturer, tool.model_number, tool.serial_number]);
  const visibleTools = (person: Person) =>
    !needle || matches([person.name, ...person.jobs.map((item) => item.name)])
      ? person.tools
      : person.tools.filter(toolMatches);

  return {
    c,
    search,
    job,
    jobs,
    directory,
    needle,
    visibleTools,
    setSearch: (value: string) => update('search', value),
    setJob: (value: string) => update('job', value === 'all' ? '' : value),
    status: (person: Person, tool: Tool) =>
      toolStatus({
        lifecycle: 'active',
        missing: tool.missing,
        serviceability: tool.serviceability as Model<'AssetView'>['serviceability'],
        holder_membership_id: person.membership_id,
      }),
    /** Control-room users open the inventory sheet; field users open the worker tool sheet. */
    toolRoute: (person: Person, tool: Tool) =>
      control
        ? `/app/tools/${tool.asset_id}`
        : `/app/${person.membership_id === c.membership_id ? 'mine' : 'checkout'}/${tool.asset_id}`,
  };
}
