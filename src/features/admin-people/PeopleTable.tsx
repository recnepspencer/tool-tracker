import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { MEMBER_LIFECYCLE_LABELS, MEMBER_ROLE_LABELS } from '../../domain/people';
import type { AdminPersonView } from '../../domain/read-models/admin';
import { adminPersonPath } from './admin-person-path';

export function PeopleTable({ people, onOpen }: { people: AdminPersonView[]; onOpen(personId: string): void }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
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
              <td>
                <Link className="admin-person-link" to={adminPersonPath(person.id)}>
                  {person.name}
                </Link>
                <span>
                  {person.email} · {person.title}
                </span>
              </td>
              <td>{MEMBER_ROLE_LABELS[person.role]}</td>
              <td>
                <span className={'lifecycle-pill lifecycle-pill--' + person.lifecycle}>
                  {MEMBER_LIFECYCLE_LABELS[person.lifecycle]}
                </span>
              </td>
              <td>{person.homeWarehouse}</td>
              <td>
                {person.heldToolCount} held · {person.pendingHandoffCount} pending
              </td>
              <td>
                <Button variant="ghost" onClick={() => onOpen(person.id)}>
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
