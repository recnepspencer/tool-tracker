export type RecoveryStep = 'request' | 'code' | 'password' | 'complete';

export function validRecoveryEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export function validRecoveryCode(value: string) {
  return /^\d{6}$/.test(value.trim());
}

export function validDemoPassword(value: string) {
  return value.trim().length >= 8;
}
