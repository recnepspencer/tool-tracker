export type WorkflowErrorCode = 'not-found' | 'forbidden' | 'conflict' | 'invalid' | 'archived' | 'unavailable';

export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;

  constructor(code: WorkflowErrorCode, message: string) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
  }
}
