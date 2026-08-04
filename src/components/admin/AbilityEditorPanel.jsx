import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useDispatch } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { CyberInput, CyberButton } from "../customs/CyberInputs";
import AbilityCommandToolbar from "../abilities/AbilityCommandToolbar";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    COMBAT_STAT_KEYS,
    DAMAGE_DIE_OPTIONS,
    sanitizeCombatPartial,
    sanitizeClassResource,
    sanitizeSpecialMechanic,
    combatDefaultsForArchetype,
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
import { useCampaignTags } from "../../hooks/useCampaignTags";
import TagSearchSelect from "./TagSearchSelect";
import { showSnackbar } from "../../store/uiSlice";
import {
    createClaseDoc,
    getAbilityKeysForClase,
    listClasesForCampaign,
    linkAbilityToClase,
    updateClaseFields,
    upsertAbilityDoc,
} from "../../../firebase/services/classService";
import { getAbilitiesByIds } from "../../../firebase/services/characterService";

const ABILITY_TYPES = ["ability", "trait", "upgrade", "mastery", "ultimate", "class_root"];
const DETAIL_TABS = ["Stats", "Abilities", "Traits"];

function slugify(label) {
    return String(label || "ability")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || "ability";
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

/**
 * Master/Detail GM editor: job list + combat stats / abilities.
 */
export default function AbilityEditorPanel({ campaignId, initialJobId = null }) {
    const dispatch = useDispatch();
    const contentRef = useRef(null);

    const [jobs, setJobs] = useState([]);
    const [jobId, setJobId] = useState(initialJobId || "");
    const [abilities, setAbilities] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [loadingAbs, setLoadingAbs] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detailTab, setDetailTab] = useState("Stats");

    const [combatForm, setCombatForm] = useState(() => combatDefaultsForArchetype("wright"));
    const [archetype, setArchetype] = useState("wright");
    const [displayName, setDisplayName] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [resourceForm, setResourceForm] = useState({ name: "AETHER", min: 0, max: 6 });
    const [mechanicForm, setMechanicForm] = useState({ name: "", text: "" });

    const [selectedKey, setSelectedKey] = useState("");
    const [draft, setDraft] = useState({
        label: "",
        type: "ability",
        abilityKind: ABILITY_KINDS.STANDARD,
        traitCategory: TRAIT_CATEGORIES.SIMPLE,
        content: "",
        cost: "",
        tagKeys: [],
    });
    const [isNew, setIsNew] = useState(false);
    const [traitListFilter, setTraitListFilter] = useState(null);
    const { tags: campaignTags } = useCampaignTags(campaignId);

    const selectedJob = useMemo(
        () => jobs.find((j) => j.id === jobId) || null,
        [jobs, jobId],
    );

    const filteredAbs = useMemo(() => {
        if (detailTab === "Traits") {
            let list = abilities.filter((a) => String(a.type || "").toLowerCase() === "trait");
            if (traitListFilter) {
                list = list.filter(
                    (a) => normalizeTraitCategory(a.traitCategory) === traitListFilter,
                );
            }
            list.sort((a, b) => {
                const ca = TRAIT_CATEGORY_LIST.indexOf(normalizeTraitCategory(a.traitCategory));
                const cb = TRAIT_CATEGORY_LIST.indexOf(normalizeTraitCategory(b.traitCategory));
                if (ca !== cb) return ca - cb;
                return String(a.label || a.id).localeCompare(String(b.label || b.id));
            });
            return list;
        }
        if (detailTab === "Abilities") {
            return abilities.filter((a) => String(a.type || "").toLowerCase() !== "trait");
        }
        return abilities;
    }, [abilities, detailTab, traitListFilter]);

    const reloadJobs = useCallback(async () => {
        if (!campaignId) {
            setJobs([]);
            return;
        }
        setLoadingJobs(true);
        try {
            const list = await listClasesForCampaign(campaignId);
            setJobs(list);
            setJobId((prev) => {
                if (prev && list.some((j) => j.id === prev)) return prev;
                if (initialJobId && list.some((j) => j.id === initialJobId)) return initialJobId;
                return list[0]?.id || "";
            });
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudieron cargar jobs", severity: "error" }));
        } finally {
            setLoadingJobs(false);
        }
    }, [campaignId, dispatch, initialJobId]);

    useEffect(() => {
        reloadJobs();
    }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (initialJobId) setJobId(initialJobId);
    }, [initialJobId]);

    useEffect(() => {
        if (!selectedJob) return;
        setDisplayName(selectedJob.displayName || selectedJob.id || "");
        setJobDescription(String(selectedJob.description || ""));
        const arch = String(selectedJob.classArchetype || "wright").toLowerCase();
        setArchetype(arch);
        setCombatForm({
            ...combatDefaultsForArchetype(arch),
            ...sanitizeCombatPartial(selectedJob.combatStats),
        });
        const cr = sanitizeClassResource(selectedJob.classResource);
        setResourceForm(cr || { name: "AETHER", min: 0, max: 6 });
        const sm = sanitizeSpecialMechanic(selectedJob.specialMechanic);
        setMechanicForm(sm || { name: "", text: "" });
    }, [selectedJob?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const reloadAbilities = useCallback(async () => {
        if (!jobId) {
            setAbilities([]);
            return;
        }
        setLoadingAbs(true);
        try {
            const keys = await getAbilityKeysForClase(jobId);
            const list = keys.length ? await getAbilitiesByIds(keys) : [];
            list.sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));
            setAbilities(list);
        } catch (err) {
            console.error(err);
            setAbilities([]);
        } finally {
            setLoadingAbs(false);
        }
    }, [jobId]);

    useEffect(() => {
        reloadAbilities();
        setSelectedKey("");
        setIsNew(false);
    }, [jobId, reloadAbilities]);

    useEffect(() => {
        if (!selectedKey || isNew) return;
        const ab = abilities.find((a) => a.id === selectedKey || a.key === selectedKey);
        if (!ab) return;
        setDraft({
            label: ab.label || "",
            type: ab.type || "ability",
            abilityKind: normalizeAbilityKind(ab.abilityKind),
            traitCategory: normalizeTraitCategory(ab.traitCategory),
            content: ab.content || ab.description || "",
            cost: ab.cost || "",
            tagKeys: sanitizeTagKeys(ab.tagKeys),
        });
    }, [selectedKey, abilities, isNew]);

    const handleCreateJob = async () => {
        if (!campaignId) return;
        setSaving(true);
        try {
            const id = await createClaseDoc({
                campaignId,
                displayName: "Nuevo Job",
                classArchetype: "wright",
                combatStats: combatDefaultsForArchetype("wright"),
            });
            dispatch(showSnackbar({ message: "Job creado", severity: "success" }));
            await reloadJobs();
            setJobId(id);
            setDetailTab("Stats");
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "Error al crear job", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveJobCombat = async () => {
        if (!jobId) return;
        setSaving(true);
        try {
            await updateClaseFields(jobId, {
                displayName: displayName || selectedJob?.displayName || jobId,
                classArchetype: archetype,
                combatStats: sanitizeCombatPartial(combatForm),
                classResource: sanitizeClassResource(resourceForm),
                specialMechanic: sanitizeSpecialMechanic(mechanicForm),
                description: jobDescription,
            });
            dispatch(showSnackbar({ message: "Combat stats del job guardados", severity: "success" }));
            await reloadJobs();
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "Error al guardar job", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    const handleNewAbility = (asTrait = false) => {
        setIsNew(true);
        setSelectedKey("");
        setDetailTab(asTrait ? "Traits" : "Abilities");
        setDraft({
            label: asTrait ? "Nuevo trait" : "Nueva habilidad",
            type: asTrait ? "trait" : "ability",
            abilityKind: asTrait ? ABILITY_KINDS.STANDARD : ABILITY_KINDS.ATTACK,
            traitCategory: TRAIT_CATEGORIES.SIMPLE,
            content: asTrait ? "" : DEFAULT_ATTACK_CONTENT,
            cost: "",
            tagKeys: [],
        });
    };

    const handleSaveAbility = async () => {
        if (!jobId) return;
        const label = draft.label?.trim() || "Ability";
        const key = isNew
            ? `${slugify(displayName || jobId)}-${slugify(label)}-${Date.now().toString(36).slice(-4)}`
            : selectedKey;
        if (!key) return;
        setSaving(true);
        try {
            const kind = draft.type === "ability"
                ? normalizeAbilityKind(draft.abilityKind)
                : ABILITY_KINDS.STANDARD;
            const payload = {
                label,
                type: draft.type || "ability",
                abilityKind: kind,
                content: draft.content || "",
                cost: draft.cost || "",
                tagKeys: sanitizeTagKeys(draft.tagKeys),
                classArchetype: archetype,
            };
            if (draft.type === "trait") {
                payload.traitCategory = normalizeTraitCategory(draft.traitCategory);
            }
            await upsertAbilityDoc(key, payload);
            await linkAbilityToClase(jobId, key);
            dispatch(showSnackbar({ message: "Ability guardada", severity: "success" }));
            setIsNew(false);
            setSelectedKey(key);
            await reloadAbilities();
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "Error al guardar ability", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    if (!campaignId) {
        return <CyberText sx={{ color: UI_COLORS.textSecondary }}>Sin campaña activa.</CyberText>;
    }

    return (
        <Box sx={{ display: "flex", height: "100%", minHeight: 0, gap: 0, border: `1px solid ${UI_COLORS.border}`, borderRadius: 1, overflow: "hidden" }}>
            {/* Master list */}
            <Box
                sx={{
                    width: 240,
                    flexShrink: 0,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                    bgcolor: `${UI_COLORS.backgroundPrimary}aa`,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <Box sx={{ p: 1.25, borderBottom: `1px solid ${UI_COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, letterSpacing: "0.1em" }}>
                        JOBS
                    </CyberTitle>
                    <Box
                        component="button"
                        type="button"
                        onClick={handleCreateJob}
                        disabled={saving}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.4,
                            px: 0.85,
                            py: 0.4,
                            borderRadius: 0.75,
                            border: `1px solid ${UI_COLORS.accent}`,
                            bgcolor: `${UI_COLORS.accent}14`,
                            color: UI_COLORS.accent,
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.52rem",
                            letterSpacing: "0.06em",
                            cursor: "pointer",
                        }}
                    >
                        <AddIcon sx={{ fontSize: "0.85rem" }} /> Job
                    </Box>
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", ...CYBER_SCROLL_STYLE }}>
                    {loadingJobs ? (
                        <Box sx={{ p: 2 }}><CircularProgress size={20} sx={{ color: UI_COLORS.accent }} /></Box>
                    ) : jobs.length === 0 ? (
                        <CyberText sx={{ p: 2, fontSize: "0.7rem", color: UI_COLORS.textSecondary }}>
                            // Sin jobs — crea uno
                        </CyberText>
                    ) : (
                        jobs.map((j) => {
                            const active = j.id === jobId;
                            const die = j.combatStats?.damageDie;
                            return (
                                <Box
                                    key={j.id}
                                    onClick={() => setJobId(j.id)}
                                    sx={{
                                        px: 1.5,
                                        py: 1.1,
                                        cursor: "pointer",
                                        borderLeft: `3px solid ${active ? UI_COLORS.anomaly : "transparent"}`,
                                        bgcolor: active ? `${UI_COLORS.anomaly}12` : "transparent",
                                        "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                                    }}
                                >
                                    <CyberText sx={{ fontSize: "0.72rem", color: active ? UI_COLORS.anomaly : UI_COLORS.textPrimary, fontWeight: 600 }}>
                                        {j.displayName || j.id}
                                    </CyberText>
                                    <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace" }}>
                                        {(j.classArchetype || "?").toUpperCase()}
                                        {die ? ` · d${die}` : ""}
                                    </CyberText>
                                </Box>
                            );
                        })
                    )}
                </Box>
            </Box>

            {/* Detail */}
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                {!jobId ? (
                    <Box sx={{ p: 3 }}>
                        <CyberText sx={{ color: UI_COLORS.textSecondary }}>Selecciona o crea un job.</CyberText>
                    </Box>
                ) : (
                    <>
                        <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${UI_COLORS.border}`, display: "flex", gap: 0.75, flexShrink: 0 }}>
                            {DETAIL_TABS.map((t) => (
                                <Box
                                    key={t}
                                    component="button"
                                    type="button"
                                    onClick={() => setDetailTab(t)}
                                    sx={{
                                        px: 1.25,
                                        py: 0.55,
                                        borderRadius: 999,
                                        border: `1px solid ${detailTab === t ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                        bgcolor: detailTab === t ? `${UI_COLORS.anomaly}14` : "transparent",
                                        color: detailTab === t ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.62rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    {t}
                                </Box>
                            ))}
                        </Box>

                        <Box sx={{ flex: 1, overflowY: "auto", p: 1.75, ...CYBER_SCROLL_STYLE }}>
                            {detailTab === "Stats" && (
                                <Stack spacing={1.5}>
                                    <CyberInput
                                        label="DISPLAY_NAME"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                    />
                                    <CyberInput
                                        select
                                        label="ARCHETYPE"
                                        value={archetype}
                                        onChange={(e) => {
                                            const a = e.target.value;
                                            setArchetype(a);
                                            setCombatForm((prev) => ({
                                                ...combatDefaultsForArchetype(a),
                                                ...sanitizeCombatPartial(prev),
                                            }));
                                        }}
                                    >
                                        {["stalwart", "vagabond", "mendicant", "wright"].map((a) => (
                                            <option key={a} value={a} style={{ backgroundColor: "#000", color: "#fff" }}>
                                                {a.toUpperCase()}
                                            </option>
                                        ))}
                                    </CyberInput>
                                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1 }}>
                                        {COMBAT_STAT_KEYS.map((key) =>
                                            key === "damageDie" ? (
                                                <CyberInput
                                                    key={key}
                                                    select
                                                    label="DAMAGE DIE"
                                                    value={String(combatForm.damageDie ?? 6)}
                                                    onChange={(e) =>
                                                        setCombatForm((p) => ({
                                                            ...p,
                                                            damageDie: Number(e.target.value),
                                                        }))
                                                    }
                                                >
                                                    {DAMAGE_DIE_OPTIONS.map((d) => (
                                                        <option key={d} value={d} style={{ backgroundColor: "#000", color: "#fff" }}>
                                                            d{d}
                                                        </option>
                                                    ))}
                                                </CyberInput>
                                            ) : (
                                                <CyberInput
                                                    key={key}
                                                    type="number"
                                                    label={key.toUpperCase()}
                                                    value={combatForm[key] ?? 0}
                                                    onChange={(e) =>
                                                        setCombatForm((p) => ({
                                                            ...p,
                                                            [key]: Number(e.target.value),
                                                        }))
                                                    }
                                                />
                                            ),
                                        )}
                                    </Box>
                                    <CyberInput
                                        label="CLASS RESOURCE NAME"
                                        value={resourceForm.name || ""}
                                        onChange={(e) => setResourceForm((p) => ({ ...p, name: e.target.value }))}
                                    />
                                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                                        <CyberInput
                                            type="number"
                                            label="RESOURCE MIN"
                                            value={resourceForm.min ?? 0}
                                            onChange={(e) => setResourceForm((p) => ({ ...p, min: Number(e.target.value) }))}
                                        />
                                        <CyberInput
                                            type="number"
                                            label="RESOURCE MAX"
                                            value={resourceForm.max ?? ""}
                                            onChange={(e) => setResourceForm((p) => ({
                                                ...p,
                                                max: e.target.value === "" ? null : Number(e.target.value),
                                            }))}
                                        />
                                    </Box>
                                    <CyberInput
                                        label="JOB DESCRIPTION"
                                        value={jobDescription}
                                        onChange={(e) => setJobDescription(e.target.value)}
                                        multiline
                                        rows={3}
                                    />
                                    <CyberInput
                                        label="SPECIAL MECHANIC NAME"
                                        value={mechanicForm.name || ""}
                                        onChange={(e) => setMechanicForm((p) => ({ ...p, name: e.target.value }))}
                                    />
                                    <CyberInput
                                        label="SPECIAL MECHANIC TEXT"
                                        value={mechanicForm.text || ""}
                                        onChange={(e) => setMechanicForm((p) => ({ ...p, text: e.target.value }))}
                                        multiline
                                        rows={5}
                                    />
                                    <CyberButton type="button" onClick={handleSaveJobCombat} loading={saving}>
                                        GUARDAR JOB
                                    </CyberButton>
                                </Stack>
                            )}

                            {(detailTab === "Abilities" || detailTab === "Traits") && (
                                <Box sx={{ display: "flex", gap: 1.5, minHeight: 280 }}>
                                    <Box sx={{ width: 200, flexShrink: 0 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                                            <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.accent }}>
                                                {detailTab.toUpperCase()}
                                            </CyberText>
                                            <Box
                                                component="button"
                                                type="button"
                                                onClick={() => handleNewAbility(detailTab === "Traits")}
                                                sx={{
                                                    border: "none",
                                                    background: "none",
                                                    color: UI_COLORS.anomaly,
                                                    fontSize: "0.58rem",
                                                    cursor: "pointer",
                                                    fontFamily: "'Orbitron', sans-serif",
                                                }}
                                            >
                                                + NEW
                                            </Box>
                                        </Box>
                                        {detailTab === "Traits" && (
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mb: 1 }}>
                                                <Box
                                                    component="button"
                                                    type="button"
                                                    onClick={() => setTraitListFilter(null)}
                                                    sx={{
                                                        px: 0.7, py: 0.25, borderRadius: 0.5,
                                                        border: `1px solid ${traitListFilter == null ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                                        bgcolor: traitListFilter == null ? `${UI_COLORS.anomaly}14` : "transparent",
                                                        color: traitListFilter == null ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                                        fontFamily: "'Orbitron', sans-serif",
                                                        fontSize: "0.48rem",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    All
                                                </Box>
                                                {TRAIT_CATEGORY_LIST.map((cat) => (
                                                    <Box
                                                        key={cat}
                                                        component="button"
                                                        type="button"
                                                        onClick={() => setTraitListFilter((p) => (p === cat ? null : cat))}
                                                        sx={{
                                                            px: 0.7, py: 0.25, borderRadius: 0.5,
                                                            border: `1px solid ${traitListFilter === cat ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                                            bgcolor: traitListFilter === cat ? `${UI_COLORS.anomaly}14` : "transparent",
                                                            color: traitListFilter === cat ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                                            fontFamily: "'Orbitron', sans-serif",
                                                            fontSize: "0.48rem",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        {TRAIT_CATEGORY_LABELS[cat]}
                                                    </Box>
                                                ))}
                                            </Box>
                                        )}
                                        {loadingAbs ? (
                                            <CircularProgress size={18} sx={{ color: UI_COLORS.accent }} />
                                        ) : (
                                            filteredAbs.map((a) => (
                                                <Box
                                                    key={a.id}
                                                    onClick={() => {
                                                        setIsNew(false);
                                                        setSelectedKey(a.id);
                                                    }}
                                                    sx={{
                                                        px: 1,
                                                        py: 0.75,
                                                        mb: 0.35,
                                                        borderRadius: 0.5,
                                                        cursor: "pointer",
                                                        border: `1px solid ${selectedKey === a.id && !isNew ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                                        bgcolor: selectedKey === a.id && !isNew ? `${UI_COLORS.anomaly}10` : "transparent",
                                                    }}
                                                >
                                                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textPrimary }}>
                                                        {a.label || a.id}
                                                    </CyberText>
                                                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary }}>
                                                        {detailTab === "Traits"
                                                            ? TRAIT_CATEGORY_LABELS[normalizeTraitCategory(a.traitCategory)]
                                                            : (a.type || "ability")}
                                                    </CyberText>
                                                </Box>
                                            ))
                                        )}
                                        {isNew && (
                                            <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.accent, mt: 0.5 }}>
                                                (nueva sin guardar)
                                            </CyberText>
                                        )}
                                    </Box>

                                    {(selectedKey || isNew) && (
                                        <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
                                            <CyberInput
                                                label="LABEL"
                                                value={draft.label}
                                                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                                            />
                                            <CyberInput
                                                select
                                                label="TYPE"
                                                value={draft.type}
                                                onChange={(e) => setDraft((d) => ({
                                                    ...d,
                                                    type: e.target.value,
                                                    abilityKind: e.target.value === "ability"
                                                        ? d.abilityKind
                                                        : ABILITY_KINDS.STANDARD,
                                                }))}
                                            >
                                                {ABILITY_TYPES.map((t) => (
                                                    <option key={t} value={t} style={{ backgroundColor: "#000", color: "#fff" }}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </CyberInput>
                                            {draft.type === "ability" && (
                                                <CyberInput
                                                    select
                                                    label="KIND"
                                                    value={draft.abilityKind || ABILITY_KINDS.STANDARD}
                                                    onChange={(e) => {
                                                        const kind = normalizeAbilityKind(e.target.value);
                                                        setDraft((d) => ({
                                                            ...d,
                                                            abilityKind: kind,
                                                            content: kind === ABILITY_KINDS.ATTACK && !d.content
                                                                ? DEFAULT_ATTACK_CONTENT
                                                                : d.content,
                                                        }));
                                                    }}
                                                >
                                                    <option value={ABILITY_KINDS.STANDARD} style={{ backgroundColor: "#000", color: "#fff" }}>
                                                        standard
                                                    </option>
                                                    <option value={ABILITY_KINDS.ATTACK} style={{ backgroundColor: "#000", color: "#fff" }}>
                                                        attack (d20 + boons)
                                                    </option>
                                                </CyberInput>
                                            )}
                                            {draft.type === "trait" && (
                                                <CyberInput
                                                    select
                                                    label="TRAIT CATEGORY"
                                                    value={draft.traitCategory || TRAIT_CATEGORIES.SIMPLE}
                                                    onChange={(e) => setDraft((d) => ({
                                                        ...d,
                                                        traitCategory: normalizeTraitCategory(e.target.value),
                                                    }))}
                                                >
                                                    {TRAIT_CATEGORY_LIST.map((cat) => (
                                                        <option key={cat} value={cat} style={{ backgroundColor: "#000", color: "#fff" }}>
                                                            {TRAIT_CATEGORY_LABELS[cat]}
                                                        </option>
                                                    ))}
                                                </CyberInput>
                                            )}
                                            <CyberInput
                                                label="COST"
                                                value={draft.cost}
                                                onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
                                            />
                                            <TagSearchSelect
                                                available={campaignTags}
                                                value={draft.tagKeys || []}
                                                onChange={(keys) => setDraft((d) => ({ ...d, tagKeys: keys }))}
                                            />
                                            <Box>
                                                <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>
                                                    CONTENT — insertar comandos
                                                    {draft.abilityKind === ABILITY_KINDS.ATTACK
                                                        ? " (d20 lo aporta el motor Attack)"
                                                        : ""}:
                                                </CyberText>
                                                <AbilityCommandToolbar
                                                    onInsert={(snip) => {
                                                        setDraft((d) => ({
                                                            ...d,
                                                            content: insertAtCursor(contentRef.current, d.content, snip),
                                                        }));
                                                    }}
                                                />
                                                <Box
                                                    component="textarea"
                                                    ref={contentRef}
                                                    value={draft.content}
                                                    onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                                                    rows={8}
                                                    sx={{
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        mt: 0.5,
                                                        p: 1,
                                                        fontFamily: "Fira Sans, sans-serif",
                                                        fontSize: "0.85rem",
                                                        color: "#ffffff",
                                                        bgcolor: "rgba(0,0,0,0.45)",
                                                        border: `1px solid ${UI_COLORS.border}`,
                                                        borderRadius: "4px",
                                                        resize: "vertical",
                                                        outline: "none",
                                                        "&:focus": { borderColor: UI_COLORS.accent },
                                                    }}
                                                />
                                            </Box>
                                            <CyberButton type="button" onClick={handleSaveAbility} loading={saving}>
                                                {isNew ? "CREAR ABILITY" : "GUARDAR ABILITY"}
                                            </CyberButton>
                                        </Stack>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
}
