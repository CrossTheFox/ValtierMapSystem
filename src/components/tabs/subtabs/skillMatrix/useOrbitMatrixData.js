import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { getAbilitiesByIds, updateCharacterFields } from "../../../../../firebase/services/characterService";
import { getClaseDocsByIds, getAbilityKeysForClase } from "../../../../../firebase/services/classService";
import { updateCharacterInList } from "../../../../store/characterSlice";
import { buildTreeData, findClassRootFromList, useSkillMatrixAbilities } from "./skillMatrixUtils";
import {
    archGlow,
    BASE_BISECTORS_BY_COUNT,
    buildWheelModel,
    HALF_SPAN_BY_COUNT,
    layoutSectorBranch,
    normalizeDeg,
    orbitGuideMeta,
    sectorLabel,
} from "./orbitLayoutEngine";

/**
 * Datos de órbita compartidos entre la constelación SVG y la vista Pixi.
 * Los bisectores son **solo** en espacio rueda (sin `spinDeg`); la rotación la aplica el contenedor.
 *
 * @param {Record<string, unknown>} character
 * @param {number} layoutView — lado del cuadrado lógico (px) para geometría
 * @param {{ singleJob?: boolean, focusClassId?: string|null }} [opts]
 *   singleJob: una órbita 360° por job (no gajos multiclass). focusClassId selecciona el job.
 */
