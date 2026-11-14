import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { EquipmentTypePicker } from './equipment-type-picker';
import { AddToolPhotoRow } from './add-tool-photo';
import { AssetDetailsFields } from './asset-details';
import { errorMessage } from './client';
import { ChevronDownIcon, EmptyState, ErrorState, FormDraftContext, LoadingState, SelectField } from './kit';
import { useRegisterToolState } from './registration-state';
import { Field, TextArea } from './ui';

/**
 * The full-screen add-tool form. The Add tool tap has already opened the
 * camera; the photo lands in the form's photo row. Live registration picks an
 * existing model and starting warehouse; custody starts in that warehouse's
 * stock. People who cannot manage tools submit equipment they already have
 * for a manager to review instead.
 */
export function RegisterTool() {
  const wizard = useRegisterToolState();
  const { c, policy, canRegister, command } = wizard;
  const manager = c.can('tools.manage');
  const moreId = useId();
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
          <FormDraftContext.Provider value={command.beginDraft}>
            <form
              className="worker-add-step"
              aria-busy={command.busy}
              onChangeCapture={command.beginDraft}
              onSubmit={(event) => void command.run(event)}
            >
              <AddToolHeader onClose={wizard.close}>
                <span>Add tool</span>
              </AddToolHeader>
              <div className="worker-details-scroll">
                <AddToolPhotoRow
                  preview={wizard.preview}
                  fileName={wizard.photoName}
                  error={wizard.photoError}
                  onPhoto={wizard.choosePhoto}
                  onRemove={wizard.removePhoto}
                />
                {wizard.referenceError && <p className="worker-add-error">{wizard.referenceError}</p>}
                {manager && wizard.noModels && (
                  <p className="worker-add-error">Add a tool model before you register a tool.</p>
                )}
                {manager && wizard.noRegistrableModels && (
                  <p className="worker-add-error">
                    No models are currently eligible for registration. Restore a category or model, or add a new one.
                  </p>
                )}
                {manager ? (
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
                    <button
                      type="button"
                      className={`worker-optional-toggle${wizard.optionalOpen ? ' worker-optional-toggle--open' : ''}`}
                      aria-expanded={wizard.optionalOpen}
                      aria-controls={moreId}
                      onClick={wizard.toggleOptional}
                    >
                      <span>More details</span>
                      <ChevronDownIcon className="worker-optional-chevron" />
                    </button>
                    {/* Kept mounted while collapsed so typed values still submit. */}
                    <div id={moreId} hidden={!wizard.optionalOpen}>
                      <div className="worker-form-stack worker-optional-fields">
                        <AssetDetailsFields />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="worker-form-stack">
                    <p>Tell us about equipment already in the field. A manager will review it before it is added.</p>
                    <Field
                      label="What is it?"
                      name="description"
                      required
                      maxLength={500}
                      placeholder="For example: a laptop, ladder, or pickup truck"
                    />
                    <SelectField
                      label="Suggested model"
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
                {c.can('catalog.manage') && (
                  <Link className="text-button" to="/app/catalog">
                    Manage models and warehouses
                  </Link>
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
                  {command.busy ? 'Saving…' : manager ? 'Add tool' : 'Submit for review'}
                </button>
                <p>
                  {!manager
                    ? 'Your submission will appear under Reported equipment.'
                    : wizard.warehouseName
                      ? `Starts in ${wizard.warehouseName} stock`
                      : 'Starts in the selected warehouse’s stock'}
                </p>
              </div>
            </form>
          </FormDraftContext.Provider>
        )}
      </section>
    </div>,
    document.body,
  );
}

function AddToolHeader({ children, onClose }: { children: ReactNode; onClose(): void }) {
  return (
    <div className="worker-add-step-header">
      {children}
      <button type="button" className="worker-close-button" aria-label="Close add tool" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
