import { createHttpApi } from './create-http-api';

export const validTool = {
  tool_id: 'TL-101',
  revision: 1,
  display_name: 'Hammer drill',
  manufacturer: 'DeWalt',
  model: 'DCD996',
  category: 'Power tools',
  image_url: './tool-images/hammer-drill.png',
  display_status: 'in-stock',
  holder: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
  last_moved_at: '2026-08-12T10:00:00-06:00',
};

export const validProfile = {
  profile_id: 'ray-torres',
  display_name: 'Ray Torres',
  email_address: 'ray@nelsonelectric.com',
  role: 'worker',
  job_title: 'Journeyman electrician',
  home_warehouse_id: 'north-yard',
  home_warehouse: 'North Yard',
};

export const validCatalog = {
  definition_id: 'def-drill',
  display_name: 'Hammer drill',
  manufacturer: 'DeWalt',
  model: 'DCD996',
  category: 'Power tools',
  image_url: './tool-images/hammer-drill.png',
  unit_ids: ['TL-101'],
  units: [{ unit_id: 'TL-101', warehouse_id: 'north-yard', display_status: 'in-stock' }],
  total_count: 1,
  available_count: 1,
  checked_out_count: 0,
  damaged_count: 0,
  lost_count: 0,
  warehouses: [{ warehouse_id: 'north-yard', name: 'North Yard', unit_count: 1 }],
};

export const validActivity = {
  event_id: 'EV-1',
  actor_id: 'sam-ochoa',
  actor_name: 'Sam Ochoa',
  action: 'Added a tool',
  tool_unit_id: 'TL-101',
  tool_name: 'Hammer drill',
  image_url: './tool-images/hammer-drill.png',
  occurred_at: '2026-08-17T15:00:00Z',
  kind: 'admin',
  scope: 'warehouse',
  participant_ids: [],
  warehouse_id: 'north-yard',
  warehouse_name: 'North Yard',
};

export const validWarehouse = {
  warehouse_id: 'north-yard',
  name: 'North Yard',
  address: '1420 Kerr Ave',
  manager_id: 'sam-ochoa',
  manager_name: 'Sam Ochoa',
  stock_count: 1,
  out_count: 0,
};

export const validSummary = {
  total_tools: 1,
  checked_out: 0,
  in_stock: 1,
  flagged: 0,
  people: [{ person_id: 'sam-ochoa', display_name: 'Sam Ochoa', role: 'admin', lifecycle: 'active' }],
  tools: [{ tool_unit_id: 'TL-101', name: 'Hammer drill' }],
  warehouses: [validWarehouse],
  recent_events: [],
  pending_approvals: 0,
  long_held_tools: [],
};

export const validSummaryEvent = {
  event_id: 'EV-1',
  actor_id: 'sam-ochoa',
  actor_name: 'Sam Ochoa',
  action: 'Updated warehouse settings',
  occurred_at: '2026-08-17T15:00:00Z',
  kind: 'admin',
};

export const validHandoff = {
  handoff_id: 'HO-1',
  tool_unit_id: 'TL-101',
  tool_name: 'Hammer drill',
  image_url: './tool-images/hammer-drill.png',
  from: { kind: 'warehouse', id: 'north-yard', label: 'North Yard' },
  to: { kind: 'worker', id: 'ray-torres', label: 'Ray Torres' },
  requested_by_id: 'ray-torres',
  requested_by: 'Ray Torres',
  requested_at: '2026-08-17T10:18:00-06:00',
  lifecycle: 'active',
};

export const validDetail = {
  tool: validTool,
  origin_warehouse: { warehouse_id: 'north-yard', name: 'North Yard' },
  condition: 'serviceable',
  lifecycle: 'active',
  timeline: [],
};

export const validSession = {
  profile_id: 'sam-ochoa',
  display_name: 'Sam Ochoa',
  role: 'admin',
  email_address: 'sam@nelsonelectric.com',
  job_title: 'Administrator',
  home_warehouse_id: 'north-yard',
  home_warehouse: 'North Yard',
};

export const apiFor = (path: string, payload: unknown) => {
  const api = createHttpApi({
    transport: {
      get: async <T>(requestedPath: string) => {
        if (requestedPath !== path) throw new Error('unexpected path');
        return payload as T;
      },
      post: async <T>(requestedPath: string) => {
        if (requestedPath !== path) throw new Error('unexpected path');
        return payload as T;
      },
    },
  });
  return { ...api, admin: { ...api.admin, getSummary: () => api.admin.getSummary({ actorId: 'sam-ochoa' }) } };
};
