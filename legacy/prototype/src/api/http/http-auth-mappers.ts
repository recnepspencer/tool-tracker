import { ROLES, type AuthSession } from '../../domain/auth';
import type { DemoProfileView } from '../../domain/read-models/auth';
import type { ProfileDto, SessionDto } from './http-auth-types';
import { nonBlankStringValue, oneOf } from './http-validation';

export const mapProfile = (dto: ProfileDto): DemoProfileView => ({
  id: nonBlankStringValue(dto.profile_id, 'profile id'),
  name: nonBlankStringValue(dto.display_name, 'profile name'),
  email: nonBlankStringValue(dto.email_address, 'profile email'),
  role: oneOf(dto.role, ROLES, 'profile role'),
  title: nonBlankStringValue(dto.job_title, 'profile title'),
  homeWarehouseId: nonBlankStringValue(dto.home_warehouse_id, 'profile warehouse id'),
  homeWarehouse: nonBlankStringValue(dto.home_warehouse, 'profile warehouse'),
});

export const mapSession = (dto: SessionDto): AuthSession => ({
  profileId: nonBlankStringValue(dto.profile_id, 'session profile id'),
  name: nonBlankStringValue(dto.display_name, 'session name'),
  role: oneOf(dto.role, ROLES, 'session role'),
  email: nonBlankStringValue(dto.email_address, 'session email'),
  title: nonBlankStringValue(dto.job_title, 'session title'),
  homeWarehouseId: nonBlankStringValue(dto.home_warehouse_id, 'session warehouse id'),
  homeWarehouse: nonBlankStringValue(dto.home_warehouse, 'session warehouse'),
});
