// context/ViewportContext.js
import { createContext, useContext } from "react";

export const ViewportContext = createContext(null);

export function useViewport() {
    return useContext(ViewportContext);
}
