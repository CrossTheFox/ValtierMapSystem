import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { subscribeLoreFichas } from "../../firebase/services/loreFichaService";
import { subscribeLoreRelaciones } from "../../firebase/services/loreRelationService";

/**
 * Fichas of the Lore linked to a campaign (`primary_lore_id`). Empty while inactive.
 * @param {string|null} campaignId
 * @param {boolean} active
 */
export function useCampaignLoreFichas(campaignId, active) {
    const [loreId, setLoreId] = useState("");
    const [fichas, setFichas] = useState([]);
    const [relaciones, setRelaciones] = useState([]);

    useEffect(() => {
        if (!active || !campaignId) return undefined;
        return onSnapshot(
            doc(db, "campaigns", campaignId),
            (snap) => setLoreId(snap.exists() ? (snap.data().primary_lore_id || "") : ""),
            () => setLoreId(""),
        );
    }, [active, campaignId]);

    useEffect(() => {
        if (!active || !loreId) return undefined;
        return subscribeLoreFichas(loreId, setFichas, () => setFichas([]));
    }, [active, loreId]);

    useEffect(() => {
        if (!active || !loreId) return undefined;
        return subscribeLoreRelaciones(loreId, setRelaciones, () => setRelaciones([]));
    }, [active, loreId]);

    return {
        loreId: active ? loreId : "",
        fichas: active && loreId ? fichas : [],
        relaciones: active && loreId ? relaciones : [],
    };
}
