import { useEffect, useRef, useState } from 'react';
import type { AuthSession } from '../../domain/auth';
import type { ToolDetailView } from '../../domain/read-models/tools';
import type { ToolHolderView } from '../../domain/read-models/holder';
import type { CustodyPhotoEvidence } from '../../domain/evidence';
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
  hasPendingHandoff: boolean;
  initialAction?: DetailAction | null;
  onSuccess?(action: DetailAction): void;
}

export function useWorkerDetailActionController({
  toolUnitId,
  detail,
  targets,
  session,
  canStartHandoff,
  hasPendingHandoff,
  initialAction = null,
  onSuccess,
}: WorkerDetailActionControllerInput) {
  const mutations = useCustodyMutations();
  const [action, setAction] = useState<DetailAction | null>(null);
  const [target, setTarget] = useState('');
  const [transferMode, setTransferMode] = useState<TransferDestinationMode | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<CustodyPhotoEvidence | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissedInitialActionKey, setDismissedInitialActionKey] = useState<string | null>(null);
  const submissionVersion = useRef(0);
  const currentToolUnitId = useRef(toolUnitId);
  currentToolUnitId.current = toolUnitId;
  const initialActionKey = toolUnitId && initialAction ? `${toolUnitId}:${initialAction}` : null;
  const busy =
    mutations.requestTool.isPending || mutations.startTransfer.isPending || mutations.reportToolCondition.isPending;

  const clearActionDraft = () => {
    setTarget('');
    setTransferMode(null);
    setNote('');
    setPhoto(null);
    setPhotoBusy(false);
  };

  useEffect(() => {
    submissionVersion.current += 1;
    setAction(initialAction);
    setDismissedInitialActionKey(null);
    setTarget('');
    setTransferMode(null);
    setNote('');
    setPhoto(null);
    setPhotoBusy(false);
    setError(null);
    setNotice(null);
  }, [initialAction, toolUnitId]);

  useEffect(() => {
    if (initialAction && canStartHandoff && action === null && dismissedInitialActionKey !== initialActionKey) {
      setAction(initialAction);
    }
  }, [action, canStartHandoff, dismissedInitialActionKey, initialAction, initialActionKey]);

  useEffect(() => {
    if (detail.data && (detail.data.lifecycle !== 'active' || hasPendingHandoff)) setAction(null);
  }, [detail.data, hasPendingHandoff]);

  const submit = async () => {
    if (!action || !detail.data || !session || busy || photoBusy || detail.isFetching || detail.isPaused) return;
    if (detail.data.lifecycle !== 'active' || !canStartHandoff) {
      setAction(null);
      setError('This action is no longer available.');
      return;
    }
    setError(null);
    const submittedToolUnitId = toolUnitId;
    const version = submissionVersion.current + 1;
    submissionVersion.current = version;
    const evidence = buildWorkerActionEvidence(note, photo);
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
      if (version !== submissionVersion.current || currentToolUnitId.current !== submittedToolUnitId) return;
      setNotice(nextNotice);
      setDismissedInitialActionKey(initialActionKey);
      setAction(null);
      setTarget('');
      setTransferMode(null);
      setNote('');
      setPhoto(null);
      setPhotoBusy(false);
      onSuccess?.(action);
    } catch (caught) {
      if (version !== submissionVersion.current || currentToolUnitId.current !== submittedToolUnitId) return;
      setError(caught instanceof Error ? caught.message : 'This action could not be completed.');
    }
  };

  return {
    action: detail.data?.lifecycle === 'active' && !hasPendingHandoff ? action : null,
    target,
    note,
    photo,
    photoBusy,
    error,
    notice,
    busy,
    detailRefreshing: detail.isFetching,
    onAction: (nextAction: DetailAction) => {
      submissionVersion.current += 1;
      setNotice(null);
      setError(null);
      clearActionDraft();
      setAction(nextAction);
    },
    onTargetChange: setTarget,
    transferMode,
    onTransferModeChange: (nextMode: TransferDestinationMode | null) => {
      setTransferMode(nextMode);
      setTarget('');
    },
    onNoteChange: setNote,
    onPhotoChange: setPhoto,
    onPhotoBusyChange: setPhotoBusy,
    onCloseAction: () => {
      submissionVersion.current += 1;
      setDismissedInitialActionKey(initialActionKey);
      setAction(null);
      clearActionDraft();
    },
    onDismiss: () => {
      submissionVersion.current += 1;
    },
    submit,
  };
}
