import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateCharacterFields } from "../../firebase/services/characterService";
import { updateCharacterInList } from "../store/characterSlice";
import { updateCharacterInState } from "../store/worldSlice";
import { showSnackbar } from "../store/uiSlice";
import {
    buildVitalsMigrationPatch,
    characterHasPersistedVitals,
    normalizeCharacterVitals,
} from "../utils/characterVitals";

/**
 * Read + persist vitals on `characters/{id}`.
 * Falls back to legacy `game.sessionPools.{characterId}` until migrated.
 */
export function usePersistedCharacterVitals(character, options = {}) {
    const { effortMax = 3, autoMigrate = true } = options;
    const dispatch = useDispatch();
    const sessionPoolEntry = useSelector((s) => (
        character?.id ? s.game?.sessionPools?.[character.id] ?? null : null
    ));
    const migratedRef = useRef(new Set());

    const vitals = useMemo(() => {
        if (!character) {
            return null;
        }
        return normalizeCharacterVitals(character, { effortMax, sessionPoolEntry });
    }, [character, effortMax, sessionPoolEntry]);

    const persistVitals = useCallback(async (partial) => {
        if (!character?.id || !partial || typeof partial !== "object") return false;
        try {
            await updateCharacterFields(character.id, partial);
            dispatch(updateCharacterInList({ id: character.id, data: partial }));
            dispatch(updateCharacterInState({
                id: character.id,
                locationId: character.locationId,
                data: partial,
            }));
            return true;
        } catch (err) {
            console.error("[usePersistedCharacterVitals] persist failed", err);
            dispatch(showSnackbar({ message: "No se pudieron guardar los vitals", severity: "error" }));
            return false;
        }
    }, [character, dispatch]);

    /** One-shot: copy legacy sessionPools → character doc (Zymthe-style chars). */
    useEffect(() => {
        if (!autoMigrate || !character?.id || characterHasPersistedVitals(character)) return;
        if (!sessionPoolEntry || migratedRef.current.has(character.id)) return;

        const patch = buildVitalsMigrationPatch(character, sessionPoolEntry, effortMax);
        if (!patch) return;

        migratedRef.current.add(character.id);
        persistVitals(patch).catch(() => {
            migratedRef.current.delete(character.id);
        });
    }, [autoMigrate, character, sessionPoolEntry, effortMax, persistVitals]);

    return { vitals, sessionPoolEntry, persistVitals, hasPersistedVitals: characterHasPersistedVitals(character) };
}
