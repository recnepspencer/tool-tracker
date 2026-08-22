import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { Check, Minus } from 'lucide-react';
import { PERMISSION_CAPABILITIES, type PermissionCapability } from '../../domain/permission-policy';
import { useAdminPermissions } from '../admin/use-admin-permissions';
import './permissions.css';

export function PermissionsPage() {
  const permissions = useAdminPermissions();
  if (permissions.isPending) return <LoadingState label="Loading permissions…" />;
  if (permissions.isError || !permissions.data)
    return (
      <ErrorState message="The permission matrix could not be loaded." onRetry={() => void permissions.refetch()} />
    );
  const structuralRules = permissions.data[0]?.structuralRules ?? [];
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Admin view · Permissions"
        title="Access guide"
        description="See what each role can do in this workspace. Access changes are managed from People."
      />
      <SurfaceCard className="permission-matrix-card">
        <div className="permission-matrix" role="table" aria-label="Role access matrix">
          <div className="permission-matrix__row permission-matrix__header" role="row">
            <span role="columnheader">Capability</span>
            {permissions.data.map((role) => (
              <span role="columnheader" title={role.label} key={role.role}>
                <span className="permission-role-full">{role.label}</span>
                <span className="permission-role-short" aria-hidden="true">
                  {role.role === 'warehouse-manager' ? 'WM' : role.label.slice(0, 1)}
                </span>
              </span>
            ))}
          </div>
          {PERMISSION_CAPABILITIES.map((capability) => (
            <div className="permission-matrix__row" role="row" key={capability}>
              <span role="rowheader">
                <strong>{CAPABILITY_COPY[capability].label}</strong>
                <small>{CAPABILITY_COPY[capability].description}</small>
              </span>
              {permissions.data.map((role) => {
                const granted = role.capabilities.includes(capability);
                return (
                  <span
                    className={granted ? 'permission-cell permission-cell--granted' : 'permission-cell'}
                    role="cell"
                    aria-label={`${role.label}: ${granted ? 'Allowed' : 'Not allowed'}`}
                    key={role.role}
                  >
                    {granted ? <Check aria-hidden="true" /> : <Minus aria-hidden="true" />}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </SurfaceCard>
      <SurfaceCard className="permission-rules-card">
        <div className="permission-rules-heading">
          <div>
            <span className="eyebrow">Structural policy</span>
            <h2>Locked rules</h2>
          </div>
        </div>
        <ul className="permission-rules-list" aria-label="Locked structural rules">
          {structuralRules.map((rule) => (
            <li key={rule.id}>
              <strong>{rule.label}</strong>
              <p>{rule.description}</p>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </div>
  );
}

const CAPABILITY_COPY: Record<PermissionCapability, { label: string; description: string }> = {
  'browse-tools': { label: 'Browse tools', description: 'See inventory and tool details' },
  'request-tools': { label: 'Request tools', description: 'Request available warehouse stock' },
  'manage-warehouse': { label: 'Manage warehouse', description: 'Add stock and resolve tool condition' },
  'review-handoffs': { label: 'Review handoffs', description: 'Release requests and accept returns' },
  'administer-people': { label: 'Administer people', description: 'Invite, suspend, and remove members' },
  'preserve-audit-history': { label: 'Preserve audit history', description: 'Append to the immutable activity record' },
};
