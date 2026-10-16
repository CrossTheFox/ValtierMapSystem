import { createContext } from "react";

/**
 * Table-only hooks for mention chips: `isVeiled(ficha)` hides DM-only targets in the player preview;
 * `external(id)` resolves ids that are not fichas (VTT pins / characters, slugs) to `{ label, color, title, onGo }`.
 */
export const CodexTextContext = createContext({ isVeiled: null, external: null });
