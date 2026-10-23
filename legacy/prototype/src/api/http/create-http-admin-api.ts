import type { AdminApi } from '../contracts/admin-api';
import { ADMIN_MUTATION_OPERATIONS } from '../../domain/admin-mutation';
import type { HttpApiOptions } from './http-options';
import type {
  AdminPeopleResponseDto,
  AuditLogResponseDto,
  EventDto,
  AdminPersonDetailResponseDto,
  AdminWarehousesResponseDto,
  MutationReceiptDto,
  PermissionDto,
  SummaryDto,
} from './http-admin-types';
import {
  mapAdminPeopleResponse,
  mapAdminPersonDetailResponse,
  mapAdminWarehousesResponse,
  mapPermissionMatrix,
  mapSummary,
} from './http-admin-mappers';
import { mapMutationReceipt } from './http-admin-command-mappers';
import { pathWithBase, responseArray } from './http-transport';
import { mapEvent } from './http-admin-event-mappers';
import { assertUniqueIds } from './http-transport';
import { compareActivityTimestamps } from '../../domain/activity';
import { isValidEmailAddress, normalizeEmailAddress } from '../../domain/email-address';

const withActor = (path: string, actorId?: string) =>
  actorId ? path + '?actor_id=' + encodeURIComponent(actorId) : path;

export const createHttpAdminApi = ({ transport, basePath = '/api' }: HttpApiOptions): AdminApi => ({
  getSummary: async ({ actorId }) =>
    mapSummary(await transport.get<SummaryDto>(pathWithBase(basePath, withActor('/admin/summary', actorId)))),
  listPeople: async ({ actorId }) =>
    mapAdminPeopleResponse(
      await transport.get<AdminPeopleResponseDto>(pathWithBase(basePath, withActor('/admin/people', actorId))),
    ),
  getPerson: async ({ actorId, personId }) =>
    mapAdminPersonDetailResponse(
      await transport.get<AdminPersonDetailResponseDto>(
        pathWithBase(basePath, withActor('/admin/people/' + encodeURIComponent(personId), actorId)),
      ),
      personId,
    ),
  getPermissionMatrix: async ({ actorId }) => {
    return mapPermissionMatrix(
      responseArray<PermissionDto>(
        await transport.get(pathWithBase(basePath, withActor('/admin/permissions', actorId))),
        'admin permissions',
      ),
    );
  },
  listWarehouses: async ({ actorId }) =>
    mapAdminWarehousesResponse(
      await transport.get<AdminWarehousesResponseDto>(pathWithBase(basePath, withActor('/admin/warehouses', actorId))),
    ),
  listAuditLog: async ({ actorId }) => {
    const payload = await transport.get<AuditLogResponseDto | EventDto[]>(
      pathWithBase(basePath, withActor('/admin/activity', actorId)),
    );
    const events = Array.isArray(payload) ? payload : payload.events;
    return assertUniqueIds(
      responseArray<EventDto>(events, 'admin audit')
        .map((event) => mapEvent(event))
        .sort(
          (left, right) =>
            compareActivityTimestamps(left.timestamp, right.timestamp) || left.id.localeCompare(right.id),
        ),
      'admin audit',
    );
  },
  invitePerson: async ({ actorId, name, email, title, role, homeWarehouseId }) => {
    const normalizedEmail = normalizeEmailAddress(email);
    if (!isValidEmailAddress(normalizedEmail)) throw new Error('Enter a valid email address');
    return mapMutationReceipt(
      await transport.post<MutationReceiptDto>(pathWithBase(basePath, '/admin/people/invite'), {
        actor_id: actorId,
        display_name: name,
        email_address: normalizedEmail,
        job_title: title,
        role,
        home_warehouse_id: homeWarehouseId,
      }),
      { operation: ADMIN_MUTATION_OPERATIONS.invitePerson },
    );
  },
  updatePersonRole: async ({ actorId, personId, role }) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/people/' + encodeURIComponent(personId) + '/role'),
        {
          actor_id: actorId,
          role,
        },
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.updatePersonRole, personId },
    ),
  setPersonAccess: async ({ actorId, personId, access }) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/people/' + encodeURIComponent(personId) + '/access'),
        {
          actor_id: actorId,
          access,
        },
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.setPersonAccess, personId },
    ),
  removePerson: async ({ actorId, personId, reason, note }) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/people/' + encodeURIComponent(personId) + '/remove'),
        {
          actor_id: actorId,
          reason,
          ...(note ? { note } : {}),
        },
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.removePerson, personId },
    ),
  createWarehouse: async ({ actorId, name, address, managerId }) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(pathWithBase(basePath, '/admin/warehouses'), {
        actor_id: actorId,
        name,
        address,
        manager_id: managerId,
      }),
      { operation: ADMIN_MUTATION_OPERATIONS.createWarehouse },
    ),
  updateWarehouse: async ({ actorId, warehouseId, name, address, managerId }) =>
    mapMutationReceipt(
      await transport.post<MutationReceiptDto>(
        pathWithBase(basePath, '/admin/warehouses/' + encodeURIComponent(warehouseId)),
        {
          actor_id: actorId,
          name,
          address,
          manager_id: managerId,
        },
      ),
      { operation: ADMIN_MUTATION_OPERATIONS.updateWarehouse, warehouseId },
    ),
});
