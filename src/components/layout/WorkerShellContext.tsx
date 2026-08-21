import { createContext, useContext } from 'react';

export interface WorkerShellActions {
  openAddTool(): void;
}

const WorkerShellActionsContext = createContext<WorkerShellActions | null>(null);

export const WorkerShellActionsProvider = WorkerShellActionsContext.Provider;

export function useWorkerShellActions(): WorkerShellActions {
  const value = useContext(WorkerShellActionsContext);
  if (!value) throw new Error('useWorkerShellActions must be used inside the worker shell');
  return value;
}
