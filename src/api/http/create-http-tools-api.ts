import type { ToolsApi } from '../contracts/tools-api';
import type { CatalogDto, DetailDto, ToolDto } from './http-tool-types';
import type { HttpApiOptions } from './http-options';
import { mapCatalog, mapDetail, mapTool } from './http-tool-mappers';
import { mapCreatedTool } from './http-tools-command-mappers';
import { mapFlaggedTool, mapRestoredTool, mapUpdatedTool } from './http-tools-command-mappers';
import { assertUniqueIds, pathWithBase, responseArray } from './http-transport';
import { toEvidenceDto } from './http-evidence';
import type { HolderRef } from '../../domain/custody';
import {
  normalizeCreateToolInput,
  normalizeFlagToolInput,
  normalizeRestoreToolInput,
  normalizeUpdateToolInput,
} from '../tool-command-normalization';

const toExpectedHolderDto = (holder: HolderRef) =>
  holder.type === 'worker'
    ? { kind: 'worker' as const, id: holder.userId }
    : { kind: 'warehouse' as const, id: holder.warehouseId };

const definitionBody = (definition: {
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  category?: string;
  imageKey: string;
}) => ({
  name: definition.name,
  brand: definition.brand,
  model: definition.model,
  category_id: definition.categoryId,
  image_key: definition.imageKey,
});

const createToolBody = (input: ReturnType<typeof normalizeCreateToolInput>) => {
  const evidence = toEvidenceDto(input.evidence);
  return {
    actor_id: input.actorId,
    definition: definitionBody(input.definition),
    warehouse_id: input.warehouseId,
    photo_captured: input.photoCaptured,
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.serial ? { serial: input.serial } : {}),
    ...(input.price ? { price: input.price } : {}),
    ...(evidence ? { evidence } : {}),
  };
};

const mapCreateReceipt = (dto: ToolDto, input: ReturnType<typeof normalizeCreateToolInput>) =>
  mapCreatedTool(dto, {
    actorId: input.actorId,
    destination: input.destination,
    warehouseId: input.warehouseId,
  });

export const createHttpToolsApi = ({ transport, basePath = '/api' }: HttpApiOptions): ToolsApi => ({
  listTools: async () =>
    assertUniqueIds(
      responseArray<ToolDto>(await transport.get(pathWithBase(basePath, '/tools')), 'tools').map(mapTool),
      'tool',
    ),
  listCatalog: async () => {
    const items = assertUniqueIds(
      responseArray<CatalogDto>(await transport.get(pathWithBase(basePath, '/tools/catalog')), 'tool catalog').map(
        mapCatalog,
      ),
      'catalog definition',
    );
    assertUniqueIds(
      items.flatMap((item) => item.units.map((unit) => ({ id: unit.id }))),
      'catalog unit',
    );
    return items;
  },
  getToolDetail: async (toolUnitId) =>
    mapDetail(
      await transport.get<DetailDto>(pathWithBase(basePath, '/tools/' + encodeURIComponent(toolUnitId))),
      toolUnitId,
    ),
  createTool: async (input) => {
    const normalizedInput = normalizeCreateToolInput(input);
    return mapCreateReceipt(
      await transport.post<ToolDto>(pathWithBase(basePath, '/tools'), createToolBody(normalizedInput)),
      normalizedInput,
    );
  },
  createTools: async (inputs) => {
    if (!inputs.length) throw new Error('At least one tool is required');
    const normalizedInputs = inputs.map(normalizeCreateToolInput);
    const receipts = responseArray<ToolDto>(
      await transport.post(pathWithBase(basePath, '/tools/batch'), {
        tools: normalizedInputs.map(createToolBody),
      }),
      'created tools',
    );
    if (receipts.length !== normalizedInputs.length) {
      throw new Error('Invalid API response: created tool count');
    }
    return assertUniqueIds(
      receipts.map((receipt, index) => mapCreateReceipt(receipt, normalizedInputs[index])),
      'created tool',
    );
  },
  updateTool: async (input) => {
    const normalizedInput = normalizeUpdateToolInput(input);
    return mapUpdatedTool(
      await transport.post<ToolDto>(
        pathWithBase(basePath, '/tools/' + encodeURIComponent(normalizedInput.toolUnitId) + '/update'),
        {
          actor_id: normalizedInput.actorId,
          expected_revision: normalizedInput.expectedRevision,
          expected_status: normalizedInput.expectedStatus,
          expected_holder: toExpectedHolderDto(normalizedInput.expectedHolder),
          definition: definitionBody(normalizedInput.definition),
          ...(normalizedInput.serial ? { serial: normalizedInput.serial } : {}),
          ...(normalizedInput.price ? { price: normalizedInput.price } : {}),
          ...(toEvidenceDto(normalizedInput.evidence) ? { evidence: toEvidenceDto(normalizedInput.evidence) } : {}),
        },
      ),
      normalizedInput.toolUnitId,
      normalizedInput.expectedRevision,
      normalizedInput.expectedStatus,
      normalizedInput.expectedHolder,
    );
  },
  flagTool: async (input) => {
    const normalizedInput = normalizeFlagToolInput(input);
    return mapFlaggedTool(
      await transport.post<ToolDto>(
        pathWithBase(basePath, '/tools/' + encodeURIComponent(normalizedInput.toolUnitId) + '/flag'),
        {
          actor_id: normalizedInput.actorId,
          expected_revision: normalizedInput.expectedRevision,
          expected_holder: toExpectedHolderDto(normalizedInput.expectedHolder),
          condition: normalizedInput.condition,
          ...(toEvidenceDto(normalizedInput.evidence) ? { evidence: toEvidenceDto(normalizedInput.evidence) } : {}),
        },
      ),
      normalizedInput.toolUnitId,
      normalizedInput.condition,
      normalizedInput.expectedRevision,
      normalizedInput.expectedHolder,
    );
  },
  restoreTool: async (input) => {
    const normalizedInput = normalizeRestoreToolInput(input);
    return mapRestoredTool(
      await transport.post<ToolDto>(
        pathWithBase(basePath, '/tools/' + encodeURIComponent(normalizedInput.toolUnitId) + '/restore'),
        {
          actor_id: normalizedInput.actorId,
          expected_revision: normalizedInput.expectedRevision,
          expected_holder: toExpectedHolderDto(normalizedInput.expectedHolder),
          ...(toEvidenceDto(normalizedInput.evidence) ? { evidence: toEvidenceDto(normalizedInput.evidence) } : {}),
        },
      ),
      normalizedInput.toolUnitId,
      normalizedInput.expectedRevision,
      normalizedInput.expectedHolder,
    );
  },
});
