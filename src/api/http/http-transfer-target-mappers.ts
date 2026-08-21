import type { ToolHolderView } from '../../domain/read-models/holder';
import { mapHolder } from './http-holder-mapper';
import type { TransferTargetDto } from './http-transfer-target-types';

export const mapTransferTarget = (dto: TransferTargetDto): ToolHolderView => mapHolder(dto, 'transfer target');
