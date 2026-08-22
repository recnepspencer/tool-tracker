import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { MEMBER_LIFECYCLE_LABELS, MEMBER_ROLE_LABELS } from '../../domain/people';
import type { AdminPersonView } from '../../domain/read-models/admin';
import { adminPersonPath } from './admin-person-path';

export function PeopleTable({ people, onOpen }: { people: AdminPersonView[]; onOpen(personId: string): void }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-table--responsive people-table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Role</th>
            <th>Access</th>
            <th>Home warehouse</th>
            <th>Custody</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <td data-label="Person">
                <Link className="admin-person-link" to={adminPersonPath(person.id)}>
                  {person.name}
                </Link>
                <span>{person.email}</span>
                <span className="people-table__mobile-meta">
                  {MEMBER_ROLE_LABELS[person.role]} · {person.homeWarehouse} · {person.heldToolCount} held
                </span>
              </td>
              <td data-label="Role">{MEMBER_ROLE_LABELS[person.role]}</td>
              <td data-label="Access">
                <span className={'lifecycle-pill lifecycle-pill--' + person.lifecycle}>
                  {MEMBER_LIFECYCLE_LABELS[person.lifecycle]}
                </span>
              </td>
              <td data-label="Home warehouse">{person.homeWarehouse}</td>
              <td data-label="Custody">
                {person.heldToolCount || person.pendingHandoffCount
                  ? `${person.heldToolCount} held · ${person.pendingHandoffCount} pending`
                  : 'None'}
              </td>
              <td data-label="Actions">
                <Button variant="ghost" onClick={() => onOpen(person.id)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
