import { createPortal } from 'react-dom';
import { EquipmentTypePicker } from './equipment-type-picker';
import { AddToolCaptureStep, AddToolHeader } from './add-tool-steps';
import { AssetDetailsFields } from './asset-details';
import { errorMessage } from './client';
import { ChevronDownIcon, EmptyState, ErrorState, FormDraftContext, LoadingState, SelectField } from './kit';
import { useRegisterToolState } from './registration-state';
import { Field, TextArea } from './ui';

/**
 * The demo's `AddToolWizard`: a full-screen two-step track (photo, then
 * details). Live registration picks an existing model and starting warehouse;
 * custody starts in that warehouse's stock.
 */
export function RegisterTool() {
  const wizard = useRegisterToolState();
  const { c, policy, canRegister, command, step } = wizard;
  const ready = !policy.isPending && !policy.error && canRegister;
  return createPortal(
    <div
      className="worker-add-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && wizard.close()}
    >
      <section
        ref={wizard.panelRef}
        className="worker-add-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add a tool"
      >
        {!ready ? (
          <div className="worker-add-step">
            <AddToolHeader onClose={wizard.close}>
              <span>Add tool</span>
            </AddToolHeader>
            {policy.isPending ? (
              <LoadingState label="Checking tool registration…" />
            ) : policy.error ? (
              <ErrorState message={errorMessage(policy.error)} onRetry={() => void policy.refetch()} />
            ) : (
              <EmptyState label="Field inventory collection is closed. Tell a manager if equipment needs to be added." />
            )}
          </div>
        ) : (
          <div className={`worker-add-track worker-add-track--${step}`}>
            <AddToolCaptureStep
              active={step === 'capture'}
              inputRef={wizard.photoInput}
              error={wizard.photoError}
              onPhoto={wizard.choosePhoto}
              onSkip={wizard.skipPhoto}
              onClose={wizard.close}
            />
            <FormDraftContext.Provider value={command.beginDraft}>
              <form
                className="worker-add-step worker-add-details-step"
                aria-hidden={step !== 'details'}
                {...(step !== 'details' ? { inert: '' } : {})}
                aria-busy={command.busy}
                onChangeCapture={command.beginDraft}
                onSubmit={(event) => void command.run(event)}
              >
                <div className="worker-add-step-header">
                  <button type="button" className="worker-retake-button" onClick={wizard.retake}>
                    ‹&nbsp; Retake
                  </button>
                  <div className="worker-details-header-right">
                    <span className="worker-add-step-label">Tool details</span>
                    <button
                      type="button"
                      className="worker-close-button"
                      aria-label="Close add tool"
                      onClick={wizard.close}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="worker-details-scroll">
                  {wizard.preview && (
                    <div className="worker-upload-tile">
                      <img src={wizard.preview} alt="Selected tool" />
                      <span className="worker-upload-chip">
                        <span className="worker-upload-dot" />
                        Photo selected
                      </span>
                    </div>
                  )}
                  {wizard.referenceError && <p className="worker-add-error">{wizard.referenceError}</p>}
                  {c.can('tools.manage') && wizard.noModels && (
                    <p className="worker-add-error">
                      Your equipment manager needs to add a tool type before you can register a tool.
                    </p>
                  )}
                  {c.can('tools.manage') && wizard.noRegistrableModels && (
                    <p className="worker-add-error">
                      No tool types are currently eligible for registration. Ask your equipment manager to restore a
                      category or tool type.
                    </p>
                  )}
                  {c.can('tools.manage') ? (
                    <>
                      <div className="worker-details-pickers">
                        <EquipmentTypePicker />
                        <SelectField
                          className="worker-select-field"
                          label="Home warehouse"
                          hint="required"
                          name="warehouse"
                          value={wizard.warehouse}
                          onChange={wizard.setWarehouse}
                          options={wizard.warehouseOptions}
                          placeholder="Select a warehouse"
                          required
                          searchable={wizard.warehouseOptions.length > 6}
                          presentation="sheet"
                        />
                      </div>
                      <div className="worker-form-stack">
                        <Field
                          className="worker-add-field"
                          label="Asset tag"
                          hint="required"
                          name="tag"
                          required
                          maxLength={64}
                          placeholder="The tag on this unit"
                        />
                      </div>
                      <button
                        type="button"
                        className={`worker-optional-toggle${wizard.optionalOpen ? ' worker-optional-toggle--open' : ''}`}
                        aria-expanded={wizard.optionalOpen}
                        onClick={wizard.toggleOptional}
                      >
                        <span>Serial, price, notes</span>
                        <ChevronDownIcon className="worker-optional-chevron" />
                      </button>
                      {/* Kept mounted while collapsed so typed values still submit. */}
                      <div hidden={!wizard.optionalOpen}>
                        <div className="worker-form-stack worker-optional-fields">
                          <AssetDetailsFields />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="worker-form-stack">
                      <p>Tell us about equipment already in the field. A manager will review it before registration.</p>
                      <Field
                        label="What is it?"
                        name="description"
                        required
                        maxLength={500}
                        placeholder="For example: a laptop, ladder, or pickup truck"
                      />
                      <SelectField
                        label="Suggested tool type"
                        name="model"
                        options={[{ value: '', label: 'Not sure / not listed' }, ...wizard.modelOptions]}
                      />
                      <label>
                        <input type="checkbox" name="possession" defaultChecked /> I have this equipment
                      </label>
                      <Field
                        label="Location or job"
                        name="location"
                        maxLength={500}
                        hint="Required if it is not with you"
                      />
                      <TextArea label="Notes" name="notes" maxLength={4000} />
                    </div>
                  )}
                  {command.error && (
                    <p className="worker-add-error" role="alert">
                      {command.error}
                    </p>
                  )}
                  <div className="worker-add-scroll-spacer" />
                </div>
                <div className="worker-add-footer">
                  <button type="submit" className="worker-primary-button" disabled={command.busy}>
                    {command.busy ? 'Saving…' : c.can('tools.manage') ? 'Add tool' : 'Submit for review'}
                  </button>
                  <p>
                    {!c.can('tools.manage')
                      ? 'Your submission will appear under Reported equipment.'
                      : wizard.warehouseName
                        ? `Starts in ${wizard.warehouseName} stock`
                        : 'Starts in the selected warehouse’s stock'}
                  </p>
                </div>
              </form>
            </FormDraftContext.Provider>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
