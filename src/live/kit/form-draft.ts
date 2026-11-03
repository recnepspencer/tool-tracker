import { createContext, useContext } from 'react';

// Custom controls do not emit native change events, so forms that track the
// start of an edit expose a callback for them instead.
export const FormDraftContext = createContext<(() => void) | null>(null);

export const useFormDraft = () => useContext(FormDraftContext);
