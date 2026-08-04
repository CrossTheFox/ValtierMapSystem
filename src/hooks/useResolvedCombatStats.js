import { useEffect, useMemo, useState } from "react";
import { getClaseDoc } from "../../firebase/services/classService";
import { resolveCombatStats } from "../utils/resolveCombatStats";

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

    const stats = useMemo(
        () => resolveCombatStats(character, claseDoc),
        [character, claseDoc],
    );

    return { combatStats: stats, claseDoc, classId };
}
