import { createContext, useContext } from "react";

/**
 * Provides a font-size step for CyberText within a dialog.
 * step 0 = base (minimum), each step up adds ~18% to the base size.
 * Max step is 3.
 */
export const DialogFontSizeContext = createContext(0);

export const useDialogFontSize = () => useContext(DialogFontSizeContext);
