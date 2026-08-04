import { useEffect, useMemo, useState } from "react";
import { getAbilitiesByIds } from "../../firebase/services/characterService";
import { getAbilityKeysForClase, getClaseDocsByIds } from "../../firebase/services/classService";
import { formatClassLabel } from "../constants/characterSheetTokens";
import { archGlow } from "../components/tabs/subtabs/skillMatrix/orbitLayoutEngine";
import { normalizeTraitCategory } from "../constants/abilityKinds";

/**
 * Shared Firebase loader for job / class data.
 * Used by DossierKitView and SkillMatrixNeuralMesh.
 *
 * Firestore ability docs use `type`:
 *   class_root | trait | ability | upgrade | mastery | ultimate
 * Upgrades/masteries attach via `parentId` → parent ability key.
 *
 * Returns:
 * {
 *   loading: boolean,
 *   classIds: string[],
 *   jobList: Array<{
 *     classId, label, accent,
 *     abilities: Array<{ id, key, label, blurb, talents, mastery }>,
 *     traits:    Array<{ id, key, label, blurb }>,
 *     limitBreak: { id, key, label, blurb } | null,
 *   }>,
 * }
 */
export function useCharacterJobData(character, reloadKey = 0) {
    const assignedKey = Array.isArray(character?.assignedClassIds)
        ? character.assignedClassIds.filter(Boolean).join(",")
        : "";

    const classIds = useMemo(
        () => (assignedKey ? assignedKey.split(",") : []),
        [assignedKey]
    );

    const [loading, setLoading] = useState(true);
    const [payload, setPayload] = useState(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                if (classIds.length) {
                    const [meta, keysList] = await Promise.all([
                        getClaseDocsByIds(classIds),
                        Promise.all(classIds.map((id) => getAbilityKeysForClase(id))),
                    ]);
                    const metaById = Object.fromEntries(meta.map((m) => [m.id, m]));
                    const keysByClassId = Object.fromEntries(classIds.map((id, i) => [id, keysList[i] || []]));
                    const uniq = [...new Set(Object.values(keysByClassId).flat())];
                    const abs = uniq.length ? await getAbilitiesByIds(uniq) : [];
                    const byKey = Object.fromEntries(abs.map((a) => [a.key || a.id, a]));
                    if (!cancelled) setPayload({ mode: "multiclass", metaById, byKey, keysByClassId });
                } else {
                    const ids =
                        Array.isArray(character?.allAbilities) && character.allAbilities.length
                            ? character.allAbilities
                            : Array.isArray(character?.unlockedAbilities)
                              ? character.unlockedAbilities
                              : [];
                    const abs = ids.length ? await getAbilitiesByIds(ids) : [];
                    if (!cancelled) setPayload({ mode: "legacy", abilities: abs });
                }
            } catch (e) {
                console.error("[useCharacterJobData]", e);
                if (!cancelled) setPayload(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [character?.id, assignedKey, classIds, character?.allAbilities, character?.unlockedAbilities, reloadKey]);

    /** Build a normalized job list from the raw payload */
    const jobList = useMemo(() => {
        if (!payload) return [];
        if (payload.mode === "legacy") {
            return [buildJobFromAbilities(payload.abilities || [], {
                classId: null,
                label: "JOB",
                accent: "#ff66ff",
            })];
        }
        return classIds.map((cid) => {
            const meta = payload.metaById?.[cid];
            const keys = payload.keysByClassId?.[cid] || [];
            const rawAbs = keys.map((k) => payload.byKey[k]).filter(Boolean);
            const label =
                (meta?.displayName && String(meta.displayName).toUpperCase()) ||
                formatClassLabel(cid, "") ||
                cid.toUpperCase();
            const accent = archGlow(meta?.classArchetype) || "#ff66ff";
            return buildJobFromAbilities(rawAbs, { classId: cid, label, accent });
        });
    }, [payload, classIds]);

    return { loading, classIds, jobList };
}

/**
 * Partition flat ability docs by `type` and nest upgrades/masteries under their parent ability.
 * Same taxonomy as skillMatrixUtils / neuralMeshLayout.
 */
function buildJobFromAbilities(rawAbs, { classId, label, accent }) {
    const byParent = new Map();
    for (const a of rawAbs) {
        const pid = a?.parentId;
        if (!pid) continue;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(a);
    }

    const traits = rawAbs
        .filter((a) => a.type === "trait")
        .map(normalizeTrait)
        .filter(Boolean);

    const limitRaw = rawAbs.find((a) => a.type === "ultimate" || a.isLimitBreak || a.kind === "limitbreak");
    const limitBreak = limitRaw ? normalizeLeaf(limitRaw) : null;

    const abilities = rawAbs
        .filter((a) => a.type === "ability")
        .map((ab) => {
            const kids = byParent.get(ab.key || ab.id) || [];
            const talents = kids
                .filter((x) => x.type === "upgrade")
                .slice(0, 2)
                .map(normalizeTalent)
                .filter(Boolean);
            const masteryRaw = kids.find((x) => x.type === "mastery") || null;
            const mastery = masteryRaw ? normalizeTalent(masteryRaw) : null;
            return {
                ...normalizeLeaf(ab),
                talents,
                mastery,
            };
        })
        .filter(Boolean);

    return { classId, label, accent, abilities, traits, limitBreak };
}

/* ── Normalizers ─────────────────────────────────────────────────── */

function normalizeLeaf(raw) {
    if (!raw) return null;
    return {
        id:    raw.id || raw.key || "",
        key:   raw.key || raw.id || "",
        label: (raw.label || raw.displayName || raw.name || raw.key || "").toUpperCase(),
        blurb: raw.content || raw.description || raw.text || raw.blurb || raw.summary || "",
        abilityKind: String(raw.abilityKind || "").toLowerCase() === "attack" ? "attack" : "standard",
        tagKeys: Array.isArray(raw.tagKeys) ? raw.tagKeys.map(String).filter(Boolean) : [],
        traitCategory: normalizeTraitCategory(raw.traitCategory),
    };
}

function normalizeTalent(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return { id: raw, label: raw.toUpperCase(), blurb: "" };
    return normalizeLeaf(raw);
}

function normalizeTrait(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return { id: raw, label: raw.toUpperCase(), blurb: "" };
    return normalizeLeaf(raw);
}
