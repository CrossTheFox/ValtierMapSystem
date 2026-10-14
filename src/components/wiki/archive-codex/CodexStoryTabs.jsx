/**
 * Codex article split: biography and what the character lives stay on Historia.
 * Personality is the other tab. Switching ficha returns to Historia.
 */

import { useEffect, useState } from "react";

/**
 * @param {{
 *   fichaId: string,
 *   personality?: import("react").ReactNode,
 *   children: import("react").ReactNode,
 * }} props
 */
export default function CodexStoryTabs({ fichaId, personality, children }) {
    const [tab, setTab] = useState("historia");
    useEffect(() => { setTab("historia"); }, [fichaId]);
    if (!personality) return children;
    return (
        <>
            <div className="cx-tabs" role="tablist" aria-label="Secciones de la ficha">
                <button type="button" role="tab" aria-selected={tab === "historia"} onClick={() => setTab("historia")}>
                    Historia
                </button>
                <button type="button" role="tab" aria-selected={tab === "personalidad"} onClick={() => setTab("personalidad")}>
                    Personalidad
                </button>
            </div>
            {tab === "personalidad" ? (
                <div className="lab-extra-card cx-person-tab">{personality}</div>
            ) : children}
        </>
    );
}
