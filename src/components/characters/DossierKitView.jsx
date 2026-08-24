import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import {
    createClaseDoc,
    deleteAbilityFromJob,
    linkAbilityToClase,
    listClasesForCampaign,
    upsertAbilityDoc,
} from "../../../firebase/services/classService";
import { useCharacterJobData } from "../../hooks/useCharacterJobData";
import { useResolvedCombatStats } from "../../hooks/useResolvedCombatStats";
import { useDossier } from "../CharactersSettingsDialog";
import { showSnackbar } from "../../store/uiSlice";
import { isDmRole } from "../../utils/tokenControl";
import {
    COMBAT_STAT_KEYS,
    DAMAGE_DIE_OPTIONS,
    classResourceForArchetype,
    combatDefaultsForArchetype,
    sanitizeClassResource,
    sanitizeCombatPartial,
} from "../../constants/combatStats";
import {
    ABILITY_KINDS,
    DEFAULT_ATTACK_CONTENT,
    TRAIT_CATEGORIES,
    TRAIT_CATEGORY_LABELS,
    TRAIT_CATEGORY_LIST,
    normalizeAbilityKind,
    normalizeTraitCategory,
    sanitizeTagKeys,
} from "../../constants/abilityKinds";
import { resolveCombatStats } from "../../utils/resolveCombatStats";
import AbilityCommandToolbar from "../abilities/AbilityCommandToolbar";
import CyberSelect from "../customs/CyberSelect";
import TagSearchSelect from "../admin/TagSearchSelect";
import { useCampaignTags } from "../../hooks/useCampaignTags";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import DossierInventoryView from "./DossierInventoryView";
import DossierSeamP3 from "./DossierSeamP3";
import PlateInsigniaDock from "./kit/PlateInsigniaDock";
import { ABILITY_TEXTAREA_SX } from "./kit/kitStyles";
import { subscribeCharacterItems } from "../../../firebase/services/itemService";
import { unlockNode } from "../../utils/kitProgression";
import KitAlignRail, { LoadoutPips, RailAddSlot, RailEditToggle } from "./kit/KitAlignRail";
import TraitCategoryRail from "./kit/TraitCategoryRail";
import AbilityVerticalMicro from "./kit/AbilityVerticalMicro";
import LbStackCompact from "./kit/LbStackCompact";

/* ── colour tokens ────────────────────────────────────────────────── */
const C = {
    border: UI_COLORS.border,
    text: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    pink: UI_COLORS.accent,
    cyan: UI_COLORS.anomaly,
    lb: "#ffcc33",
    trait: "#7dd3fc",
    danger: "#ff3355",
    glowC: "rgba(0,242,234,0.45)",
};

const MAX_LOADOUT = 6;

const STAT_META = {
    vit: { label: "VIT", accent: "#00f2ea" },
    defense: { label: "DEF", accent: "#00f2ea" },
    speed: { label: "SPD", accent: "#00f2ea" },
    fray: { label: "FRAY", accent: "#ff66ff" },
    damageDie: { label: "DIE", accent: "#ff66ff" },
    armor: { label: "ARM", accent: "#ffb020" },
    vigor: { label: "VIG", accent: "#b8ff3c" },
};

function slugify(label) {
    return String(label || "ability")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "ability";
}

function insertAtCursor(textarea, value, insert) {
    const el = textarea;
    if (!el) return `${value || ""}${insert}`;
    const start = el.selectionStart ?? (value || "").length;
    const end = el.selectionEnd ?? start;
    const next = `${(value || "").slice(0, start)}${insert}${(value || "").slice(end)}`;
    requestAnimationFrame(() => {
        try {
            el.focus();
            const pos = start + insert.length;
            el.setSelectionRange(pos, pos);
        } catch {
            /* ignore */
        }
    });
    return next;
}


const DRAFT_SELECT_SX = {
    mb: 1,
    width: "100%",
    boxSizing: "border-box",
    justifyContent: "space-between",
    bgcolor: "rgba(0,0,0,0.45)",
    border: `1px solid ${C.border}`,
    color: C.text,
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.72rem",
    px: "8px",
    py: "7px",
    borderRadius: "3px",
    minHeight: 32,
};

