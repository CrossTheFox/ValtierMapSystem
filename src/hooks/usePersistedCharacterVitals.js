import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Debounce window for batched Firestore vitals writes (HUD scrub / rapid clicks). */
const FIRESTORE_DEBOUNCE_MS = 350;

function mergeVitalsPatch(prev, partial) {
    if (!partial || typeof partial !== "object") return prev;
    const next = { ...(prev || {}) };
    for (const [key, value] of Object.entries(partial)) {
        if ((key === "effort" || key === "turn") && value && typeof value === "object") {
            next[key] = { ...(prev?.[key] || {}), ...value };
        } else {
            next[key] = value;
        }
    }
    return next;
}

function nestedEqual(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return a === b;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        if (a[key] !== b[key]) return false;
    }
    return true;
}

function mergeVitalsDisplay(base, overlay) {
    if (!overlay) return base;
    return {
        ...base,
        ...overlay,
        effort: overlay.effort
            ? { ...base.effort, ...overlay.effort }
            : base.effort,
        turn: overlay.turn
            ? { ...base.turn, ...overlay.turn }
            : base.turn,
    };
}

/** Drop overlay keys once Redux/base already matches, so dossier writes can win. */
function pruneAckedOverlay(base, overlay) {
    if (!overlay || !base) return overlay ?? null;
    const next = {};
    for (const [key, value] of Object.entries(overlay)) {
        if (key === "effort" || key === "turn") {
            const merged = { ...(base[key] || {}), ...(value || {}) };
            if (!nestedEqual(base[key], merged)) next[key] = value;
        } else if (base[key] !== value) {
            next[key] = value;
        }
    }
    return Object.keys(next).length ? next : null;
}

/**
 * Read + persist vitals on `characters/{id}`.
 *
 * **Pattern (canonical for HUD combat vitals):**
 * 1. Optimistic local overlay → instant UI
 * 2. Redux patch immediately → roster/world stay in sync
 * 3. Debounced Firestore write → durability without blocking scrubbing
 *
 * Falls back to legacy `game.sessionPools.{characterId}` until migrated.
 */
