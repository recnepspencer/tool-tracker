import { api, type Model } from './client';
import { useHandoffDecision } from './operations-state';
import { useCompany } from './session';
import { Field, Form, Notice, Select, text } from './ui';

export function HandoffReview({
  handoff,
  receiving,
  cancelling,
  voidAllowed,
  onDone,
}: {
  handoff: Model<'HandoffView'>;
  receiving: boolean;
  cancelling: boolean;
  voidAllowed: boolean;
  onDone: () => void;
}) {
  const c = useCompany();
  const { decision, setDecision } = useHandoffDecision(receiving, cancelling);
  return (
    <Form
      label="Confirm handoff decision"
      onDone={onDone}
      submit={(f) =>
        api.POST('/api/companies/{company_id}/handoffs/{handoff_id}/{action}', {
          params: {
            path: {
              ...c.path,
              handoff_id: handoff.id,
              action: text(f, 'action') as 'accept' | 'decline' | 'cancel' | 'void',
            },
          },
          body: { expected_revision: handoff.revision, note: text(f, 'note') },
        })
      }
    >
      <Select label="Decision" name="action" value={decision} onChange={(event) => setDecision(event.target.value)}>
        {receiving && (
          <>
            <option value="accept">Accept — I have received this tool</option>
            <option value="decline">Decline receipt</option>
          </>
        )}
        {cancelling && <option value="cancel">Cancel my handoff</option>}
        {voidAllowed && <option value="void">Administrative cancellation</option>}
      </Select>
      {decision === 'void' && (
        <Notice>
          Cancel the proposal without changing custody. The reason and your identity are retained in the history.
        </Notice>
      )}
      <Field label="Note" name="note" maxLength={2000} required={decision === 'void'} />
    </Form>
  );
}
