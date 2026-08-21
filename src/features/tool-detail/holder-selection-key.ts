import type { ToolHolderView } from '../../domain/read-models/holder';

export const holderSelectionKey = (holder: ToolHolderView) =>
  holder.type === 'worker' ? 'worker:' + holder.userId : 'warehouse:' + holder.warehouseId;