function NewItemDraft({
    tag,
    tagColor,
    onCommit,
    onCancel,
    showCommands = false,
    asAbility = false,
    asTrait = false,
    availableTags = null,
}) {
    const [label, setLabel] = useState("");
    const [blurb, setBlurb] = useState(asAbility ? DEFAULT_ATTACK_CONTENT : "");
    const [abilityKind, setAbilityKind] = useState(
        asAbility ? ABILITY_KINDS.ATTACK : ABILITY_KINDS.STANDARD,
    );
    const [traitCategory, setTraitCategory] = useState(TRAIT_CATEGORIES.SIMPLE);
    const [tagKeys, setTagKeys] = useState([]);
    const textRef = useRef(null);
    return (
        <Box sx={{
            p: "10px 12px",
            border: `1px dashed ${tagColor ? `${tagColor}99` : C.border}`,
            borderRadius: "4px",
            bgcolor: "rgba(0,0,0,0.38)",
        }}>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif", fontSize: "0.42rem", letterSpacing: "0.12em",
                color: tagColor || C.cyan, mb: 1,
            }}>
                NUEVO {tag}
            </Box>
            <Box
                component="input"
                value={label}
                placeholder="Nombre"
                onChange={(e) => setLabel(e.target.value)}
                sx={{
                    width: "100%", mb: 1, boxSizing: "border-box",
                    background: "rgba(0,0,0,0.45)", border: `1px solid ${C.border}`,
                    borderRadius: "4px", color: C.text, p: "8px",
                    fontFamily: "Orbitron, sans-serif", fontSize: "0.82rem", outline: "none",
                }}
            />
            {asAbility && (
                <CyberSelect
                    value={abilityKind}
                    aria-label="Ability kind"
                    options={[
                        { value: ABILITY_KINDS.STANDARD, label: "Standard" },
                        { value: ABILITY_KINDS.ATTACK, label: "Attack (d20 + boons)" },
                    ]}
                    triggerSx={DRAFT_SELECT_SX}
                    onChange={(next) => {
                        const kind = normalizeAbilityKind(next);
                        setAbilityKind(kind);
                        if (kind === ABILITY_KINDS.ATTACK && !blurb.trim()) {
                            setBlurb(DEFAULT_ATTACK_CONTENT);
                        }
                    }}
                />
            )}
            {asTrait && (
                <CyberSelect
                    value={traitCategory}
                    aria-label="Trait category"
                    options={TRAIT_CATEGORY_LIST.map((cat) => ({
                        value: cat,
                        label: TRAIT_CATEGORY_LABELS[cat],
                    }))}
                    triggerSx={DRAFT_SELECT_SX}
                    onChange={(next) => setTraitCategory(normalizeTraitCategory(next))}
                />
            )}
            {(asAbility || asTrait) && (
                <TagSearchSelect
                    available={availableTags || []}
                    value={tagKeys}
                    onChange={setTagKeys}
                />
            )}
            {showCommands && (
                <AbilityCommandToolbar
                    onInsert={(snip) => {
                        setBlurb((prev) => insertAtCursor(textRef.current, prev, snip));
                    }}
                />
            )}
            <Box
                component="textarea"
                ref={textRef}
                value={blurb}
                placeholder="Descripción…"
                rows={4}
                onChange={(e) => setBlurb(e.target.value)}
                sx={ABILITY_TEXTAREA_SX}
            />
            <Box sx={{ display: "flex", gap: 0.75, mt: 0.75 }}>
                <Box
                    component="button"
                    type="button"
                    onClick={() => onCommit({
                        label: label.trim() || `Nuevo ${tag}`,
                        blurb,
                        ...(asAbility ? {
                            abilityKind,
                            tagKeys: sanitizeTagKeys(tagKeys),
                        } : {}),
                        ...(asTrait ? {
                            traitCategory,
                            tagKeys: sanitizeTagKeys(tagKeys),
                        } : {}),
                    })}
                    sx={{
                        px: 1.25, py: 0.55, borderRadius: "4px",
                        border: `1px solid ${C.pink}`, bgcolor: `${C.pink}18`,
                        color: C.pink, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    CREAR
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={onCancel}
                    sx={{
                        px: 1.25, py: 0.55, borderRadius: "4px",
                        border: `1px solid ${C.border}`, bgcolor: "transparent",
                        color: C.muted, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    CANCELAR
                </Box>
            </Box>
        </Box>
    );
}

/* ── Create / propose job panel ───────────────────────────────────── */
function CreateJobPanel({ isDM, onCreate, onCancel }) {
    const [name, setName] = useState("");
    const [archetype, setArchetype] = useState("wright");
    const [stats, setStats] = useState(() => combatDefaultsForArchetype("wright"));
    const [resource, setResource] = useState(() => classResourceForArchetype("wright"));

    return (
        <Box sx={{
            mb: 2,
            p: "14px",
            borderRadius: "8px",
            border: `1px solid ${C.pink}`,
            bgcolor: `${C.pink}0c`,
        }}>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif", fontSize: "0.58rem", letterSpacing: "0.12em",
                color: C.pink, mb: 1.25,
            }}>
                {isDM ? "CREAR JOB" : "PROPONER JOB"}
            </Box>
            <Box
                component="input"
                value={name}
                placeholder="Nombre del job"
                onChange={(e) => setName(e.target.value)}
                sx={{
                    width: "100%", mb: 1, boxSizing: "border-box",
                    background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                    borderRadius: "6px", color: C.text, p: "8px 10px",
                    fontFamily: "Orbitron, sans-serif", fontSize: "0.82rem", outline: "none",
                }}
            />
            <CyberSelect
                value={archetype}
                aria-label="Class archetype"
                options={["stalwart", "vagabond", "mendicant", "wright"].map((a) => ({
                    value: a,
                    label: a.toUpperCase(),
                }))}
                triggerSx={{ ...DRAFT_SELECT_SX, mb: 1.25 }}
                onChange={(a) => {
                    setArchetype(a);
                    setStats(combatDefaultsForArchetype(a));
                    setResource(classResourceForArchetype(a));
                }}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75, mb: 1.25 }}>
                {COMBAT_STAT_KEYS.map((key) => (
                    <Box key={key}>
                        <Box sx={{ fontSize: "0.52rem", color: C.muted, fontFamily: "Orbitron, sans-serif", mb: 0.35 }}>
                            {STAT_META[key]?.label || key}
                        </Box>
                        {key === "damageDie" ? (
                            <CyberSelect
                                value={String(stats.damageDie ?? 6)}
                                aria-label="Damage die"
                                options={DAMAGE_DIE_OPTIONS.map((d) => ({ value: String(d), label: `d${d}` }))}
                                triggerSx={{
                                    width: "100%",
                                    bgcolor: "rgba(0,0,0,0.4)",
                                    border: `1px solid ${C.border}`,
                                    borderRadius: "4px",
                                    color: C.text,
                                    px: "6px",
                                    py: "6px",
                                    fontSize: "0.75rem",
                                    justifyContent: "space-between",
                                }}
                                onChange={(next) => setStats((s) => ({ ...s, damageDie: Number(next) }))}
                            />
                        ) : (
                            <Box
                                component="input"
                                type="number"
                                value={stats[key] ?? 0}
                                onChange={(e) => setStats((s) => ({ ...s, [key]: Number(e.target.value) }))}
                                sx={{
                                    width: "100%", boxSizing: "border-box",
                                    background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                    borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                                }}
                            />
                        )}
                    </Box>
                ))}
                <Box sx={{ gridColumn: "span 2" }}>
                    <Box sx={{ fontSize: "0.52rem", color: C.cyan, fontFamily: "Orbitron, sans-serif", mb: 0.35 }}>
                        CLASS RESOURCE
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Box
                            component="input"
                            value={resource.name}
                            onChange={(e) => setResource((r) => ({ ...r, name: e.target.value }))}
                            placeholder="Nombre"
                            sx={{
                                flex: 1, background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                            }}
                        />
                        <Box
                            component="input"
                            type="number"
                            value={resource.max ?? ""}
                            placeholder="max"
                            onChange={(e) => setResource((r) => ({
                                ...r,
                                max: e.target.value === "" ? null : Number(e.target.value),
                            }))}
                            sx={{
                                width: 64, background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                            }}
                        />
                    </Box>
                </Box>
            </Box>
            {!isDM && (
                <Box sx={{ fontSize: "0.75rem", color: C.muted, mb: 1, lineHeight: 1.4 }}>
                    Se enviará como propuesta al DM (status: proposed).
                </Box>
            )}
            <Box sx={{ display: "flex", gap: 0.75 }}>
                <Box
                    component="button"
                    type="button"
                    onClick={() => onCreate({
                        displayName: name.trim() || "Nuevo Job",
                        classArchetype: archetype,
                        combatStats: sanitizeCombatPartial(stats),
                        classResource: sanitizeClassResource(resource),
                    })}
                    sx={{
                        px: 1.5, py: 0.7, borderRadius: "6px",
                        border: `1px solid ${C.pink}`, bgcolor: `${C.pink}22`,
                        color: C.pink, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    {isDM ? "CREAR Y ASIGNAR" : "ENVIAR PROPUESTA"}
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={onCancel}
                    sx={{
                        px: 1.5, py: 0.7, borderRadius: "6px",
                        border: `1px solid ${C.border}`, bgcolor: "transparent",
                        color: C.muted, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    CANCELAR
                </Box>
            </Box>
        </Box>
    );
}

/* ── Main ─────────────────────────────────────────────────────────── */
export default function DossierKitView({ character, initialMaletinOpen = false }) {
    const dispatch = useDispatch();
    const { spawnPing, editMode, patchDraft } = useDossier();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const { tags: campaignTags } = useCampaignTags(campaignId);
    const isDM = isDmRole(profile?.role);
    const [reloadTick, setReloadTick] = useState(0);
    const { loading, classIds, jobList } = useCharacterJobData(character, reloadTick);
    const { combatStats, claseDoc } = useResolvedCombatStats(character, reloadTick);

    const activeClassId = character?.activeClassId || classIds[0] || null;
    const [focusClassId, setFocusClassId] = useState(activeClassId);
    const [campaignJobs, setCampaignJobs] = useState([]);
    const [showCreateJob, setShowCreateJob] = useState(false);
    const [draftTrait, setDraftTrait] = useState(false);
    const [draftAbility, setDraftAbility] = useState(false);
    const [kitEdit, setKitEdit] = useState(false);
    const [benchOpen, setBenchOpen] = useState(false);
    const [savingExtra, setSavingExtra] = useState(false);
    const [maletinOpen, setMaletinOpen] = useState(Boolean(initialMaletinOpen));
    const [maletinCount, setMaletinCount] = useState(0);
    const didSeedLoadout = useRef(false);
    const [abilityDrafts, setAbilityDrafts] = useState({});
    const abilityDraftsRef = useRef({});
    const persistPendingRef = useRef({});
    const persistTimersRef = useRef({});

    useEffect(() => {
        if (initialMaletinOpen) setMaletinOpen(true);
    }, [initialMaletinOpen]);

    useEffect(() => {
        if (!campaignId || !character?.id) {
            setMaletinCount(0);
            return undefined;
        }
        return subscribeCharacterItems(campaignId, character.id, (list) => {
            setMaletinCount(Array.isArray(list) ? list.length : 0);
        });
    }, [campaignId, character?.id]);

    useEffect(() => {
        setFocusClassId(activeClassId);
    }, [activeClassId]);

    useEffect(() => {
        if (!campaignId) {
            setCampaignJobs([]);
            return undefined;
        }
        let cancelled = false;
        listClasesForCampaign(campaignId).then((list) => {
            if (!cancelled) setCampaignJobs(list);
        }).catch(() => {
            if (!cancelled) setCampaignJobs([]);
        });
        return () => { cancelled = true; };
    }, [campaignId, reloadTick]);

    const currentLoadout = useMemo(() => {
        const raw = character?.loadout || character?.selectedAbilities || [];
        return Array.isArray(raw) ? raw : [];
    }, [character?.loadout, character?.selectedAbilities]);

    const [loadout, setLoadout] = useState(currentLoadout);
    useEffect(() => { setLoadout(currentLoadout); }, [currentLoadout]);

    const activeJob = useMemo(
        () => jobList.find((j) => j.classId === (focusClassId || activeClassId)) || jobList[0] || null,
        [jobList, focusClassId, activeClassId],
    );

    const overrides = character?.combatOverrides && typeof character.combatOverrides === "object"
        ? character.combatOverrides
        : {};

    const jobResourceDef = useMemo(() => {
        const fromDoc = sanitizeClassResource(claseDoc?.classResource);
        if (fromDoc) return fromDoc;
        const arch = claseDoc?.classArchetype || "wright";
        return classResourceForArchetype(arch);
    }, [claseDoc]);

    const jobDisplayName = String(
        claseDoc?.displayName || activeJob?.label || "",
    ).trim();

    const jobResourceValue = useMemo(() => {
        const map = character?.jobResources && typeof character.jobResources === "object"
            ? character.jobResources
            : {};
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId) return jobResourceDef.min ?? 0;
        const raw = map[jobId];
        if (raw == null || raw === "") return jobResourceDef.min ?? 0;
        const n = Number(raw);
        return Number.isFinite(n) ? n : (jobResourceDef.min ?? 0);
    }, [character?.jobResources, activeJob?.classId, focusClassId, activeClassId, jobResourceDef.min]);

    const lbKey = activeJob?.limitBreak?.key || activeJob?.limitBreak?.id || null;
    const lbUnlocked = Boolean(
        lbKey && Array.isArray(character?.unlockedAbilities) && character.unlockedAbilities.includes(lbKey),
    );

    const majorityOk = useCallback((nextLoadout, jobAbilityIds) => {
        if (!jobAbilityIds?.length) return true;
        const jobCount = nextLoadout.filter((id) => jobAbilityIds.includes(id)).length;
        const otherCount = nextLoadout.length - jobCount;
        return jobCount >= otherCount;
    }, []);

    const handleJobChip = (e, classId) => {
        spawnPing(e.clientX, e.clientY);
        setFocusClassId(classId);
        patchDraft({ activeClassId: classId });
    };

    const handleAssignJob = (jobId) => {
        if (!jobId) return;
        const assigned = Array.isArray(character?.assignedClassIds)
            ? [...character.assignedClassIds]
            : [];
        if (!assigned.includes(jobId)) assigned.push(jobId);
        patchDraft({ assignedClassIds: assigned, activeClassId: jobId });
        setFocusClassId(jobId);
    };

    const setOverride = (key, raw) => {
        const next = { ...overrides };
        if (raw === "" || raw == null) delete next[key];
        else {
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            next[key] = Math.floor(n);
        }
        const cleaned = sanitizeCombatPartial(next);
        const resolved = resolveCombatStats({ ...character, combatOverrides: cleaned }, claseDoc);
        patchDraft({ combatOverrides: cleaned, vit: resolved.vit });
    };

    const setJobResourceValue = (raw) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId) return;
        let n = Math.floor(Number(raw));
        if (!Number.isFinite(n)) return;
        const min = jobResourceDef.min ?? 0;
        const max = jobResourceDef.max;
        if (n < min) n = min;
        if (max != null && n > max) n = max;
        const next = {
            ...(character?.jobResources && typeof character.jobResources === "object"
                ? character.jobResources
                : {}),
            [jobId]: n,
        };
        patchDraft({ jobResources: next });
    };

    const handleCreateJob = async ({ displayName, classArchetype, combatStats: cs, classResource, specialMechanic, description }) => {
        if (!campaignId) return;
        setSavingExtra(true);
        try {
            const id = await createClaseDoc({
                campaignId,
                displayName,
                classArchetype,
                combatStats: cs,
                classResource: classResource || null,
                specialMechanic: specialMechanic || null,
                description: description || null,
                proposed: !isDM,
                proposedBy: profile?.uid || null,
            });
            const assigned = Array.isArray(character?.assignedClassIds)
                ? [...character.assignedClassIds]
                : [];
            if (!assigned.includes(id)) assigned.push(id);
            patchDraft({ assignedClassIds: assigned, activeClassId: id });
            setFocusClassId(id);
            setShowCreateJob(false);
            setReloadTick((t) => t + 1);
            dispatch(showSnackbar({
                message: isDM ? "Job creado y asignado" : "Propuesta de job enviada",
                severity: "success",
            }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo crear el job", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    const saveAbilityToActiveJob = async ({
        label,
        blurb,
        type,
        existingKey = null,
        abilityKind = null,
        tagKeys = null,
        traitCategory = null,
    }) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId) {
            dispatch(showSnackbar({ message: "Asigna un job primero", severity: "warning" }));
            return;
        }
        setSavingExtra(true);
        try {
            const key = existingKey
                || `${slugify(activeJob?.label || jobId)}-${slugify(label)}-${Date.now().toString(36).slice(-4)}`;
            const payload = {
                label,
                type,
                content: blurb || "",
                description: blurb || "",
            };
            if (type === "ability") {
                payload.abilityKind = normalizeAbilityKind(abilityKind);
            }
            if (type === "trait") {
                payload.traitCategory = normalizeTraitCategory(traitCategory);
            }
            if (tagKeys != null) {
                payload.tagKeys = sanitizeTagKeys(tagKeys);
            }
            await upsertAbilityDoc(key, payload);
            await linkAbilityToClase(jobId, key);
            setReloadTick((t) => t + 1);
            dispatch(showSnackbar({
                message: existingKey ? "Actualizado" : `${type} añadido al job`,
                severity: "success",
            }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo guardar", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    /* Over-6 is a warning, not a hard block (G9/loadout-warn) — Disable/Enable only touches loadout[]. */
    const handleAbilityToggle = useCallback((abilityId, jobAbilityIds) => {
        setLoadout((prev) => {
            const on = prev.includes(abilityId);
            let next;
            if (on) next = prev.filter((id) => id !== abilityId);
            else {
                next = [...prev, abilityId];
                if (!majorityOk(next, jobAbilityIds)) return prev;
            }
            if (character?.id) {
                updateCharacterFields(character.id, { loadout: next }).catch(console.error);
            }
            return next;
        });
    }, [character?.id, majorityOk]);

    const jobAbilityIds = useMemo(
        () => (activeJob?.abilities || []).map((a) => a.id),
        [activeJob],
    );

    /* Flat trait list — traitMode chip replaces the old traitCategory grouping/filter UI. */
    const activeTraits = useMemo(
        () => (activeJob?.traits || []).filter(Boolean),
        [activeJob?.traits],
    );

    /* G11 grandfather ctx — nodes already attached to a job/legacy list stay unlocked
     * even if a DM retroactively tags them with unlockCostAP, until the character
     * migrates to strict mode (see kitProgression.js). */
    const ownedBaseNodeIds = useMemo(() => {
        const ids = new Set();
        (character?.allAbilities || []).forEach((id) => ids.add(String(id)));
        (character?.unlockedAbilities || []).forEach((id) => ids.add(String(id)));
        jobList.forEach((j) => {
            j.abilities.forEach((a) => ids.add(String(a.id)));
            j.traits.forEach((t) => ids.add(String(t.id)));
            if (j.limitBreak) ids.add(String(j.limitBreak.id));
        });
        return [...ids];
    }, [character?.allAbilities, character?.unlockedAbilities, jobList]);

    const kitCtx = useMemo(() => ({ ownedBaseNodeIds }), [ownedBaseNodeIds]);

    const formulaCtx = useMemo(() => ({
        damageDie: combatStats?.damageDie,
        fray: combatStats?.fray,
        mechanicResource: jobResourceValue,
    }), [combatStats?.damageDie, combatStats?.fray, jobResourceValue]);

    const mergeAbilityDraft = useCallback((node) => {
        if (!node) return node;
        const key = node.key || node.id;
        const extra = abilityDrafts[key];
        return extra ? { ...node, ...extra } : node;
    }, [abilityDrafts]);

    /** Direct A+ field patch. React overlay via startTransition (never blocks typing);
     * Firestore write is debounced. Text fields already debounce before calling this. */
    const patchAbilityFields = useCallback((existingKey, patch) => {
        if (!existingKey || !patch) return;
        abilityDraftsRef.current = {
            ...abilityDraftsRef.current,
            [existingKey]: { ...abilityDraftsRef.current[existingKey], ...patch },
        };
        startTransition(() => {
            setAbilityDrafts(abilityDraftsRef.current);
        });
        persistPendingRef.current[existingKey] = {
            ...(persistPendingRef.current[existingKey] || {}),
            ...patch,
        };
        const prevTimer = persistTimersRef.current[existingKey];
        if (prevTimer) clearTimeout(prevTimer);
        persistTimersRef.current[existingKey] = setTimeout(async () => {
            const toWrite = persistPendingRef.current[existingKey];
            delete persistPendingRef.current[existingKey];
            delete persistTimersRef.current[existingKey];
            if (!toWrite) return;
            try {
                await upsertAbilityDoc(existingKey, toWrite);
            } catch (err) {
                console.error(err);
                dispatch(showSnackbar({ message: "No se pudo guardar", severity: "error" }));
            }
        }, 700);
    }, [dispatch]);

    useEffect(() => () => {
        Object.entries(persistPendingRef.current).forEach(([key, patch]) => {
            if (patch) upsertAbilityDoc(key, patch).catch(console.error);
        });
        Object.values(persistTimersRef.current).forEach((t) => clearTimeout(t));
    }, []);

    /** G9 delete — irreversible: removes the doc + unlinks it from the job, and
     * strips it from the local loadout so nothing dangles. */
    const handleDeleteAbility = useCallback(async (node) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        const key = node?.key || node?.id;
        if (!jobId || !key) return;
        setSavingExtra(true);
        try {
            await deleteAbilityFromJob(jobId, key);
            if (loadout.includes(key) && character?.id) {
                const nextLoadout = loadout.filter((id) => id !== key);
                setLoadout(nextLoadout);
                await updateCharacterFields(character.id, { loadout: nextLoadout });
            }
            setReloadTick((t) => t + 1);
            dispatch(showSnackbar({ message: "Eliminado", severity: "success" }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo eliminar", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    }, [activeJob?.classId, focusClassId, activeClassId, loadout, character?.id, dispatch]);

    /** G11 — spend AP to unlock a base node or a talent/mastery child. */
    const handleUnlockNode = useCallback(async (node) => {
        if (!character?.id) return;
        const patch = unlockNode(character, node, kitCtx);
        if (!patch) {
            dispatch(showSnackbar({ message: "No se puede desbloquear (AP insuficiente)", severity: "warning" }));
            return;
        }
        try {
            await updateCharacterFields(character.id, patch);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo desbloquear", severity: "error" }));
        }
    }, [character, kitCtx, dispatch]);

    const allAbilities = useMemo(() => {
        if (!activeJob) return [];
        const fromJob = activeJob.abilities.map((a) => ({ ...a, jobLabel: activeJob.label }));
        const others = jobList
            .filter((j) => j.classId !== activeJob.classId)
            .flatMap((j) => j.abilities.map((a) => ({ ...a, jobLabel: j.label })));
        const seen = new Set();
        return [...fromJob, ...others].filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }, [activeJob, jobList]);

    /* Preselect first 6 abilities when loadout is empty */
    useEffect(() => {
        if (loading || !character?.id || didSeedLoadout.current) return;
        if (currentLoadout.length > 0) {
            didSeedLoadout.current = true;
            return;
        }
        if (!allAbilities.length) return;
        didSeedLoadout.current = true;
        const first6 = allAbilities.slice(0, MAX_LOADOUT).map((a) => a.id);
        setLoadout(first6);
        updateCharacterFields(character.id, { loadout: first6 }).catch(console.error);
    }, [loading, character?.id, currentLoadout.length, allAbilities]);

    const loadoutAbilities = useMemo(
        () => loadout.map((id) => allAbilities.find((a) => a.id === id)).filter(Boolean),
        [loadout, allAbilities],
    );
    const benchAbilities = useMemo(
        () => allAbilities.filter((a) => !loadout.includes(a.id)),
        [allAbilities, loadout],
    );

    const colSx = {
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        overflowY: "auto",
        overflowX: "hidden",
        pt: "6px",
        ...CYBER_SCROLL_STYLE,
        "@media (max-width:960px)": { gridColumn: "1 / -1", height: "auto", maxHeight: "none" },
    };

    if (loading && !jobList.length) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <CircularProgress size={28} sx={{ color: C.cyan }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: "transparent", position: "relative" }}>
            <Box
                className="dialog-no-drag"
                sx={{
                    mx: "8px",
                    mt: "7px",
                    mb: "7px",
                    border: "1px solid rgba(255,102,255,0.32)",
                    borderRadius: "8px",
                    overflow: "visible",
                    background: "rgba(0,0,0,0.72)",
                    boxShadow: "none",
                }}
            >
                <DossierSeamP3 character={character} />
                <PlateInsigniaDock
                    character={character}
                    combatStats={combatStats}
                    overrides={overrides}
                    editMode={editMode}
                    onChangeStat={setOverride}
                    onChangeName={(name) => patchDraft({ name })}
                    onChangeLevel={(level) => patchDraft({ level })}
                    onChangeAp={(ap) => patchDraft({ ap })}
                    jobDisplayName={jobDisplayName}
                    jobs={jobList}
                    activeClassId={focusClassId || activeClassId}
                    onSelectJob={handleJobChip}
                    onAssignJob={handleAssignJob}
                    campaignJobs={campaignJobs}
                    kitEdit={kitEdit}
                    isDM={isDM}
                    onCreateJob={() => setShowCreateJob(true)}
                    resource={jobResourceDef}
                    resourceValue={jobResourceValue}
                    onChangeResourceValue={setJobResourceValue}
                    maletinOpen={maletinOpen}
                    maletinCount={maletinCount}
                    onToggleMaletin={() => setMaletinOpen((v) => !v)}
                />
            </Box>
            {kitEdit && showCreateJob && (
                <Box sx={{ px: "10px" }}>
                    <CreateJobPanel
                        isDM={isDM}
                        onCancel={() => setShowCreateJob(false)}
                        onCreate={handleCreateJob}
                    />
                </Box>
            )}

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                    px: "10px",
                    pt: "8px",
                    pb: "14px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                        gap: "10px",
                        alignItems: "stretch",
                        flex: 1,
                        minHeight: 0,
                        height: "100%",
                        "@media (max-width:960px)": {
                            gridTemplateColumns: "1fr",
                            overflowY: "auto",
                            height: "auto",
                            alignItems: "start",
                            ...CYBER_SCROLL_STYLE,
                        },
                    }}
                >
                    <Box sx={{ ...colSx, gridColumn: "span 3" }}>
                        <KitAlignRail
                            label="TRAITS"
                            end={kitEdit && !draftTrait ? (
                                <RailAddSlot title="Agregar trait" onClick={() => setDraftTrait(true)} />
                            ) : null}
                        />
                        {activeTraits.map((t) => (
                            <TraitCategoryRail
                                key={t.id}
                                trait={mergeAbilityDraft(t)}
                                character={character}
                                kitEdit={kitEdit}
                                kitCtx={kitCtx}
                                formulaCtx={formulaCtx}
                                campaignId={campaignId}
                                profile={profile}
                                availableTags={campaignTags}
                                onPatch={(patch) => patchAbilityFields(t.key || t.id, patch)}
                                onUnlockNode={handleUnlockNode}
                                onDelete={kitEdit ? () => handleDeleteAbility(t) : null}
                                onSave={({ label, blurb, tagKeys }) => saveAbilityToActiveJob({
                                    label,
                                    blurb,
                                    type: "trait",
                                    existingKey: t.key || t.id,
                                    tagKeys,
                                })}
                            />
                        ))}
                        {activeTraits.length === 0 && !draftTrait && (
                            <Box sx={{ fontSize: "0.75rem", color: C.muted, px: "6px" }}>Sin traits</Box>
                        )}
                        {draftTrait && (
                            <NewItemDraft
                                tag="TRAIT"
                                tagColor={C.trait}
                                asTrait
                                availableTags={campaignTags}
                                onCancel={() => setDraftTrait(false)}
                                onCommit={async (data) => {
                                    await saveAbilityToActiveJob({ ...data, type: "trait" });
                                    setDraftTrait(false);
                                }}
                            />
                        )}
                    </Box>

                    <Box sx={{ ...colSx, gridColumn: "span 6" }}>
                        <KitAlignRail
                            label="LOADOUT"
                            count={loadout.length}
                            max={MAX_LOADOUT}
                            over={loadout.length > MAX_LOADOUT}
                            end={(
                                <>
                                    <LoadoutPips count={loadout.length} max={MAX_LOADOUT} />
                                    <RailEditToggle on={kitEdit} onClick={() => setKitEdit((v) => !v)} />
                                    {kitEdit && !draftAbility && (
                                        <RailAddSlot title="Agregar habilidad" onClick={() => setDraftAbility(true)} />
                                    )}
                                </>
                            )}
                        />
                        {loadoutAbilities.map((ab) => (
                            <AbilityVerticalMicro
                                key={ab.id}
                                ability={mergeAbilityDraft(ab)}
                                kitEdit={kitEdit}
                                character={character}
                                kitCtx={kitCtx}
                                formulaCtx={formulaCtx}
                                campaignId={campaignId}
                                profile={profile}
                                availableTags={campaignTags}
                                onToggleLoadout={() => handleAbilityToggle(ab.id, jobAbilityIds)}
                                onSave={({ label, blurb, abilityKind, tagKeys }) => saveAbilityToActiveJob({
                                    label, blurb, type: "ability", existingKey: ab.key || ab.id,
                                    abilityKind, tagKeys,
                                })}
                                onPatch={(patch) => patchAbilityFields(ab.key || ab.id, patch)}
                                onUnlockNode={handleUnlockNode}
                                onDelete={() => handleDeleteAbility(ab)}
                            />
                        ))}
                        {loadoutAbilities.length === 0 && !draftAbility && (
                            <Box sx={{ fontSize: "0.75rem", color: C.muted, px: "6px" }}>Loadout vacío</Box>
                        )}
                        {draftAbility && (
                            <NewItemDraft
                                tag="ABILITY"
                                tagColor={C.cyan}
                                showCommands
                                asAbility
                                availableTags={campaignTags}
                                onCancel={() => setDraftAbility(false)}
                                onCommit={async (data) => {
                                    await saveAbilityToActiveJob({ ...data, type: "ability" });
                                    setDraftAbility(false);
                                }}
                            />
                        )}
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setBenchOpen((v) => !v)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                width: "100%",
                                height: 28,
                                px: "10px",
                                borderRadius: "5px",
                                border: "1px dashed rgba(255,255,255,0.16)",
                                bgcolor: "rgba(0,0,0,0.25)",
                                color: C.muted,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.4rem",
                                letterSpacing: "0.12em",
                                cursor: "pointer",
                            }}
                        >
                            <Box component="span" sx={{ transform: benchOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</Box>
                            BENCH · INACTIVE
                            <Box component="span" sx={{ ml: "auto", color: C.cyan }}>{benchAbilities.length}</Box>
                        </Box>
                        {benchOpen && benchAbilities.map((ab) => (
                            <AbilityVerticalMicro
                                key={ab.id}
                                ability={mergeAbilityDraft(ab)}
                                inactive
                                kitEdit={kitEdit}
                                character={character}
                                kitCtx={kitCtx}
                                formulaCtx={formulaCtx}
                                campaignId={campaignId}
                                profile={profile}
                                availableTags={campaignTags}
                                onToggleLoadout={() => handleAbilityToggle(ab.id, jobAbilityIds)}
                                onSave={({ label, blurb, abilityKind, tagKeys }) => saveAbilityToActiveJob({
                                    label, blurb, type: "ability", existingKey: ab.key || ab.id,
                                    abilityKind, tagKeys,
                                })}
                                onPatch={(patch) => patchAbilityFields(ab.key || ab.id, patch)}
                                onUnlockNode={handleUnlockNode}
                                onDelete={() => handleDeleteAbility(ab)}
                            />
                        ))}
                    </Box>

                    <Box sx={{ ...colSx, gridColumn: "span 3" }}>
                        <KitAlignRail
                            label="LIMIT BREAK"
                            variant={lbUnlocked ? "lb-ready" : "lb-locked"}
                            end={(
                                <Box sx={{
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.42rem",
                                    letterSpacing: "0.1em",
                                    color: lbUnlocked ? "#ffcc33" : "#ff3355",
                                }}>
                                    {lbUnlocked ? "READY" : "LOCKED"}
                                </Box>
                            )}
                        />
                        <LbStackCompact
                            limitBreak={mergeAbilityDraft(activeJob?.limitBreak) || null}
                            unlocked={lbUnlocked}
                            kitEdit={kitEdit && lbUnlocked}
                            character={character}
                            kitCtx={kitCtx}
                            formulaCtx={formulaCtx}
                            campaignId={campaignId}
                            profile={profile}
                            availableTags={campaignTags}
                            onSave={({ label, blurb, tagKeys }) => saveAbilityToActiveJob({
                                label,
                                blurb,
                                type: "ultimate",
                                existingKey: activeJob?.limitBreak?.key || activeJob?.limitBreak?.id,
                                tagKeys,
                            })}
                            onPatch={(patch) => patchAbilityFields(
                                activeJob?.limitBreak?.key || activeJob?.limitBreak?.id,
                                patch,
                            )}
                            onUnlockNode={handleUnlockNode}
                            onDelete={() => handleDeleteAbility(activeJob?.limitBreak)}
                        />
                    </Box>
                </Box>

                {savingExtra && (
                    <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                        <CircularProgress size={14} sx={{ color: C.cyan }} />
                        <Box sx={{ fontSize: "0.75rem", color: C.muted }}>Guardando…</Box>
                    </Box>
                )}
            </Box>

            <DossierInventoryView
                character={character}
                open={Boolean(maletinOpen)}
                onClose={() => setMaletinOpen(false)}
            />
        </Box>
    );
}
