export interface OnboardingDraft {
  name: string;
  email: string;
}

export function validateOnboardingDraft(draft: OnboardingDraft) {
  if (!draft.name.trim()) return 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return 'Enter a valid email address.';
  return null;
}
