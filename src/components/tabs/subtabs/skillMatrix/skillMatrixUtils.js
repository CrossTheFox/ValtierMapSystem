import { useState, useEffect, useMemo } from "react";
import { getAbilitiesByIds } from "../../../../../firebase/services/characterService";

/** @param {Array<{ type?: string, key?: string }>} abs */
export function findClassRootFromList(abs) {
    if (!Array.isArray(abs)) return null;
    return abs.find((a) => a.type === "class_root") || null;
}

export function buildTreeData(allAbilities, unlockedKeys) {
    if (!allAbilities?.length) return null;
    const check = (key) => unlockedKeys?.includes(key);
    const sortByUnlock = (a, b) => (check(b.key) === check(a.key) ? 0 : check(b.key) ? 1 : -1);

    return {
        traits: allAbilities.filter((a) => a.type === "trait").sort(sortByUnlock),
        abilities: allAbilities.filter((a) => a.type === "ability").sort(sortByUnlock),
        upgrades: allAbilities.filter((a) => a.type === "upgrade"),
        masteries: allAbilities.filter((a) => a.type === "mastery"),
        limitBreak: allAbilities.find((a) => a.type === "ultimate"),
    };
}

/**
 * @param {{ id?: string, allAbilities?: string[], unlockedAbilities?: string[] }} character
 */
export function useSkillMatrixAbilities(character) {
    const [allAbilities, setAllAbilities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const ids =
            Array.isArray(character?.allAbilities) && character.allAbilities.length > 0
                ? character.allAbilities
                : Array.isArray(character?.unlockedAbilities) && character.unlockedAbilities.length > 0
                  ? character.unlockedAbilities
                  : [];

        if (!ids.length) {
            setAllAbilities([]);
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setLoading(true);
        getAbilitiesByIds(ids).then((res) => {
            if (!cancelled) {
                setAllAbilities(res);
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [character?.id, character?.allAbilities, character?.unlockedAbilities]);

    const treeData = useMemo(
        () => buildTreeData(allAbilities, character?.unlockedAbilities),
        [allAbilities, character?.unlockedAbilities]
    );

    const checkUnlocked = (key) => character?.unlockedAbilities?.includes(key);

    return { loading, allAbilities, treeData, checkUnlocked };
}
