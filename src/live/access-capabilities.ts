import { sentence } from './format';

/** Frontend copy for the live capability strings, in access-guide order. */
export const CAPABILITY_COPY: Record<string, { label: string; description: string }> = {
  'company.read': { label: 'View company', description: 'See the company profile and workspace' },
  'tools.read': { label: 'Browse tools', description: 'See inventory and tool details' },
  'tools.request': { label: 'Request tools', description: 'Request available warehouse stock' },
  'tools.transfer': { label: 'Hand off tools', description: 'Give and receive tools in custody handoffs' },
  'tools.report': { label: 'Report problems', description: 'Flag damaged or missing tools' },
  'tools.register': { label: 'Register tools', description: 'Add tools when employee uploads are allowed' },
  'files.upload': { label: 'Upload photos', description: 'Attach photos as custody evidence' },
  'tools.manage': { label: 'Manage tools', description: 'Edit tool records, service, and retirement' },
  'tools.manage_registration_policy': {
    label: 'Set upload rules',
    description: 'Choose whether employees can register tools',
  },
  'catalog.manage': { label: 'Manage catalog', description: 'Edit tool models and categories' },
  'warehouses.manage': { label: 'Manage warehouses', description: 'Add, edit, and archive warehouses' },
  'reconciliation.manage': {
    label: 'Resolve reconciliation',
    description: 'Close missing and disputed custody cases',
  },
  'activity.read': { label: 'View activity', description: 'Read the company activity log' },
  'jobs.read': { label: 'View jobs', description: 'See jobs and who is assigned' },
  'jobs.participate': { label: 'Join jobs', description: 'Join or leave jobs under the job rules' },
  'jobs.assign': { label: 'Assign people', description: 'Assign people to jobs' },
  'jobs.manage': { label: 'Manage jobs', description: 'Create, edit, and archive jobs and projects' },
  'jobs.manage_policy': { label: 'Set job rules', description: 'Choose how employees join and leave jobs' },
  'people.manage': { label: 'Administer people', description: 'Invite, suspend, and remove members' },
  'company.manage': { label: 'Manage company', description: 'Edit company details' },
};

/** Known capabilities first, then anything new the API reports. */
export function capabilityRows(granted: readonly string[]) {
  const known = Object.keys(CAPABILITY_COPY);
  const extra = [...new Set(granted)].filter((capability) => !known.includes(capability)).sort();
  return [...known, ...extra].map((capability) => ({
    capability,
    ...(CAPABILITY_COPY[capability] ?? { label: sentence(capability), description: '' }),
  }));
}

/** Rules the live backend enforces regardless of role. */
export const LOCKED_RULES = [
  {
    id: 'last-admin',
    label: 'One active administrator',
    description: 'The last active company admin cannot be suspended, removed, or lose the role.',
  },
  {
    id: 'warehouse-authority',
    label: 'Warehouse authority',
    description:
      'Equipment managers manage every warehouse. A scoped grant lets a member who hands off tools manage one warehouse.',
  },
  {
    id: 'offboarding',
    label: 'Custody survives offboarding',
    description: 'Ending employment closes current job assignments; tools stay accountable to the person.',
  },
  {
    id: 'reasons',
    label: 'Recorded reasons',
    description: 'Every access change needs a reason, which is kept in the activity record.',
  },
];
