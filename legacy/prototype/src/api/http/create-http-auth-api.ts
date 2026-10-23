import type { AuthApi } from '../contracts/auth-api';
import type { HttpApiOptions } from './http-options';
import { mapProfile, mapSession } from './http-auth-mappers';
import type { ProfileDto, SessionDto } from './http-auth-types';
import { assertUniqueIds, pathWithBase, responseArray } from './http-transport';

const mapRequestedSession = (dto: SessionDto, requestedProfileId: string) => {
  const session = mapSession(dto);
  if (session.profileId !== requestedProfileId) throw new Error('Invalid API response: session profile id');
  return session;
};

export const createHttpAuthApi = ({ transport, basePath = '/api' }: HttpApiOptions): AuthApi => ({
  listDemoProfiles: async () =>
    assertUniqueIds(
      responseArray<ProfileDto>(await transport.get(pathWithBase(basePath, '/demo-profiles')), 'demo profiles').map(
        mapProfile,
      ),
      'profile',
    ),
  signInAs: async (profileId) =>
    mapRequestedSession(
      await transport.post<SessionDto>(pathWithBase(basePath, '/sessions/demo'), { profile_id: profileId }),
      profileId,
    ),
  restoreSession: async (profileId) => {
    const response = await transport.post<SessionDto | null>(pathWithBase(basePath, '/sessions/restore'), {
      profile_id: profileId,
    });
    return response === null ? null : mapRequestedSession(response, profileId);
  },
  signOut: async () => {
    await transport.post<void>(pathWithBase(basePath, '/sessions/signout'), {});
  },
});
