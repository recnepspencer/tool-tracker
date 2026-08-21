import type { AuthSession } from '../../domain/auth';
import type { DemoProfileView } from '../../domain/read-models/auth';

export interface ProfileDto {
  profile_id: string;
  display_name: string;
  email_address: string;
  role: DemoProfileView['role'];
  job_title: string;
  home_warehouse_id: string;
  home_warehouse: string;
}

export interface SessionDto {
  profile_id: string;
  display_name: string;
  role: AuthSession['role'];
  email_address: string;
  job_title: string;
  home_warehouse_id: string;
  home_warehouse: string;
}
