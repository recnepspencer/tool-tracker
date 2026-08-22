import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { TextField } from '../../components/ui/TextField';
import type { CompanyProfileView } from '../../domain/read-models/settings';
import type { SettingsMutations } from './use-settings-mutations';

export function CompanySettingsForm({
  company,
  mutations,
  blocked,
}: {
  company: CompanyProfileView;
  mutations: SettingsMutations;
  blocked: boolean;
}) {
  const [name, setName] = useState(company.name);
  const [address, setAddress] = useState(company.address);
  useEffect(() => {
    setName(company.name);
    setAddress(company.address);
  }, [company.address, company.name]);
  const save = () =>
    void mutations.updateCompany
      .mutateAsync({ expectedRevision: company.revision, name, address })
      .catch(() => undefined);
  return (
    <SurfaceCard>
      <div className="settings-card-heading">
        <span className="eyebrow">Company profile</span>
      </div>
      <TextField label="Company name" value={name} onChange={setName} />
      <TextField label="Address" value={address} onChange={setAddress} />
      <Button onClick={save} disabled={blocked || mutations.updateCompany.isPending || !name.trim() || !address.trim()}>
        Save company
      </Button>
    </SurfaceCard>
  );
}
