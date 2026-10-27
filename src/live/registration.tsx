import { Camera } from 'lucide-react';
import { AssetDetailsFields } from './asset-details';
import { Link } from 'react-router-dom';
import { errorMessage } from './client';
import { RecordSheet } from './experience/RecordSheet';
import { useSheetNavigation } from './field-state';
import { useRegisterToolState } from './tools-state';
import { Field, Form, Loading, Notice, Select } from './ui';

export function RegisterTool() {
  const {
    c,
    refs,
    created,
    policy,
    canRegister,
    step,
    setStep,
    preview,
    photoError,
    choosePhoto,
    skipPhoto,
    register,
  } = useRegisterToolState();
  const { close } = useSheetNavigation();
  return (
    <RecordSheet title="Add a tool" onClose={close}>
      <header className="page-heading">
        <div>
          <span className="eyebrow">{step === 'photo' ? '01 · Photo' : '02 · Tool details'}</span>
          <h1>Add a tool</h1>
        </div>
      </header>
      {policy.isPending ? (
        <Loading />
      ) : policy.error ? (
        <Notice error>{errorMessage(policy.error)}</Notice>
      ) : !canRegister ? (
        <Notice>Employee tool registration is disabled by your company. Contact your equipment manager.</Notice>
      ) : created ? (
        <Notice>
          Tool registered. <Link to={`/app/tools/${created}`}>Open its custody record</Link>
        </Notice>
      ) : (
        <div className={`registration-wizard registration-wizard--${step}`}>
          <Form label="Register tool" submit={register}>
            <div hidden={step !== 'photo'} className="registration-capture">
              <div className="photo-capture-frame">
                <Camera size={48} aria-hidden="true" />
                <h2>Start with a photo</h2>
                <p>Take a clear photo of this tool, or choose one from your library.</p>
                <Field
                  label="Tool photo (up to 8 MB)"
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={(event) => {
                    choosePhoto(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </div>
              {photoError && <Notice error>{photoError}</Notice>}
              <button type="button" onClick={skipPhoto}>
                Continue without a photo
              </button>
            </div>
            <div hidden={step !== 'details'} className="registration-details">
              <button type="button" onClick={() => setStep('photo')}>
                Change photo
              </button>
              {preview && (
                <div className="worker-upload-tile">
                  <img src={preview} alt="Selected tool" />
                </div>
              )}
              <p className="muted">Choose its shared model, then identify this physical unit.</p>
              {(refs.models.error || refs.warehouses.error) && (
                <Notice error>{errorMessage(refs.models.error || refs.warehouses.error)}</Notice>
              )}
              <Select label="Tool model" name="model">
                <option value="">Choose a model</option>
                {refs.models.data?.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.registrable}>
                    {m.manufacturer} {m.name} · {m.model_number}
                    {!m.registrable && ' (category archived)'}
                  </option>
                ))}
              </Select>
              {refs.models.data?.length === 0 && (
                <Notice>Your equipment manager needs to add a tool model before you can register a tool.</Notice>
              )}
              {!!refs.models.data?.length && refs.models.data.every((model) => !model.registrable) && (
                <Notice>
                  No models are currently eligible for registration. Ask your equipment manager to restore a category or
                  model.
                </Notice>
              )}
              <Select label="Starting warehouse" name="warehouse">
                <option value="">Choose a warehouse</option>
                {refs.warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
              <Field label="Unique asset tag" name="tag" required maxLength={64} />
              <details>
                <summary>Serial, price & notes</summary>
                <AssetDetailsFields />
              </details>
              <p className="muted">
                Initial custody is recorded at the selected warehouse. Receipt is confirmed through a handoff.
              </p>
            </div>
          </Form>
          {c.can('catalog.manage') && (
            <Link className="text-link" to="/app/catalog">
              Manage models and warehouses
            </Link>
          )}
        </div>
      )}
    </RecordSheet>
  );
}