export function useOrbitMatrixData(character, layoutView, opts = {}) {
    const singleJob = opts.singleJob !== false; // default: per-job full orbit
    const focusClassIdOpt = opts.focusClassId ?? null;
    const dispatch = useDispatch();
    const { loading: legLoad, allAbilities: legAll, treeData: legTree } = useSkillMatrixAbilities(character);
    const [mcLoading, setMcLoading] = useState(true);
    const [mcPayload, setMcPayload] = useState(null);

    const wheelModel = useMemo(() => buildWheelModel(character), [character?.assignedClassIds, character?.activeClassId]);
    const { mode, ids, jobCount, activeClassId, activeIdx } = wheelModel;

    const focusClassId = useMemo(() => {
        if (focusClassIdOpt && ids.includes(focusClassIdOpt)) return focusClassIdOpt;
        if (activeClassId && ids.includes(activeClassId)) return activeClassId;
        return ids[0] || null;
    }, [focusClassIdOpt, activeClassId, ids]);

    const assignedKey = Array.isArray(character?.assignedClassIds) ? character.assignedClassIds.join(",") : "";
    const activeKey = character?.activeClassId || "";

    const geom = useMemo(() => {
        const view = Math.max(240, layoutView);
        const cx = view / 2;
        const cy = view / 2;
        // Leave room for outer node radius (~23px) + stroke so rings are not clipped
        const rOut = Math.max(90, view * 0.5 - 32);
        return { view, cx, cy, rOut };
    }, [layoutView]);

    useEffect(() => {
        let cancelled = false;
        if (mode !== "multiclass" || !assignedKey) {
            setMcPayload(null);
            setMcLoading(false);
            return;
        }

        async function run() {
            setMcLoading(true);
            try {
                const idList = character.assignedClassIds;
                const meta = await getClaseDocsByIds(idList);
                const metaById = Object.fromEntries(meta.map((m) => [m.id, m]));
                const keysList = await Promise.all(idList.map((id) => getAbilityKeysForClase(id)));
                const keysByClassId = Object.fromEntries(idList.map((id, i) => [id, keysList[i] || []]));
                const uniq = [...new Set(Object.values(keysByClassId).flat())];
                const abs = uniq.length ? await getAbilitiesByIds(uniq) : [];
                const byKey = Object.fromEntries(abs.map((a) => [a.key || a.id, a]));
                if (!cancelled) setMcPayload({ metaById, byKey, keysByClassId });
            } catch {
                if (!cancelled) setMcPayload(null);
            } finally {
                if (!cancelled) setMcLoading(false);
            }
        }
        run();
        return () => {
            cancelled = true;
        };
    }, [character?.id, assignedKey, activeKey, mode, character?.assignedClassIds]);

    const unlocked = character?.unlockedAbilities;
    const checkU = useCallback((key) => unlocked?.includes(key), [unlocked]);

    const halfSpan = singleJob ? 180 : (HALF_SPAN_BY_COUNT[jobCount] ?? 60);
    const bases = singleJob
        ? [-90]
        : (BASE_BISECTORS_BY_COUNT[jobCount] || BASE_BISECTORS_BY_COUNT[3]);

    const sectorLayouts = useMemo(() => {
        const out = [];
        const { cx, cy, rOut } = geom;
        void cx;
        void cy;
        void rOut;

        if (mode === "multiclass") {
            if (!mcPayload?.byKey || !mcPayload.keysByClassId) return null;
            const { metaById, byKey, keysByClassId } = mcPayload;

            // One full 360° orbit for the focused job only
            if (singleJob && focusClassId) {
                const classId = focusClassId;
                const slotIndex = Math.max(0, ids.indexOf(classId));
                const bis = -90;
                const span = 180;
                const keys = keysByClassId[classId] || [];
                const laneAbs = keys.map((k) => byKey[k]).filter(Boolean);
                const meta = metaById[classId] || {};
                const accent = archGlow(meta.classArchetype);
                if (!laneAbs.length) {
                    return [{
                        slotIndex,
                        classId,
                        bis,
                        halfSpan: span,
                        label: "JOB",
                        accent: "rgba(255,255,255,0.2)",
                        displayName: (meta.displayName || classId).toString(),
                        isActive: true,
                        empty: true,
                    }];
                }
                const root = findClassRootFromList(laneAbs);
                const tree = buildTreeData(laneAbs, unlocked);
                const layout = layoutSectorBranch(bis, span, tree, root, accent, laneAbs, geom);
                return [{
                    slotIndex,
                    classId,
                    bis,
                    halfSpan: span,
                    label: "JOB",
                    accent,
                    displayName: (meta.displayName || classId).toString(),
                    isActive: true,
                    layout,
                    empty: false,
                }];
            }

            for (let i = 0; i < jobCount; i++) {
                const classId = ids[i];
                const bis = normalizeDeg(bases[i] ?? -90);
                const keys = keysByClassId[classId] || [];
                const laneAbs = keys.map((k) => byKey[k]).filter(Boolean);
                if (!laneAbs.length) {
                    out.push({
                        slotIndex: i,
                        classId,
                        bis,
                        halfSpan,
                        label: sectorLabel(i, jobCount, classId === activeClassId),
                        accent: "rgba(255,255,255,0.2)",
                        displayName: classId,
                        isActive: classId === activeClassId,
                        empty: true,
                    });
                    continue;
                }
                const root = findClassRootFromList(laneAbs);
                const tree = buildTreeData(laneAbs, unlocked);
                const meta = metaById[classId] || {};
                const accent = archGlow(meta.classArchetype);
                const layout = layoutSectorBranch(bis, halfSpan, tree, root, accent, laneAbs, geom);
                const isActive = classId === activeClassId;
                out.push({
                    slotIndex: i,
                    classId,
                    bis,
                    halfSpan,
                    label: sectorLabel(i, jobCount, isActive),
                    accent,
                    displayName: (meta.displayName || classId).toString(),
                    isActive,
                    layout,
                    empty: false,
                });
            }
            return out;
        }

        if (!legTree) return null;

        const root = findClassRootFromList(legAll);
        const accent = archGlow(root?.classArchetype);
        const bis = -90;
        const span = singleJob ? 180 : 90;
        const layout = layoutSectorBranch(bis, span, legTree, root, accent, legAll, geom);
        return [
            {
                slotIndex: 0,
                classId: null,
                bis,
                halfSpan: span,
                label: "JOB",
                accent,
                displayName: (character?.name || "PERSONAJE").toString().toUpperCase(),
                isActive: true,
                layout,
                empty: false,
            },
        ];
    }, [
        mode, mcPayload, ids, jobCount, activeClassId, legTree, legAll, unlocked,
        character?.name, geom, halfSpan, bases, singleJob, focusClassId,
    ]);

    const guideMeta = useMemo(() => orbitGuideMeta(geom), [geom]);

    const onActiveJobSelect = useCallback(
        async (classId) => {
            if (!character?.id || !classId || classId === activeClassId) return;
            try {
                await updateCharacterFields(character.id, { activeClassId: classId });
                dispatch(updateCharacterInList({ id: character.id, data: { activeClassId: classId } }));
            } catch (e) {
                console.error(e);
            }
        },
        [character?.id, activeClassId, dispatch]
    );

    const loading = mode === "multiclass" ? mcLoading || legLoad : legLoad;

    return {
        wheelModel,
        geom,
        guideMeta,
        halfSpan,
        bases,
        sectorLayouts,
        mcPayload,
        mcLoading,
        legLoad,
        loading,
        checkU,
        onActiveJobSelect,
        mode,
        ids,
        jobCount,
        activeClassId,
        activeIdx,
        singleJob,
        focusClassId,
    };
}
