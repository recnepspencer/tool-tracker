export interface DemoInvitationScenario {
  name: string;
  email: string;
  role: string;
  company: string;
}

const sampleInvitation: DemoInvitationScenario = {
  name: 'Casey Reed',
  email: 'casey@nelson-electric.test',
  role: 'Warehouse manager',
  company: 'Nelson Electric',
};

export function getDemoInvitation(token: string | undefined) {
  return token === 'sample-invite' ? sampleInvitation : null;
}
