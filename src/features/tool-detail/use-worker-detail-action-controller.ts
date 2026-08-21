import { useEffect, useState } from 'react';
import type { AuthSession } from '../../domain/auth';
import type { ToolDetailView } from '../../domain/read-models/tools';
import type { ToolHolderView } from '../../domain/read-models/holder';
import { useCustodyMutations } from '../custody/use-custody-mutations';
import type { DetailAction } from './detail-action-types';
import type { TransferDestinationMode } from './TransferDestinationPicker';
import { buildWorkerActionEvidence, submitWorkerDetailAction } from './worker-detail-action-runner';

interface DetailQueryState {
  data?: ToolDetailView;
  isPending: boolean;
  isFetching: boolean;
  isPaused: boolean;
  isError: boolean;
}

interface TargetQueryState {
  data?: ToolHolderView[];
  isPending: boolean;
  isFetching: boolean;
  isPaused: boolean;
  isError: boolean;
}

interface WorkerDetailActionControllerInput {
  toolUnitId: string | null;
  detail: DetailQueryState;
  targets: TargetQueryState;
  session: AuthSession | null;
  canStartHandoff: boolean;
  initialAction?: DetailAction | null;
  onSuccess?(action: DetailAction): void;
}

export function useWorkerDetailActionController({
  toolUnitId,
  detail,
  targets,
  session,
  canStartHandoff,
  initialAction = null,
  onSuccess,
}: WorkerDetailActionControllerInput) {
  const mutations = useCustodyMutations();
  const [action, setAction] = useState<DetailAction | null>(null);
  const [target, setTarget] = useState('');
  const [transferMode, setTransferMode] = useState<TransferDestinationMode | null>(null);
  const [personQuery, setPersonQuery] = useState('');
  const [note, setNote] = useState('');
  const [mockPhoto, setMockPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy =
    mutations.requestTool.isPending || mutations.startTransfer.isPending || mutations.reportToolCondition.isPending;

  useEffect(() => {
    setAction(initialAction);
    setTarget('');
    setTransferMode(null);
    setPersonQuery('');
    setNote('');
    setMockPhoto(false);
    setError(null);
    setNotice(null);
  }, [initialAction, toolUnitId]);

  useEffect(() => {
    if (initialAction && canStartHandoff && action === null) setAction(initialAction);
  }, [action, canStartHandoff, initialAction]);

  useEffect(() => {
    if (detail.data && (detail.data.lifecycle !== 'active' || !canStartHandoff)) setAction(null);
  }, [canStartHandoff, detail.data]);

  const submit = async () => {
    if (!action || !detail.data || !session || busy || detail.isFetching || detail.isPaused) return;
    if (detail.data.lifecycle !== 'active' || !canStartHandoff) {
      setAction(null);
      setError('This action is no longer available.');
      return;
    }
    setError(null);
    const evidence = buildWorkerActionEvidence(note, mockPhoto);
    try {
      const nextNotice = await submitWorkerDetailAction({
        action,
        session,
        toolUnitId: toolUnitId!,
        target,
        targets,
        evidence,
        mutations,
      });
      setNotice(nextNotice);
      setAction(null);
      setTarget('');
      setTransferMode(null);
      setPersonQuery('');
      setNote('');
      setMockPhoto(false);
      onSuccess?.(action);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This action could not be completed.');
    }
  };

  return {
    action,
    target,
    note,
    mockPhoto,
    error,
    notice,
    busy,
    detailRefreshing: detail.isFetching,
    onAction: (nextAction: DetailAction) => {
      setNotice(null);
      setError(null);
      setTarget('');
      setTransferMode(null);
      setPersonQuery('');
      setAction(nextAction);
    },
    onTargetChange: setTarget,
    transferMode,
    personQuery,
    onTransferModeChange: (nextMode: TransferDestinationMode | null) => {
      setTransferMode(nextMode);
      setTarget('');
      setPersonQuery('');
    },
    onPersonQueryChange: setPersonQuery,
    onNoteChange: setNote,
    onMockPhotoChange: setMockPhoto,
    onCloseAction: () => {
      setAction(null);
      setTarget('');
      setTransferMode(null);
      setPersonQuery('');
    },
    submit,
  };
}
