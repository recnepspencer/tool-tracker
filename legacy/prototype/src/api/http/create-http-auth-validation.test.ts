import { describe, expect, it } from 'vitest';
import { apiFor, validProfile, validSession } from './http-validation-fixtures';

describe('createHttpApi auth validation', () => {
  it('rejects invalid profiles, sessions, and session identities', async () => {
    await expect(
      apiFor('/api/demo-profiles', [{ ...validProfile, role: 'manager' }]).auth.listDemoProfiles(),
    ).rejects.toThrow('profile role');
    await expect(
      apiFor('/api/demo-profiles', [
        validProfile,
        { ...validProfile, display_name: 'Duplicate Ray' },
      ]).auth.listDemoProfiles(),
    ).rejects.toThrow('profile ids');
    await expect(
      apiFor('/api/sessions/demo', {
        profile_id: 'ray-torres',
        display_name: 7,
        role: 'worker',
        email_address: 'x',
      }).auth.signInAs('ray-torres'),
    ).rejects.toThrow('session name');
    await expect(
      apiFor('/api/sessions/demo', {
        profile_id: 'ray-torres',
        display_name: 'Ray Torres',
        role: 'worker',
        email_address: 'x',
      }).auth.signInAs('ray-torres'),
    ).rejects.toThrow('session title');
    await expect(apiFor('/api/sessions/demo', validSession).auth.signInAs('ray-torres')).rejects.toThrow(
      'session profile id',
    );
    await expect(apiFor('/api/sessions/restore', validSession).auth.restoreSession('ray-torres')).rejects.toThrow(
      'session profile id',
    );
    for (const payload of [false, 0, '']) {
      await expect(apiFor('/api/sessions/restore', payload).auth.restoreSession('ray-torres')).rejects.toThrow(
        'session profile id',
      );
    }
  });
});
