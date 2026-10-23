import type { ToolHolderView } from '../../domain/read-models/holder';
import type { HolderDto } from './http-holder-types';
import { nonBlankStringValue } from './http-validation';

export const mapHolder = (holder: HolderDto, label: string): ToolHolderView => {
  if (!holder || (holder.kind !== 'worker' && holder.kind !== 'warehouse')) {
    throw new Error('Invalid API response: ' + label + ' holder kind');
  }
  return holder.kind === 'worker'
    ? {
        type: 'worker',
        userId: nonBlankStringValue(holder.id, label + ' worker id'),
        name: nonBlankStringValue(holder.label, label + ' worker name'),
      }
    : {
        type: 'warehouse',
        warehouseId: nonBlankStringValue(holder.id, label + ' warehouse id'),
        name: nonBlankStringValue(holder.label, label + ' warehouse name'),
      };
};