export function usePersistedCharacterVitals(character, options = {}) {
    const { effortMax = 3, autoMigrate = true } = options;
    const dispatch = useDispatch();
    const sessionPoolEntry = useSelector((s) => (
        character?.id ? s.game?.sessionPools?.[character.id] ?? null : null
    ));
    const migratedRef = useRef(new Set());
    const characterId = character?.id ?? null;

    const [localPatch, setLocalPatch] = useState(null);
    const pendingFirestoreRef = useRef(null);
    const firestoreTimerRef = useRef(null);
    const characterRef = useRef(character);
    characterRef.current = character;

    useEffect(() => {
        setLocalPatch(null);
        pendingFirestoreRef.current = null;
        if (firestoreTimerRef.current) {
            clearTimeout(firestoreTimerRef.current);
            firestoreTimerRef.current = null;
        }
    }, [characterId]);

    const baseVitals = useMemo(() => {
        if (!character) return null;
        return normalizeCharacterVitals(character, { effortMax, sessionPoolEntry });
    }, [character, effortMax, sessionPoolEntry]);

    const vitals = useMemo(
        () => (baseVitals ? mergeVitalsDisplay(baseVitals, localPatch) : null),
        [baseVitals, localPatch],
    );

    useEffect(() => {
        setLocalPatch((prev) => {
            const pruned = pruneAckedOverlay(baseVitals, prev);
            if (pruned == null && prev == null) return prev;
            if (pruned && prev && nestedEqual(pruned, prev)) return prev;
            return pruned;
        });
    }, [baseVitals]);

    const applyOptimisticRedux = useCallback((partial) => {
        const char = characterRef.current;
        if (!char?.id || !partial) return;
        dispatch(updateCharacterInList({ id: char.id, data: partial }));
        dispatch(updateCharacterInState({
            id: char.id,
            locationId: char.locationId,
            data: partial,
        }));
    }, [dispatch]);

    const flushFirestore = useCallback(async () => {
        firestoreTimerRef.current = null;
        const char = characterRef.current;
        const patch = pendingFirestoreRef.current;
        pendingFirestoreRef.current = null;
        if (!char?.id || !patch || !Object.keys(patch).length) return;

        try {
            await updateCharacterFields(char.id, patch);
        } catch (err) {
            console.error("[usePersistedCharacterVitals] persist failed", err);
            dispatch(showSnackbar({ message: "No se pudieron guardar los vitals", severity: "error" }));
        }
    }, [dispatch]);

    const scheduleFirestore = useCallback((partial) => {
        pendingFirestoreRef.current = mergeVitalsPatch(pendingFirestoreRef.current, partial);
        if (firestoreTimerRef.current) clearTimeout(firestoreTimerRef.current);
        firestoreTimerRef.current = setTimeout(flushFirestore, FIRESTORE_DEBOUNCE_MS);
    }, [flushFirestore]);

    /** Instant UI + Redux; Firestore debounced in background. */
    const persistVitals = useCallback((partial) => {
        if (!characterId || !partial || typeof partial !== "object") return;
        setLocalPatch((prev) => mergeVitalsPatch(prev, partial));
        applyOptimisticRedux(partial);
        scheduleFirestore(partial);
    }, [characterId, applyOptimisticRedux, scheduleFirestore]);

    /** Await Firestore immediately (flush pending + leave guard). */
    const flushSave = useCallback(async () => {
        if (firestoreTimerRef.current) {
            clearTimeout(firestoreTimerRef.current);
            firestoreTimerRef.current = null;
        }
        await flushFirestore();
    }, [flushFirestore]);

    useEffect(() => () => {
        if (firestoreTimerRef.current) clearTimeout(firestoreTimerRef.current);
    }, []);

    /** One-shot: copy legacy sessionPools → character doc (Zymthe-style chars). */
    useEffect(() => {
        if (!autoMigrate || !characterId || characterHasPersistedVitals(character)) return;
        if (!sessionPoolEntry || migratedRef.current.has(characterId)) return;

        const patch = buildVitalsMigrationPatch(character, sessionPoolEntry, effortMax);
        if (!patch) return;

        migratedRef.current.add(characterId);
        persistVitals(patch);
    }, [autoMigrate, character, characterId, sessionPoolEntry, effortMax, persistVitals]);

    return {
        vitals,
        sessionPoolEntry,
        persistVitals,
        flushSave,
        hasPersistedVitals: characterHasPersistedVitals(character),
    };
}

/**
 * Merge player sheet stub over world character without clobbering live vitals.
 * World (charactersById) receives HUD writes; sheet list can lag behind fetch.
 */
export function mergeHudCharacter(base, sheet, extras = {}) {
    if (!base) return null;
    if (!sheet) return { ...base, ...extras, burdens: extras.burdens ?? base.burdens };

    const merged = {
        ...base,
        ...sheet,
        ...extras,
        imageUrl: sheet.imageUrl || base.imageUrl || null,
        tokenImageUrl: sheet.tokenImageUrl || base.tokenImageUrl || null,
        tokenCrop: sheet.tokenCrop || base.tokenCrop || null,
    };

    if (Number.isFinite(Number(base.hpCur))) merged.hpCur = base.hpCur;
    if (Number.isFinite(Number(base.vigor))) merged.vigor = base.vigor;
    if (Number.isFinite(Number(base.vit))) merged.vit = base.vit;
    if (typeof base.hpBroken === "boolean") merged.hpBroken = base.hpBroken;
    if (base.effort != null && typeof base.effort === "object") merged.effort = base.effort;
    if (base.turn != null && typeof base.turn === "object") merged.turn = base.turn;
    if (Array.isArray(base.conditions)) merged.conditions = base.conditions;

    return merged;
}
