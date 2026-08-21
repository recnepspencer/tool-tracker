export interface ToolDraft {
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  warehouseId: string;
  serial: string;
  price: string;
  note: string;
}

export const initialToolDraft: ToolDraft = {
  name: '',
  brand: '',
  model: '',
  categoryId: '',
  warehouseId: '',
  serial: '',
  price: '',
  note: '',
};
