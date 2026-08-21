import { LoadingState, ErrorState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useAdminPermissions } from '../admin/use-admin-permissions';
import './permissions.css';

export function PermissionsPage() {
  const permissions = useAdminPermissions();
  if (permissions.isPending) return <LoadingState label="Loading permissions…" />;
  if (permissions.isError || !permissions.data)
    return <ErrorState message="The permission matrix could not be loaded." />;
  const structuralRules = permissions.data[0]?.structuralRules ?? [];
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Admin view · Permissions"
        title="Permission matrix"
        description="The role capabilities that guard every command and projection."
        status="Policy"
      />
      <SurfaceCard className="admin-table-card">
        <div className="admin-table-wrap">
          <table className="admin-table permission-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {permissions.data.map((row) => (
                <tr key={row.role}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td>
                    <div className="capability-list">
                      {row.capabilities.map((capability) => (
                        <span key={capability} className="capability-pill">
                          {capability.replaceAll('-', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
      <SurfaceCard className="permission-rules-card">
        <div className="permission-rules-heading">
          <div>
            <span className="eyebrow">Structural policy</span>
            <h2>Locked rules</h2>
          </div>
          <span className="permission-lock" aria-label="Structural rules are locked">
            Locked
          </span>
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
