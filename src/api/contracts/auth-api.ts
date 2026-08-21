import type { AuthSession } from '../../domain/auth';
import type { DemoProfileView } from '../../domain/read-models/auth';

export interface AuthApi {
  listDemoProfiles(): Promise<DemoProfileView[]>;
  signInAs(profileId: string): Promise<AuthSession>;
  restoreSession(profileId: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}
