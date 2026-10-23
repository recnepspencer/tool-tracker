export const settingMutationBody = (actorId: string, values: Record<string, unknown>) => ({
  actor_id: actorId,
  ...values,
});
