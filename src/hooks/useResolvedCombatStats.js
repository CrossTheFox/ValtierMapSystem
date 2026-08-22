import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { getClaseDoc } from "../../firebase/services/classService";
import { subscribeCharacterItems } from "../../firebase/services/itemService";
import { resolveCombatStats } from "../utils/resolveCombatStats";
import { applyItemCombatOverlays } from "../utils/characterItemEffects";

/**
 * Resolve combat stats for a character, loading their primary/active job when needed.
 * @param {Record<string, unknown>|null|undefined} character
 * @param {number|string} [reloadKey] — bump to refetch the job doc
 */
export function useResolvedCombatStats(character, reloadKey = 0) {
    const classId =
        (typeof character?.activeClassId === "string" && character.activeClassId) ||
        (Array.isArray(character?.assignedClassIds) && character.assignedClassIds[0]) ||
        null;

    const [claseDoc, setClaseDoc] = useState(null);
    const [carriedItems, setCarriedItems] = useState([]);
    const selectedCampaignId = useSelector((s) => s.world.selectedCampaignId);
    const campaignId =
        (typeof character?.campaignId === "string" && character.campaignId)
        || (typeof selectedCampaignId === "string" && selectedCampaignId)
        || null;
    const characterId = typeof character?.id === "string" ? character.id : null;

    useEffect(() => {
        setCarriedItems([]);
        if (!campaignId || !characterId) return undefined;
        return subscribeCharacterItems(campaignId, characterId, (list) => {
            setCarriedItems(Array.isArray(list) ? list : []);
        });
    }, [campaignId, characterId]);

    useEffect(() => {
        let cancelled = false;
        if (!classId) {
            setClaseDoc(null);
            return undefined;
        }
        getClaseDoc(classId)
            .then((doc) => {
                if (!cancelled) setClaseDoc(doc);
            })
            .catch(() => {
                if (!cancelled) setClaseDoc(null);
            });
        return () => {
            cancelled = true;
        };
    }, [classId, reloadKey]);

    const stats = useMemo(() => {
        const base = resolveCombatStats(character, claseDoc);
        return applyItemCombatOverlays(base, carriedItems, characterId);
    }, [character, claseDoc, carriedItems, characterId]);

    return { combatStats: stats, claseDoc, classId, carriedItems };
}
