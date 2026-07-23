/**
 * WikiAiLabPanel.jsx
 *
 * DM-only panel for testing and using AI narrative generation.
 * Two modes:
 *   - "situation"        → generates 1-3 playable situation cards
 *   - "narrative_impact" → proposes relation changes from a free instruction
 *
 * Integrated into NarrativeWikiOverlay as a collapsible drawer on the right side,
 * visible only when role === "dm".
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
    Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions, Divider,
    IconButton, Menu, MenuItem, Tooltip, TextField, Slider,
} from "@mui/material";
import SmartToyIcon      from "@mui/icons-material/SmartToy";
import ExpandMoreIcon    from "@mui/icons-material/ExpandMore";
import ExpandLessIcon    from "@mui/icons-material/ExpandLess";
import AddCircleOutlineIcon  from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon      from "@mui/icons-material/ErrorOutline";
import AutoAwesomeIcon       from "@mui/icons-material/AutoAwesome";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BlockIcon from "@mui/icons-material/Block";
import CancelIcon from "@mui/icons-material/Cancel";
import HistoryIcon from "@mui/icons-material/History";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS, Z_INDEX } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    AI_MODES, AI_MODE_LABELS, AI_MODE_TOOLTIPS, SITUATION_INTENTS,
    AI_PROVIDERS,
    CONFIDENCE_TOOLTIPS, TONE_LABELS,
    GEMINI_MODELS,
    cascadeOptsForDepth,
    CASCADE_SCOUT_THRESHOLD,
} from "../../constants/wiki/narrativeAiSchemas";
import {
    buildSituationContext,
    buildCascadeContext,
    buildScoutContext,
    computePropagationWaves,
    buildMultiAnchorSituationContext,
    mergeContextWithExtras,
} from "../../utils/buildSituationContext";
import { estimateTokenCount, formatTokenEstimate } from "../../utils/estimateTokenCount";
import {
    createAiThread,
    appendAiThreadMessage,
    getAiThreadMessages,
} from "../../../firebase/services/aiThreadService";
import { listSessionLogs } from "../../../firebase/services/sessionLogService";
import { resolveWikiMentions }   from "../../utils/resolveWikiMentions";
import { validateAiResponse, buildReflexionPrompt } from "../../utils/validateAiResponse";
import { generateNarrativeAi }   from "../../../firebase/services/narrativeAiService";
import { addWikiRelation, removeWikiRelation, saveWikiEntity } from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";
import { WIKI_RELATION_TYPE_LABELS, defaultStrengthForRelationType } from "../../constants/wikiRelationTypes";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { slugify, uniqueSlug } from "../../utils/wikiSlug";
import { linkMentionsInText } from "../../utils/linkWikiMentions";
import WikiCascadeResult from "./WikiCascadeResult";
import {
    resolveNarrativeAiConfig,
    getExplicitlyMentionedEntityIds,
} from "../../constants/wiki/narrativeAiConfig";
import { filterGraphEntities } from "../../utils/wikiGraphEntities";
import { hasGeminiApiKeyConfigured } from "../../utils/aiApiKeys";

const VARIATION_TEMPERATURE = 1.05;

const INSPIRATION_PROMPTS = [
    { label: "3 ganchos", intent: "hook", instruction: "Genera 3 ganchos de escena distintos y jugables." },
    { label: "Complicar", intent: "complication", instruction: "Complica la situación actual con un giro inesperado pero coherente." },
    { label: "NPC rápido", intent: "npc", instruction: "Sugiere un NPC memorable con motivación clara para esta escena." },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const CONFIDENCE_COLORS = {
    alta:  UI_COLORS.anomaly,
    media: "#ffa726",
    baja:  UI_COLORS.accentStrong,
};

const ACTION_ICONS = {
    add:    <AddCircleOutlineIcon sx={{ fontSize: "1rem" }} />,
    remove: <RemoveCircleOutlineIcon sx={{ fontSize: "1rem" }} />,
    update: <CheckCircleOutlineIcon sx={{ fontSize: "1rem" }} />,
};

const ACTION_LABELS = { add: "Añadir", remove: "Eliminar", update: "Actualizar" };

const tooltipSlotProps = {
    tooltip: {
        sx: {
            maxWidth: 280,
            fontSize: "0.72rem",
            fontFamily: "'Fira Sans', sans-serif",
            bgcolor: UI_COLORS.backgroundPrimary,
            color: UI_COLORS.textPrimary,
            border: `1px solid ${UI_COLORS.border}`,
        },
    },
};

/** Menús del LAB — por encima del overlay (1400) y del canvas Pixi. */
const labMenuPaperSx = {
    bgcolor: UI_COLORS.backgroundSecondary,
    color: UI_COLORS.textPrimary,
    border: `1px solid ${UI_COLORS.border}`,
    maxHeight: 320,
    ...CYBER_SCROLL_STYLE,
};

const labDropdownButtonSx = {
    justifyContent: "space-between",
    textTransform: "none",
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.8rem",
    color: UI_COLORS.textPrimary,
    borderColor: UI_COLORS.border,
    bgcolor: UI_COLORS.backgroundPrimary,
    py: 0.75,
    "&:hover": { borderColor: `${UI_COLORS.accent}88`, bgcolor: `${UI_COLORS.accent}08` },
};

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.8rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiOutlinedInput-root": { color: UI_COLORS.textPrimary },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.78rem" },
};

/**
 * Dropdown con Menu explícito — evita fallos de MUI Select junto al canvas Pixi.
 * Backdrop invisible: cierra al clic fuera (como un Select) sin oscurecer el grafo.
 * @param {{ label: string, value: string, options: Array<{value:string,label:string,hint?:string,disabled?:boolean,suffix?:string}>, onChange: (v:string)=>void, helperText?: string }} props
 */
function LabDropdown({ label, value, options, onChange, helperText }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const selected = options.find((o) => o.value === value);

    return (
        <Box>
            {label ? (
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5 }}>
                    {label.toUpperCase()}
                </CyberText>
            ) : null}
            <Button
                fullWidth
                size="small"
                variant="outlined"
                onClick={(e) => setAnchorEl((prev) => (prev ? null : e.currentTarget))}
                endIcon={<ExpandMoreIcon sx={{ fontSize: "1rem !important", color: UI_COLORS.textSecondary }} />}
                sx={labDropdownButtonSx}
            >
                <Box
                    component="span"
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        flex: 1,
                    }}
                >
                    {selected?.label ?? value ?? "—"}
                    {selected?.suffix ?? ""}
                </Box>
            </Button>
            {helperText && (
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mt: 0.5, lineHeight: 1.45 }}>
                    {helperText}
                </CyberText>
            )}
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                disableScrollLock
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    backdrop: { invisible: true },
                    paper: {
                        sx: {
                            ...labMenuPaperSx,
                            minWidth: anchorEl?.offsetWidth ?? 200,
                        },
                    },
                }}
                sx={{ zIndex: Z_INDEX.wikiLabMenu }}
            >
                {options.map((opt) => (
                    <MenuItem
                        key={String(opt.value)}
                        disabled={opt.disabled}
                        selected={opt.value === value}
                        onClick={() => {
                            if (!opt.disabled) {
                                onChange(opt.value);
                                setAnchorEl(null);
                            }
                        }}
                        sx={{
                            fontSize: "0.8rem",
                            color: opt.disabled ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
                            whiteSpace: "normal",
                            alignItems: "flex-start",
                            py: 1,
                        }}
                    >
                        <Box>
                            <Box component="span">
                                {opt.label}{opt.suffix ?? ""}
                            </Box>
                            {opt.hint && (
                                <CyberText
                                    sx={{
                                        fontSize: "0.62rem",
                                        color: UI_COLORS.textSecondary,
                                        display: "block",
                                        mt: 0.35,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    {opt.hint}
                                </CyberText>
                            )}
                        </Box>
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaBadge({ label, value, warn }) {
    return (
        <Chip
            size="small"
            label={`${label}: ${value}`}
            sx={{
                height: 20,
                fontSize: "0.62rem",
                mr: 0.5,
                mb: 0.5,
                bgcolor: warn ? `${UI_COLORS.accentStrong}18` : `${UI_COLORS.backgroundPrimary}cc`,
                color: warn ? UI_COLORS.accentStrong : UI_COLORS.textSecondary,
                border: `1px solid ${warn ? UI_COLORS.accentStrong : UI_COLORS.border}44`,
                "& .MuiChip-label": { px: 0.75 },
            }}
        />
    );
}

function SituationCard({ situation, index, onSaveDraft, saving }) {
    const [expanded, setExpanded] = useState(false);
    const conf = situation.confidence ?? "media";

    return (
        <Box
            sx={{
                border: `1px solid ${UI_COLORS.border}`,
                borderLeft: `3px solid ${CONFIDENCE_COLORS[conf] ?? UI_COLORS.accent}`,
                borderRadius: 1,
                p: 1.5,
                mb: 1.5,
                bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <CyberTitle sx={{ fontSize: "0.8rem", color: UI_COLORS.accent, flex: 1 }}>
                    {index + 1}. {situation.title}
                </CyberTitle>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {situation.tone && (
                        <Tooltip title={`Tono sugerido: ${TONE_LABELS[situation.tone] ?? situation.tone}`} slotProps={tooltipSlotProps}>
                            <Chip
                                label={TONE_LABELS[situation.tone] ?? situation.tone}
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: "0.6rem",
                                    bgcolor: `${UI_COLORS.textSecondary}18`,
                                    color: UI_COLORS.textSecondary,
                                    border: `1px solid ${UI_COLORS.border}`,
                                }}
                            />
                        </Tooltip>
                    )}
                    <Tooltip title={CONFIDENCE_TOOLTIPS[conf] ?? "Confianza en el anclaje al wiki"} slotProps={tooltipSlotProps}>
                        <Chip
                            label={conf}
                            size="small"
                            sx={{
                                height: 18,
                                fontSize: "0.6rem",
                                bgcolor: `${CONFIDENCE_COLORS[conf]}22`,
                                color: CONFIDENCE_COLORS[conf],
                                border: `1px solid ${CONFIDENCE_COLORS[conf]}44`,
                                cursor: "help",
                            }}
                        />
                    </Tooltip>
                    <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ color: UI_COLORS.textSecondary }}>
                        {expanded ? <ExpandLessIcon sx={{ fontSize: "1rem" }} /> : <ExpandMoreIcon sx={{ fontSize: "1rem" }} />}
                    </IconButton>
                </Box>
            </Box>

            <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary, mb: 0.5 }}>
                {situation.hook}
            </CyberText>

            <Collapse in={expanded}>
                <Divider sx={{ my: 1, bgcolor: UI_COLORS.border }} />
                <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textSecondary, mb: 1 }}>
                    <strong style={{ color: UI_COLORS.anomaly }}>STAKES:</strong> {situation.stakes}
                </CyberText>

                {situation.involvedEntities?.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>ENTIDADES:</CyberText>
                        {situation.involvedEntities.map((e, i) => (
                            <Box key={i} sx={{ pl: 1, mb: 0.25 }}>
                                <CyberText
                                    component="span"
                                    sx={{
                                        fontSize: "0.72rem",
                                        color: e._invented ? UI_COLORS.accentStrong : UI_COLORS.textPrimary,
                                    }}
                                >
                                    {e._invented && <ErrorOutlineIcon sx={{ fontSize: "0.8rem", verticalAlign: "middle", mr: 0.5 }} />}
                                    {e.title} ({e.role})
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, pl: 1 }}>
                                    {e.why}
                                </CyberText>
                            </Box>
                        ))}
                    </Box>
                )}

                {situation.dramaticQuestions?.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>PREGUNTAS DRAMÁTICAS:</CyberText>
                        {situation.dramaticQuestions.map((q, i) => (
                            <CyberText key={i} sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary, pl: 1, mb: 0.25 }}>
                                • {q}
                            </CyberText>
                        ))}
                    </Box>
                )}

                {situation.dmNotes && (
                    <Box sx={{ bgcolor: `${UI_COLORS.accentStrong}11`, border: `1px solid ${UI_COLORS.accentStrong}33`, borderRadius: 1, p: 1 }}>
                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>
                            NOTAS DM (confidencial):
                        </CyberText>
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary }}>
                            {situation.dmNotes}
                        </CyberText>
                    </Box>
                )}

                {situation._errors?.length > 0 && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: `${UI_COLORS.accentStrong}18`, borderRadius: 1 }}>
                        {situation._errors.map((e, i) => (
                            <CyberText key={i} sx={{ fontSize: "0.7rem", color: UI_COLORS.accentStrong, display: "flex", alignItems: "center", gap: 0.5 }}>
                                <WarningAmberIcon sx={{ fontSize: "0.85rem" }} /> {e}
                            </CyberText>
                        ))}
                    </Box>
                )}
            </Collapse>

            {onSaveDraft && (
                <Button
                    size="small"
                    variant="outlined"
                    disabled={saving}
                    onClick={() => onSaveDraft(situation)}
                    sx={{
                        mt: 1,
                        fontSize: "0.62rem",
                        fontFamily: "'Orbitron', sans-serif",
                        letterSpacing: 0.5,
                        borderColor: `${UI_COLORS.anomaly}88`,
                        color: UI_COLORS.anomaly,
                        py: 0.25,
                        "&:hover": { bgcolor: `${UI_COLORS.anomaly}12` },
                    }}
                >
                    {saving ? <CircularProgress size={12} sx={{ color: UI_COLORS.anomaly }} /> : "Guardar borrador"}
                </Button>
            )}
        </Box>
    );
}

/**
 * Build crónica body markdown from a situation card.
 * @param {object} situation
 */
function buildSituationDraftBody(situation) {
    const parts = [];
    if (situation.hook) parts.push(`## Gancho\n${situation.hook}`);
    if (situation.stakes) parts.push(`## Stakes\n${situation.stakes}`);
    if (situation.involvedEntities?.length) {
        const lines = situation.involvedEntities.map((e) => {
            const invent = e._invented ? " ⚠ inventada" : "";
            return `- ${e.title} (${e.role})${invent}${e.why ? `: ${e.why}` : ""}`;
        });
        parts.push(`## Entidades\n${lines.join("\n")}`);
    }
    if (situation.dramaticQuestions?.length) {
        parts.push(`## Preguntas dramáticas\n${situation.dramaticQuestions.map((q) => `- ${q}`).join("\n")}`);
    }
    if (situation.dmNotes) parts.push(`## Notas DM\n${situation.dmNotes}`);
    return parts.join("\n\n");
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function WikiAiLabPanel({
    selectedEntity,
    entities,
    relations,
    campaignId,
    narrativeSettings,
    onPropagationStart,
    onPropagationEnd,
}) {
    const dispatch   = useDispatch();
    const uid        = useSelector((s) => s.player.profile?.uid);
    const aiConfig = useMemo(
        () => resolveNarrativeAiConfig(narrativeSettings),
        [narrativeSettings?.aiRules, narrativeSettings?.aiGeneration]
    );
    const aiRules = aiConfig.rules;
    const generationParams = aiConfig.generation;

    // Controls — Firebase AI Logic primary; REST fallback if API key in env
    const hasGeminiKey = hasGeminiApiKeyConfigured();

    const [mode, setMode]           = useState(AI_MODES.SITUATION);
    const [modelId, setModelId]     = useState(GEMINI_MODELS[0].value);
    const [intent, setIntent]       = useState("");
    const [instruction, setInstruction] = useState("");
    const [debouncedInstruction, setDebouncedInstruction] = useState("");
    const [extraAnchorIds, setExtraAnchorIds] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [threadMessages, setThreadMessages] = useState([]);
    const [sessionRecaps, setSessionRecaps] = useState([]);
    const [estimatedTokens, setEstimatedTokens] = useState(null);

    // Cascade propagation depth (slider 1–8)
    const [propagationDepth, setPropagationDepth] = useState(3);

    // Cascade: live mention preview from instruction text
    const [mentionPreview, setMentionPreview] = useState(null);

    // Results
    const [loading, setLoading]       = useState(false);
    const [loadingLabel, setLoadingLabel] = useState("Generando…");
    const [error, setError]         = useState(null);
    const [result, setResult]       = useState(null);
    const [contextMeta, setContextMeta] = useState(null);
    const [lastContextText, setLastContextText] = useState("");
    const [showContextText, setShowContextText] = useState(false);
    const [tokenUsage, setTokenUsage]   = useState(null);
    const [savingDraftIdx, setSavingDraftIdx] = useState(null);

    // Apply confirmation dialog
    const [applyTarget, setApplyTarget] = useState(null);
    const [applying, setApplying]       = useState(false);

    const modelOptions = GEMINI_MODELS;
    const graphEntities = useMemo(() => filterGraphEntities(entities), [entities]);
    const canonSummary = narrativeSettings?.canonSummary ?? narrativeSettings?.description ?? "";

    useEffect(() => {
        if (!campaignId) return;
        listSessionLogs(campaignId, 5).then((rows) => {
            setSessionRecaps(rows.map((r) => ({ title: r.title, recap: r.recap })));
        }).catch(console.error);
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId || !activeThreadId) {
            setThreadMessages((prev) => (prev.length === 0 ? prev : []));
            return;
        }
        getAiThreadMessages(campaignId, activeThreadId).then((msgs) => {
            setThreadMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
        }).catch(console.error);
    }, [campaignId, activeThreadId]);

    useEffect(() => {
        const nextIds = selectedEntity?.id ? [selectedEntity.id] : [];
        setExtraAnchorIds((prev) => {
            if (prev.length === nextIds.length && prev.every((id, i) => id === nextIds[i])) {
                return prev;
            }
            return nextIds;
        });
    }, [selectedEntity?.id]);

    const neighborAnchorCandidates = useMemo(() => {
        if (!selectedEntity?.id) return [];
        const anchorId = selectedEntity.id;
        const bestStrength = new Map();
        for (const r of relations) {
            let otherId = null;
            if (r.fromEntityId === anchorId) otherId = r.toEntityId;
            else if (r.toEntityId === anchorId) otherId = r.fromEntityId;
            if (!otherId) continue;
            const s = Math.abs(r.strength ?? 0);
            bestStrength.set(otherId, Math.max(bestStrength.get(otherId) ?? 0, s));
        }
        const byId = new Map(graphEntities.map((e) => [e.id, e]));
        return [...bestStrength.entries()]
            .map(([id, strength]) => ({ entity: byId.get(id), strength }))
            .filter((row) => row.entity)
            .sort((a, b) => b.strength - a.strength || (a.entity.title ?? "").localeCompare(b.entity.title ?? ""))
            .slice(0, 16)
            .map((row) => row.entity);
    }, [selectedEntity?.id, graphEntities, relations]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedInstruction(instruction), 350);
        return () => clearTimeout(t);
    }, [instruction]);

    const propagationOpts = useMemo(() => ({
        aiRules,
        eventText: debouncedInstruction,
    }), [aiRules, debouncedInstruction]);

    const restoreCascadePreview = useCallback(() => {
        if (mode !== AI_MODES.CASCADE || !selectedEntity?.id) {
            onPropagationEnd?.();
            return;
        }
        const depthOpts = cascadeOptsForDepth(propagationDepth);
        const { waves } = computePropagationWaves(selectedEntity.id, graphEntities, relations, {
            strategy: "cascade",
            maxWaves: depthOpts.maxWaves,
            ...propagationOpts,
        });
        onPropagationStart?.(waves, { preview: true });
    }, [mode, selectedEntity, propagationDepth, graphEntities, relations, propagationOpts, onPropagationStart, onPropagationEnd]);

    // Live mention preview (cascade only)
    const handleInstructionChange = useCallback((value) => {
        setInstruction(value);
        if (mode === AI_MODES.CASCADE && value.trim().length > 3) {
            const { resolved, ambiguous } = resolveWikiMentions(value, entities);
            setMentionPreview({ resolved, ambiguous });
        } else {
            setMentionPreview(null);
        }
    }, [mode, entities]);

    const handleSaveSituationDraft = useCallback(async (situation, index) => {
        if (!campaignId || !situation?.title?.trim()) return;
        setSavingDraftIdx(index);
        try {
            const existingSlugs = (entities ?? []).map((e) => e.slug).filter(Boolean);
            const slug = uniqueSlug(slugify(situation.title), existingSlugs);
            const tags = ["ai-draft"];
            if (situation.tone) tags.push(String(situation.tone));

            const involved = (situation.involvedEntities ?? [])
                .map((row) => {
                    const key = (row.title ?? "").toLowerCase().trim();
                    if (!key) return null;
                    return (entities ?? []).find((e) => e.title?.toLowerCase().trim() === key) ?? null;
                })
                .filter(Boolean);

            const summary = linkMentionsInText((situation.hook ?? "").trim(), entities);
            const body = linkMentionsInText(buildSituationDraftBody(situation), [
                ...involved,
                ...(entities ?? []),
            ]);

            const created = await dispatch(saveWikiEntity({
                campaignId,
                entityId: null,
                uid,
                data: {
                    entityType: WIKI_ENTITY_TYPES.CRONICA,
                    title: situation.title.trim(),
                    summary,
                    body,
                    tags,
                    visibility: "dm_only",
                    slug,
                },
            })).unwrap();

            dispatch(showSnackbar({
                message: `Borrador guardado: ${created.title ?? situation.title}`,
                severity: "success",
            }));
        } catch (err) {
            dispatch(showSnackbar({
                message: `No se pudo guardar el borrador: ${err.message ?? err}`,
                severity: "error",
            }));
        } finally {
            setSavingDraftIdx(null);
        }
    }, [campaignId, entities, uid, dispatch]);

    const handleGenerate = useCallback(async (opts = {}) => {
        const variation = Boolean(opts?.variation);
        setLoading(true);
        setLoadingLabel(variation ? "Generando variación…" : "Generando…");
        setError(null);
        // Keep previous titles for variation hint before clearing result
        const previousTitles = mode === AI_MODES.SITUATION
            ? (result?.situations ?? []).map((s) => s.title).filter(Boolean)
            : result?.eventTitle
                ? [result.eventTitle]
                : (result?.proposedEvent?.title ? [result.proposedEvent.title] : []);
        setResult(null);
        setContextMeta(null);
        setLastContextText("");
        setShowContextText(false);
        setTokenUsage(null);
        setEstimatedTokens(null);

        const effectiveGenerationParams = variation
            ? {
                ...generationParams,
                temperature: Math.min(
                    1.2,
                    Math.max(VARIATION_TEMPERATURE, Number(generationParams?.temperature ?? 0.7) + 0.25)
                ),
            }
            : generationParams;

        const variationNote = variation && previousTitles.length
            ? `\n\n[VARIACIÓN] Propón una idea claramente distinta a: ${previousTitles.slice(0, 3).join(" · ")}. No repitas el mismo gancho ni la misma estructura.`
            : variation
                ? "\n\n[VARIACIÓN] Propón una idea claramente distinta a la generación anterior."
                : "";

        const callAi = async (params) => {
            try {
                return await generateNarrativeAi({ ...params, provider: AI_PROVIDERS.GEMINI });
            } catch (firstErr) {
                if (hasGeminiKey) {
                    return await generateNarrativeAi({ ...params, provider: AI_PROVIDERS.GEMINI_DIRECT });
                }
                throw firstErr;
            }
        };

        const wrapExtended = (ctx) => {
            const merged = mergeContextWithExtras(ctx, {
                canonSummary,
                sessionRecaps,
                threadMessages,
            });
            setEstimatedTokens(estimateTokenCount(merged.text));
            return merged;
        };

        const persistThread = async (userContent, assistantContent, usage) => {
            if (!campaignId) return;
            let threadId = activeThreadId;
            if (!threadId) {
                threadId = await createAiThread(campaignId, {
                    title: selectedEntity?.title ?? "Lab IA",
                    anchorEntityId: selectedEntity?.id,
                    mode,
                });
                setActiveThreadId(threadId);
            }
            await appendAiThreadMessage(campaignId, threadId, { role: "user", content: userContent, mode });
            await appendAiThreadMessage(campaignId, threadId, {
                role: "assistant",
                content: assistantContent,
                mode,
                tokenUsage: usage,
            });
            const msgs = await getAiThreadMessages(campaignId, threadId);
            setThreadMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
        };

        try {
            const anchorId = selectedEntity?.id;
            const anchorIds = extraAnchorIds.length ? extraAnchorIds : [anchorId];

            if (mode === AI_MODES.CASCADE) {
                const depthOpts = cascadeOptsForDepth(propagationDepth);
                const { waves } = computePropagationWaves(anchorId, graphEntities, relations, {
                    strategy: "cascade",
                    maxWaves: depthOpts.maxWaves,
                    ...propagationOpts,
                });
                onPropagationStart?.(waves);

                const cascadeCtxRaw = buildCascadeContext(graphEntities, relations, {
                    anchorEntityId: anchorId,
                    eventText: instruction,
                    role: "dm",
                    aiRules,
                    ...depthOpts,
                }, graphEntities);
                const ctx = wrapExtended(cascadeCtxRaw);
                setContextMeta(ctx.meta);
                setLastContextText(ctx.text ?? "");

                // ── Two-pass Scout (Pasa 1) when expectedImpacts >= threshold ───
                const expectedImpacts = ctx.meta.impactTargetCount ?? 0;
                let contextTextForImpact = ctx.text;

                if (expectedImpacts >= CASCADE_SCOUT_THRESHOLD) {
                    setLoadingLabel("Analizando red de impacto…");
                    try {
                        const scoutCtxText = buildScoutContext(
                            ctx.meta, anchorId, graphEntities, relations
                        );
                        const { raw: scoutRaw } = await callAi({
                            mode: AI_MODES.CASCADE_SCOUT,
                            contextText: scoutCtxText,
                            instruction: instruction || null,
                            generationParams: effectiveGenerationParams,
                            modelId,
                        });
                        // Parse Scout output (informational seed — no full validation needed)
                        let scoutParsed = null;
                        try { scoutParsed = JSON.parse(scoutRaw); } catch { /* ignore */ }
                        if (scoutParsed?.impacts?.length) {
                            const seedLines = [
                                "# Reacciones previstas — Pasa 1 Scout (referencia para elaborar):",
                                ...scoutParsed.impacts.map(
                                    (si) => `- ONDA ${si.wave}: ${si.entityTitle} · ${si.emotionalKeyword} · ${si.topChangeType} — ${si.topChangeDesc}`
                                ),
                                "",
                            ];
                            contextTextForImpact = `${seedLines.join("\n")}---\n\n${ctx.text}`;
                        }
                    } catch (scoutErr) {
                        // Scout failure is non-fatal: continue with single-pass
                        console.warn("[Lab IA] Scout (Pasa 1) falló, continuando sin seed:", scoutErr);
                    }
                    setLoadingLabel("Generando impacto completo…");
                }

                // ── Pasa 2 / single-pass Impact ─────────────────────────────────
                const cascadeInstruction = `${instruction || ""}${variationNote}`.trim() || null;
                const { raw, usage } = await callAi({
                    mode,
                    contextText: contextTextForImpact,
                    instruction: cascadeInstruction,
                    resolvedMentions: ctx.resolvedMentions,
                    guardrailsText: ctx.guardrailsText,
                    generationParams: effectiveGenerationParams,
                    modelId,
                });
                setTokenUsage(usage);

                const contextEntities = graphEntities.filter((e) => ctx.meta.entityIds.includes(e.id));
                const expectedWaves = Object.fromEntries(
                    (ctx.meta.impactTargetsDetailed ?? []).map((t) => [t.title, t.wave])
                );
                const explicitMentionIds = [...getExplicitlyMentionedEntityIds(instruction, graphEntities)];
                const validated = validateAiResponse(mode, raw, contextEntities, graphEntities, {
                    requiredImpactTitles: ctx.meta.impactTargets ?? [],
                    expectedWaves,
                    aiRules,
                    explicitMentionIds,
                    relations,
                });

                // ── Reflexion-lite retry (Shinn et al., 2023) ───────────────────
                // Trigger: missing impacts, truncated JSON, or invalid changes. Cap: 1 retry.
                const isTruncated  = validated.errors?.some((e) => e.includes("truncada") || e.includes("truncado"));
                const missingCount = validated.missingImpacts?.length ?? 0;
                const invalidTitles = validated.invalidChangeTitles ?? [];
                if (missingCount > 0 || isTruncated || invalidTitles.length > 0) {
                    const titlesToRetry = [
                        ...new Set([
                            ...(validated.missingImpacts ?? []),
                            ...invalidTitles,
                            ...(isTruncated && !(validated.missingImpacts?.length) && !invalidTitles.length
                                ? (ctx.meta.impactTargets ?? [])
                                : []),
                        ].filter(Boolean)),
                    ];
                    if (titlesToRetry.length > 0) {
                        const invalidHints = [];
                        for (const imp of [...(validated.impacts ?? []), ...(validated.collectiveImpacts ?? [])]) {
                            if (!titlesToRetry.some((t) => t.toLowerCase() === imp.entityTitle?.toLowerCase())) continue;
                            const errs = (imp.resolvedChanges ?? [])
                                .filter((c) => !c.valid)
                                .map((c) => c.validationError)
                                .filter(Boolean);
                            if (errs.length) invalidHints.push({ entityTitle: imp.entityTitle, errors: errs });
                        }
                        setLoadingLabel(
                            invalidTitles.length
                                ? `Corrigiendo changes incompletos (${titlesToRetry.length})…`
                                : `Completando impacts faltantes (${titlesToRetry.length})…`
                        );
                        try {
                            const reflexionCtx = buildReflexionPrompt(
                                titlesToRetry,
                                ctx.text,
                                instruction || "",
                                { invalidChangeHints: invalidHints }
                            );
                            const { raw: retryRaw } = await callAi({
                                mode,
                                contextText: reflexionCtx,
                                instruction: null,
                                resolvedMentions: ctx.resolvedMentions,
                                guardrailsText: ctx.guardrailsText,
                                generationParams: effectiveGenerationParams,
                                modelId,
                            });
                            const retryValidated = validateAiResponse(mode, retryRaw, contextEntities, graphEntities, {
                                requiredImpactTitles: titlesToRetry,
                                aiRules,
                                explicitMentionIds,
                                relations,
                            });
                            // Upsert impacts / collectives by title (replace invalid, append missing).
                            const upsertByTitle = (base, incoming) => {
                                const out = [...(base ?? [])];
                                for (const item of incoming ?? []) {
                                    const key = item.entityTitle?.toLowerCase().trim();
                                    if (!key) continue;
                                    const idx = out.findIndex((x) => x.entityTitle?.toLowerCase().trim() === key);
                                    if (idx >= 0) out[idx] = item;
                                    else out.push(item);
                                }
                                return out;
                            };
                            if (retryValidated.impacts?.length > 0) {
                                validated.impacts = upsertByTitle(validated.impacts, retryValidated.impacts);
                            }
                            if (retryValidated.collectiveImpacts?.length > 0) {
                                validated.collectiveImpacts = upsertByTitle(
                                    validated.collectiveImpacts,
                                    retryValidated.collectiveImpacts
                                );
                            }
                            const reportedSet = new Set(
                                validated.impacts.map((i) => i.entityTitle?.toLowerCase().trim()).filter(Boolean)
                            );
                            validated.missingImpacts = (ctx.meta.impactTargets ?? []).filter(
                                (t) => !reportedSet.has(t.toLowerCase().trim())
                            );
                            validated.invalidChangeTitles = [
                                ...validated.impacts
                                    .filter((imp) => (imp.resolvedChanges ?? []).some((c) => !c.valid))
                                    .map((imp) => imp.entityTitle)
                                    .filter(Boolean),
                                ...(validated.collectiveImpacts ?? [])
                                    .filter((ci) => (ci.resolvedChanges ?? []).some((c) => !c.valid))
                                    .map((ci) => ci.entityTitle)
                                    .filter(Boolean),
                            ];
                            validated.errors = (validated.errors ?? []).filter(
                                (e) => !e.startsWith("Faltan impacts")
                            );
                            if (validated.missingImpacts.length === 0) {
                                validated.ok = validated.impacts.every((im) => im.valid);
                            }
                        } catch (retryErr) {
                            console.warn("[Lab IA] Reflexion retry falló:", retryErr);
                        }
                    }
                }

                setResult(validated);
                try {
                    await persistThread(instruction, validated.summary ?? "Evento cascada generado", usage);
                } catch (persistErr) {
                    console.warn("[Lab IA] No se pudo guardar el hilo:", persistErr);
                    setError(
                        `Generación OK, pero el hilo no se guardó: ${persistErr.message ?? persistErr}. `
                        + "Si ves 'insufficient permissions', despliega firestore.rules (colección aiThreads)."
                    );
                }
            } else {
                const { waves } = computePropagationWaves(anchorId, graphEntities, relations, {
                    strategy: "bfs",
                    maxDepth: 2,
                    ...propagationOpts,
                });
                onPropagationStart?.(waves);

                const ctx = wrapExtended(buildMultiAnchorSituationContext(graphEntities, relations, {
                    anchorEntityIds: anchorIds,
                    anchorEntityId: anchorId,
                    intent,
                    role: "dm",
                }));
                setContextMeta(ctx.meta);
                setLastContextText(ctx.text ?? "");

                const situationInstruction = `${instruction || ""}${variationNote}`.trim() || null;
                const { raw, usage } = await callAi({
                    mode,
                    contextText: ctx.text,
                    intent: intent || null,
                    instruction: situationInstruction,
                    generationParams: effectiveGenerationParams,
                    modelId,
                });
                setTokenUsage(usage);

                const contextEntities = graphEntities.filter((e) => ctx.meta.entityIds.includes(e.id));
                const validated = validateAiResponse(mode, raw, contextEntities, graphEntities);
                setResult(validated);

                const assistantSummary = mode === AI_MODES.SITUATION
                    ? (validated.situations ?? []).map((s) => s.title).join(" · ")
                    : validated.summary ?? "Respuesta generada";
                try {
                    await persistThread(intent || instruction || mode, assistantSummary, usage);
                } catch (persistErr) {
                    console.warn("[Lab IA] No se pudo guardar el hilo:", persistErr);
                    setError(
                        `Generación OK, pero el hilo no se guardó: ${persistErr.message ?? persistErr}. `
                        + "Si ves 'insufficient permissions', despliega firestore.rules (colección aiThreads)."
                    );
                }
            }
        } catch (err) {
            setError(err.message ?? "Error desconocido.");
        } finally {
            setLoading(false);
            if (mode === AI_MODES.CASCADE) {
                restoreCascadePreview();
            } else {
                onPropagationEnd?.();
            }
        }
    }, [
        mode, modelId, intent, instruction, selectedEntity, graphEntities, relations,
        aiRules, generationParams, propagationOpts, propagationDepth,
        onPropagationStart, onPropagationEnd, restoreCascadePreview,
        canonSummary, sessionRecaps, threadMessages, extraAnchorIds,
        activeThreadId, campaignId, hasGeminiKey, result,
    ]);

    // When the anchor entity or depth changes in cascade mode, update the static preview halo.
    // When leaving cascade mode, clear it.
    // IMPORTANT: graphEntities must be referentially stable (memoized) or this loops forever
    // via onPropagationStart → parent setState → re-render → new filterGraphEntities array.
    useEffect(() => {
        if (mode !== AI_MODES.CASCADE || !selectedEntity?.id || !onPropagationStart) {
            onPropagationEnd?.();
            return;
        }
        const { waves } = computePropagationWaves(selectedEntity.id, graphEntities, relations, {
            strategy: "cascade",
            maxWaves: propagationDepth,
            ...propagationOpts,
        });
        onPropagationStart(waves, { preview: true });
    }, [
        mode,
        selectedEntity?.id,
        propagationDepth,
        graphEntities,
        relations,
        propagationOpts,
        onPropagationStart,
        onPropagationEnd,
    ]);

    const handleApplyRelation = useCallback(async (rel) => {
        if (!rel.valid || !campaignId) return;
        setApplying(true);
        try {
            if (rel.action === "add" || rel.action === "update") {
                await dispatch(addWikiRelation({
                    campaignId,
                    uid,
                    data: {
                        fromEntityId: rel.resolvedEndpoints.fromEntityId,
                        toEntityId:   rel.resolvedEndpoints.toEntityId,
                        relationType: rel.relationType,
                        label:        rel.label ?? "",
                        strength:     rel.strength ?? defaultStrengthForRelationType(rel.relationType),
                    },
                }));
                dispatch(showSnackbar({
                    message: `Relación añadida: ${rel.fromEntityTitle} → [${WIKI_RELATION_TYPE_LABELS[rel.relationType]}] → ${rel.toEntityTitle}`,
                    severity: "success",
                }));
            } else if (rel.action === "remove") {
                // Find matching relation in current relations
                const existing = relations.find(
                    (r) => r.fromEntityId === rel.resolvedEndpoints.fromEntityId
                        && r.toEntityId   === rel.resolvedEndpoints.toEntityId
                        && r.relationType === rel.relationType
                );
                if (existing) {
                    await dispatch(removeWikiRelation({ campaignId, relationId: existing.id }));
                    dispatch(showSnackbar({
                        message: `Relación eliminada: ${rel.fromEntityTitle} → ${rel.toEntityTitle}`,
                        severity: "success",
                    }));
                } else {
                    dispatch(showSnackbar({
                        message: "No se encontró la relación a eliminar en el wiki.",
                        severity: "warning",
                    }));
                }
            }
        } catch (err) {
            dispatch(showSnackbar({ message: `Error al aplicar: ${err.message}`, severity: "error" }));
        } finally {
            setApplying(false);
            setApplyTarget(null);
        }
    }, [campaignId, uid, relations, dispatch]);

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minHeight: 0,
                bgcolor: UI_COLORS.backgroundSecondary,
                borderLeft: `1px solid ${UI_COLORS.border}`,
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    flexShrink: 0,
                }}
            >
                <SmartToyIcon sx={{ color: UI_COLORS.anomaly, fontSize: "1rem" }} />
                <CyberTitle sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly, letterSpacing: 2, flex: 1 }}>
                    LAB_IA
                </CyberTitle>
                <Chip
                    label="beta"
                    size="small"
                    sx={{
                        height: 16,
                        fontSize: "0.55rem",
                        bgcolor: `${UI_COLORS.anomaly}18`,
                        color: UI_COLORS.anomaly,
                        border: `1px solid ${UI_COLORS.anomaly}44`,
                    }}
                />
            </Box>

            {/* Body: single scroll so controls + results are always reachable */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    ...CYBER_SCROLL_STYLE,
                }}
            >
            {/* Controls */}
            <Box
                sx={{
                    flexShrink: 0,
                    px: 1.5,
                    py: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                }}
            >
                {/* Mode — narrative_impact is hidden from UI (kept for CLI regression only) */}
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5, flexShrink: 0 }}>
                            MODO
                        </CyberText>
                        <Box sx={{ display: "flex", gap: 0.35, flexShrink: 0 }}>
                            {[AI_MODES.SITUATION, AI_MODES.CASCADE].map((m) => (
                                <Tooltip
                                    key={m}
                                    title={AI_MODE_TOOLTIPS[m]}
                                    slotProps={tooltipSlotProps}
                                >
                                    <Chip
                                        label={AI_MODE_LABELS[m]}
                                        size="small"
                                        sx={{
                                            height: 16,
                                            fontSize: "0.55rem",
                                            cursor: "help",
                                            bgcolor: mode === m ? `${UI_COLORS.anomaly}18` : "transparent",
                                            color: mode === m ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                            border: `1px solid ${mode === m ? `${UI_COLORS.anomaly}55` : `${UI_COLORS.border}88`}`,
                                            "& .MuiChip-label": { px: 0.5 },
                                        }}
                                    />
                                </Tooltip>
                            ))}
                        </Box>
                    </Box>
                    <LabDropdown
                        label=""
                        value={mode}
                        onChange={setMode}
                        options={[AI_MODES.SITUATION, AI_MODES.CASCADE].map((m) => ({
                            value: m,
                            label: AI_MODE_LABELS[m],
                        }))}
                    />
                </Box>

                {/* Motor IA + modelo */}
                <Box>
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5, mb: 0.5 }}>
                        MOTOR IA
                    </CyberText>
                    <Box
                        sx={{
                            px: 1,
                            py: 0.75,
                            mb: 1,
                            borderRadius: 1,
                            border: `1px solid ${hasGeminiKey ? `${UI_COLORS.anomaly}44` : `${UI_COLORS.accentStrong}55`}`,
                            bgcolor: hasGeminiKey ? `${UI_COLORS.anomaly}08` : `${UI_COLORS.accentStrong}10`,
                        }}
                    >
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly }}>
                            Firebase AI Logic (primario)
                            {hasGeminiKey && " · REST fallback disponible"}
                        </CyberText>
                        {!hasGeminiKey && (
                            <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mt: 0.35, lineHeight: 1.4 }}>
                                Si Firebase AI Logic falla, añade <code>VITE_GEMINI_API_KEY</code> al <code>.env</code> como respaldo.
                            </CyberText>
                        )}
                    </Box>
                    <LabDropdown
                        label="Modelo"
                        value={modelId}
                        onChange={setModelId}
                        options={modelOptions.map((m) => ({
                            value: m.value,
                            label: m.label,
                            hint: m.tooltip,
                        }))}
                    />
                </Box>

                {/* Anchor display */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary }}>Ancla:</CyberText>
                    {selectedEntity ? (
                        <Chip
                            label={selectedEntity.title}
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: "0.68rem",
                                bgcolor: `${UI_COLORS.accent}18`,
                                color: UI_COLORS.accent,
                                border: `1px solid ${UI_COLORS.accent}44`,
                                maxWidth: 220,
                                "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                },
                            }}
                        />
                    ) : (
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.accentStrong }}>
                            Selecciona una entidad en el wiki
                        </CyberText>
                    )}
                </Box>

                {/* Multi-ancla + hilo — neighbors of current selection */}
                <Box>
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5 }}>
                        CONTEXTO (MULTI-ANCLA)
                    </CyberText>
                    {!selectedEntity ? (
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                            Selecciona un nodo para ver vecinos y añadir anclas extra.
                        </CyberText>
                    ) : (
                        <>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.5 }}>
                                <Chip
                                    label={`Ancla · ${selectedEntity.title}`}
                                    size="small"
                                    sx={{
                                        height: 20,
                                        fontSize: "0.6rem",
                                        bgcolor: `${UI_COLORS.accent}22`,
                                        color: UI_COLORS.accent,
                                        border: `1px solid ${UI_COLORS.accent}66`,
                                        maxWidth: 180,
                                        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                                    }}
                                />
                            </Box>
                            {neighborAnchorCandidates.length === 0 ? (
                                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                                    Sin vecinos directos en el grafo.
                                </CyberText>
                            ) : (
                                <>
                                    <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mb: 0.35, letterSpacing: 0.5 }}>
                                        VECINOS (click = ancla extra · máx. 3)
                                    </CyberText>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                        {neighborAnchorCandidates.map((e) => {
                                            const active = extraAnchorIds.includes(e.id);
                                            return (
                                                <Chip
                                                    key={e.id}
                                                    label={e.title}
                                                    size="small"
                                                    onClick={() => setExtraAnchorIds((prev) => {
                                                        const primary = selectedEntity.id;
                                                        const without = prev.filter((id) => id !== e.id && id !== primary);
                                                        if (active) return [primary, ...without];
                                                        return [primary, ...without, e.id].slice(0, 4);
                                                    })}
                                                    sx={{
                                                        height: 20,
                                                        fontSize: "0.6rem",
                                                        cursor: "pointer",
                                                        bgcolor: active ? `${UI_COLORS.anomaly}22` : "transparent",
                                                        color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                                        border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}55`,
                                                        maxWidth: 140,
                                                        "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                </>
                            )}
                        </>
                    )}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                        <HistoryIcon sx={{ fontSize: "0.85rem", color: UI_COLORS.textSecondary }} />
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, flex: 1 }}>
                            {activeThreadId ? `Hilo activo · ${threadMessages.length} msgs` : "Nuevo hilo al generar"}
                        </CyberText>
                        {activeThreadId && (
                            <Button size="small" onClick={() => setActiveThreadId(null)}
                                sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, minWidth: 0, py: 0 }}>
                                NUEVO
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Intent (situation only) */}
                {mode === AI_MODES.SITUATION && (
                    <LabDropdown
                        label="Intención (opcional)"
                        value={intent}
                        onChange={setIntent}
                        options={[
                            {
                                value: "",
                                label: "Sin intención específica",
                                hint: "La IA elige el tono y el tipo de escena según el subgrafo de la entidad ancla.",
                            },
                            ...SITUATION_INTENTS.map((i) => ({
                                value: i.value,
                                label: i.label,
                                hint: i.tooltip,
                            })),
                        ]}
                    />
                )}

                {/* Instruction (narrative_impact + cascade) */}
                {(mode === AI_MODES.NARRATIVE_IMPACT || mode === AI_MODES.CASCADE) && (
                    <>
                        <TextField
                            multiline
                            minRows={mode === AI_MODES.CASCADE ? 3 : 2}
                            maxRows={5}
                            value={instruction}
                            onChange={(e) => handleInstructionChange(e.target.value)}
                            placeholder={
                                mode === AI_MODES.CASCADE
                                    ? 'ej: "Zorgun muere en batalla, dejando a Oni sin su único pilar"'
                                    : 'ej: "Haz que Engel muera", "Galathia firma tregua con Mirage"'
                            }
                            label={mode === AI_MODES.CASCADE ? "Evento narrativo" : "Instrucción narrativa"}
                            size="small"
                            fullWidth
                            sx={{
                                "& .MuiInputBase-root": { ...selectSx, alignItems: "flex-start" },
                                "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.78rem" },
                            }}
                        />

                        {/* Cascade mention preview */}
                        {mode === AI_MODES.CASCADE && mentionPreview && (
                            <Box
                                sx={{
                                    p: 1,
                                    bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    borderRadius: 1,
                                }}
                            >
                                <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 1 }}>
                                    ENTIDADES DETECTADAS EN EL TEXTO
                                </CyberText>
                                {mentionPreview.resolved.length > 0 && (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.5 }}>
                                        {mentionPreview.resolved.map((m, i) => (
                                            <Chip
                                                key={i}
                                                label={`${m.text} → ${m.entity.title}`}
                                                size="small"
                                                sx={{
                                                    height: 18,
                                                    fontSize: "0.58rem",
                                                    bgcolor: `${UI_COLORS.anomaly}18`,
                                                    color: UI_COLORS.anomaly,
                                                    border: `1px solid ${UI_COLORS.anomaly}44`,
                                                    "& .MuiChip-label": { px: 0.75 },
                                                }}
                                            />
                                        ))}
                                    </Box>
                                )}
                                {mentionPreview.ambiguous.length > 0 && (
                                    <Box>
                                        {mentionPreview.ambiguous.map((a, i) => (
                                            <CyberText key={i} sx={{ fontSize: "0.63rem", color: "#ffa726", display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <WarningAmberIcon sx={{ fontSize: "0.8rem" }} />
                                                &quot;{a.text}&quot; es ambiguo ({a.candidates.map((c) => c.title).join(", ")})
                                            </CyberText>
                                        ))}
                                    </Box>
                                )}
                                {mentionPreview.resolved.length === 0 && mentionPreview.ambiguous.length === 0 && (
                                    <CyberText sx={{ fontSize: "0.63rem", color: UI_COLORS.textSecondary }}>
                                        No se detectaron entidades del wiki. Escribe nombres propios con mayúscula.
                                    </CyberText>
                                )}
                            </Box>
                        )}
                    </>
                )}

                {/* Propagation depth slider (cascade only) */}
                {mode === AI_MODES.CASCADE && (
                    <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.25 }}>
                            <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                                Profundidad de propagación
                            </CyberText>
                            <Chip
                                label={`${propagationDepth} ondas`}
                                size="small"
                                sx={{
                                    height: 16,
                                    fontSize: "0.58rem",
                                    bgcolor: `${UI_COLORS.anomaly}18`,
                                    color: UI_COLORS.anomaly,
                                    border: `1px solid ${UI_COLORS.anomaly}44`,
                                    "& .MuiChip-label": { px: 0.75 },
                                }}
                            />
                        </Box>
                        <Slider
                            value={propagationDepth}
                            min={1}
                            max={8}
                            step={1}
                            marks
                            onChange={(_, v) => {
                                setPropagationDepth(v);
                                if (selectedEntity) {
                                    const opts = cascadeOptsForDepth(v);
                                    const { waves } = computePropagationWaves(
                                        selectedEntity.id, graphEntities, relations,
                                        { strategy: "cascade", maxWaves: opts.maxWaves, ...propagationOpts }
                                    );
                                    onPropagationStart?.(waves, { preview: true });
                                }
                            }}
                            sx={{
                                color: UI_COLORS.anomaly,
                                "& .MuiSlider-thumb": { width: 12, height: 12 },
                                "& .MuiSlider-mark": { bgcolor: `${UI_COLORS.anomaly}44` },
                                "& .MuiSlider-markActive": { bgcolor: UI_COLORS.anomaly },
                                py: 0.75,
                            }}
                        />
                        <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                            {estimatedTokens != null
                                ? `${formatTokenEstimate(estimatedTokens)} tokens estimados`
                                : `recom. 3–4 ondas · núcleo ~${12 + propagationDepth * 6} fichas`}
                            {" · depth alta gasta salida JSON"}
                        </CyberText>
                    </Box>
                )}

                {/* Inspiración rápida */}
                {mode === AI_MODES.SITUATION && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {INSPIRATION_PROMPTS.map((p) => (
                            <Button
                                key={p.label}
                                size="small"
                                variant="outlined"
                                startIcon={<LightbulbIcon sx={{ fontSize: "0.9rem !important" }} />}
                                onClick={() => {
                                    setIntent(p.intent);
                                    setInstruction(p.instruction);
                                }}
                                sx={{
                                    fontSize: "0.62rem",
                                    borderColor: `${UI_COLORS.anomaly}55`,
                                    color: UI_COLORS.anomaly,
                                    py: 0.25,
                                }}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </Box>
                )}

                {/* Generate + variation */}
                <Box sx={{ display: "flex", gap: 0.75 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        disabled={
                            loading
                            || !selectedEntity
                            || ((mode === AI_MODES.NARRATIVE_IMPACT || mode === AI_MODES.CASCADE) && !instruction.trim())
                        }
                        onClick={() => handleGenerate()}
                        startIcon={loading ? <CircularProgress size={14} sx={{ color: UI_COLORS.anomaly }} /> : <AutoAwesomeIcon />}
                        sx={{
                            borderColor: UI_COLORS.anomaly,
                            color: loading ? UI_COLORS.textSecondary : UI_COLORS.anomaly,
                            fontSize: "0.75rem",
                            fontFamily: "'Orbitron', sans-serif",
                            letterSpacing: 1,
                            "&:hover": { borderColor: UI_COLORS.anomaly, bgcolor: `${UI_COLORS.anomaly}12` },
                            "&:disabled": { borderColor: UI_COLORS.border, color: UI_COLORS.textSecondary },
                        }}
                    >
                        {loading ? loadingLabel : "Generar"}
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        disabled={
                            loading
                            || !selectedEntity
                            || !result
                            || ((mode === AI_MODES.NARRATIVE_IMPACT || mode === AI_MODES.CASCADE) && !instruction.trim())
                        }
                        onClick={() => handleGenerate({ variation: true })}
                        sx={{
                            minWidth: 0,
                            px: 1.25,
                            borderColor: `${UI_COLORS.accent}88`,
                            color: UI_COLORS.accent,
                            fontSize: "0.62rem",
                            fontFamily: "'Orbitron', sans-serif",
                            letterSpacing: 0.5,
                            whiteSpace: "nowrap",
                            "&:hover": { borderColor: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}12` },
                            "&:disabled": { borderColor: UI_COLORS.border, color: UI_COLORS.textSecondary },
                        }}
                    >
                        Otra idea
                    </Button>
                </Box>

                {/* Context meta */}
                {(contextMeta || estimatedTokens != null) && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.25 }}>
                            {contextMeta && (
                                <>
                                    <MetaBadge label="fichas" value={contextMeta.entityCount} />
                                    <MetaBadge label="relaciones" value={contextMeta.relationCount} />
                                    {contextMeta.waveCount != null && (
                                        <MetaBadge label="ondas" value={contextMeta.waveCount} />
                                    )}
                                    {contextMeta.impactTargetCount != null && (
                                        <MetaBadge label="impactos" value={contextMeta.impactTargetCount} />
                                    )}
                                    {contextMeta.truncated && <MetaBadge label="truncado" value="SÍ" warn />}
                                </>
                            )}
                            {estimatedTokens != null && (
                                <MetaBadge label="ctx est." value={formatTokenEstimate(estimatedTokens)} />
                            )}
                            {tokenUsage && (
                                <MetaBadge
                                    label="tokens"
                                    value={`${tokenUsage.promptTokenCount ?? tokenUsage.prompt_tokens ?? "?"} in / ${tokenUsage.candidatesTokenCount ?? tokenUsage.completion_tokens ?? "?"} out`}
                                />
                            )}
                            {lastContextText && (
                                <Button
                                    size="small"
                                    onClick={() => setShowContextText((v) => !v)}
                                    sx={{
                                        ml: 0.5,
                                        minWidth: 0,
                                        fontSize: "0.55rem",
                                        fontFamily: "'Orbitron', sans-serif",
                                        letterSpacing: 0.5,
                                        color: UI_COLORS.anomaly,
                                        border: `1px solid ${UI_COLORS.anomaly}44`,
                                        py: 0.1,
                                        px: 0.75,
                                    }}
                                >
                                    {showContextText ? "Ocultar contexto" : "Ver lo que vio la IA"}
                                </Button>
                            )}
                        </Box>
                        <Collapse in={showContextText && Boolean(lastContextText)}>
                            <Box
                                sx={{
                                    mt: 0.5,
                                    p: 1,
                                    maxHeight: 220,
                                    overflow: "auto",
                                    bgcolor: `${UI_COLORS.backgroundPrimary}ee`,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    borderRadius: 1,
                                    ...CYBER_SCROLL_STYLE,
                                }}
                            >
                                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>
                                    Texto exacto enviado como contexto (subgrafo + fichas). Si falta alguien
                                    o salió "truncado", baja las ondas o ajusta anclas/leyenda.
                                </CyberText>
                                <Box
                                    component="pre"
                                    sx={{
                                        m: 0,
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        fontSize: "0.62rem",
                                        fontFamily: "'Fira Sans', monospace",
                                        color: UI_COLORS.textPrimary,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {lastContextText}
                                </Box>
                            </Box>
                        </Collapse>
                    </Box>
                )}
            </Box>

            {/* Results */}
            <Box
                sx={{
                    flexShrink: 0,
                    px: 1.5,
                    py: 1.5,
                }}
            >
                {/* Error */}
                {error && (
                    <Box sx={{ p: 1.5, bgcolor: `${UI_COLORS.accentStrong}18`, border: `1px solid ${UI_COLORS.accentStrong}44`, borderRadius: 1 }}>
                        <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.accentStrong }}>
                            {error}
                        </CyberText>
                        {!hasGeminiKey && (
                            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                                Configura <code>VITE_GEMINI_API_KEY</code> en el entorno de build
                                (local: <code>.env</code> · producción: Cloudflare Pages → Environment variables).
                            </CyberText>
                        )}
                    </Box>
                )}

                {/* ── Results: Situation mode ── */}
                {result && mode === AI_MODES.SITUATION && (
                    <Box>
                        <Divider sx={{ bgcolor: UI_COLORS.border, mb: 1.5 }} />
                        <CyberTitle sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 1, letterSpacing: 2 }}>
                            SITUACIONES PROPUESTAS
                        </CyberTitle>
                        {result.errors?.length > 0 && (
                            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.accentStrong, mb: 1 }}>
                                {result.errors.join(" | ")}
                            </CyberText>
                        )}
                        {(result.situations ?? []).map((s, i) => (
                            <SituationCard
                                key={i}
                                situation={s}
                                index={i}
                                saving={savingDraftIdx === i}
                                onSaveDraft={(sit) => handleSaveSituationDraft(sit, i)}
                            />
                        ))}
                        {result.situations?.length === 0 && (
                            <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textSecondary }}>
                                No se generaron situaciones.
                            </CyberText>
                        )}
                    </Box>
                )}

                {/* ── Results: Narrative impact mode ── */}
                {result && mode === AI_MODES.NARRATIVE_IMPACT && (
                    <Box>
                        <Divider sx={{ bgcolor: UI_COLORS.border, mb: 1.5 }} />
                        {result.summary && (
                            <Box sx={{ mb: 1.5, p: 1, bgcolor: `${UI_COLORS.backgroundPrimary}cc`, borderRadius: 1, border: `1px solid ${UI_COLORS.border}` }}>
                                <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary }}>
                                    {result.summary}
                                </CyberText>
                            </Box>
                        )}

                        <CyberTitle sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 1, letterSpacing: 2 }}>
                            RELACIONES PROPUESTAS ({result.proposedRelations?.length ?? 0})
                        </CyberTitle>

                        {(result.proposedRelations ?? []).map((rel, i) => (
                            <Box
                                key={i}
                                sx={{
                                    border: `1px solid ${rel.valid ? UI_COLORS.border : `${UI_COLORS.accentStrong}66`}`,
                                    borderLeft: `3px solid ${rel.valid ? CONFIDENCE_COLORS[rel.confidence] ?? UI_COLORS.accent : UI_COLORS.accentStrong}`,
                                    borderRadius: 1,
                                    p: 1.25,
                                    mb: 1,
                                    bgcolor: `${UI_COLORS.backgroundPrimary}cc`,
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5, flexWrap: "wrap" }}>
                                    <Chip
                                        icon={ACTION_ICONS[rel.action]}
                                        label={ACTION_LABELS[rel.action] ?? rel.action}
                                        size="small"
                                        sx={{
                                            height: 20,
                                            fontSize: "0.62rem",
                                            bgcolor: `${UI_COLORS.anomaly}18`,
                                            color: UI_COLORS.anomaly,
                                            "& .MuiChip-icon": { fontSize: "0.8rem", color: UI_COLORS.anomaly },
                                        }}
                                    />
                                    <Tooltip title={CONFIDENCE_TOOLTIPS[rel.confidence] ?? ""} slotProps={tooltipSlotProps}>
                                        <Chip
                                            label={rel.confidence}
                                            size="small"
                                            sx={{
                                                height: 18,
                                                fontSize: "0.6rem",
                                                bgcolor: `${CONFIDENCE_COLORS[rel.confidence] ?? UI_COLORS.accent}22`,
                                                color: CONFIDENCE_COLORS[rel.confidence] ?? UI_COLORS.accent,
                                                cursor: "help",
                                            }}
                                        />
                                    </Tooltip>
                                    {!rel.valid && (
                                        <Chip
                                            icon={<ErrorOutlineIcon />}
                                            label="inválida"
                                            size="small"
                                            sx={{
                                                height: 18,
                                                fontSize: "0.6rem",
                                                bgcolor: `${UI_COLORS.accentStrong}22`,
                                                color: UI_COLORS.accentStrong,
                                                "& .MuiChip-icon": { fontSize: "0.8rem", color: UI_COLORS.accentStrong },
                                            }}
                                        />
                                    )}
                                </Box>

                                <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary, mb: 0.5 }}>
                                    <strong>{rel.fromEntityTitle}</strong>
                                    <span style={{ color: UI_COLORS.textSecondary }}> → [{WIKI_RELATION_TYPE_LABELS[rel.relationType] ?? rel.relationType}] → </span>
                                    <strong>{rel.toEntityTitle}</strong>
                                </CyberText>

                                <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mb: 0.75 }}>
                                    {rel.reason}
                                </CyberText>

                                {rel.validationError && (
                                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.accentStrong, mb: 0.75, display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <CancelIcon sx={{ fontSize: "0.85rem" }} /> {rel.validationError}
                                    </CyberText>
                                )}

                                {rel.valid && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={applying}
                                        onClick={() => setApplyTarget(rel)}
                                        sx={{
                                            fontSize: "0.65rem",
                                            fontFamily: "'Orbitron', sans-serif",
                                            borderColor: UI_COLORS.accent,
                                            color: UI_COLORS.accent,
                                            letterSpacing: 1,
                                            py: 0.25,
                                            "&:hover": { bgcolor: `${UI_COLORS.accent}12` },
                                        }}
                                    >
                                        Aplicar relación
                                    </Button>
                                )}
                            </Box>
                        ))}

                        {result.blockedSuggestions?.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                <CyberTitle sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.75, letterSpacing: 2 }}>
                                    REQUIEREN ACCIÓN MANUAL ({result.blockedSuggestions.length})
                                </CyberTitle>
                                {result.blockedSuggestions.map((b, i) => (
                                    <Box key={i} sx={{ p: 1, mb: 0.75, bgcolor: `${UI_COLORS.backgroundPrimary}cc`, border: `1px solid ${UI_COLORS.border}`, borderRadius: 1 }}>
                                        <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textPrimary, mb: 0.25, display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                                            <BlockIcon sx={{ fontSize: "0.9rem", mt: 0.1, flexShrink: 0 }} />
                                            {b.description}
                                        </CyberText>
                                        <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary }}>
                                            {b.reason}
                                        </CyberText>
                                    </Box>
                                ))}
                            </Box>
                        )}

                        {result.dmNotes && (
                            <Box sx={{ mt: 1, p: 1, bgcolor: `${UI_COLORS.accentStrong}11`, border: `1px solid ${UI_COLORS.accentStrong}33`, borderRadius: 1 }}>
                                <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary }}>Notas DM:</CyberText>
                                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary }}>
                                    {result.dmNotes}
                                </CyberText>
                            </Box>
                        )}
                    </Box>
                )}

                {/* ── Results: Cascade mode ── */}
                {result && mode === AI_MODES.CASCADE && (
                    <WikiCascadeResult
                        result={result}
                        campaignId={campaignId}
                        eventInstruction={instruction}
                    />
                )}
            </Box>
            </Box>

            {/* ── Confirm apply dialog ── */}
            <Dialog
                open={Boolean(applyTarget)}
                onClose={() => setApplyTarget(null)}
                sx={{ zIndex: Z_INDEX.wikiDialog }}
                PaperProps={{
                    sx: { bgcolor: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.border}`, minWidth: 340 },
                }}
            >
                <DialogTitle sx={{ color: UI_COLORS.accent, fontFamily: "'Orbitron', sans-serif", fontSize: "0.9rem", letterSpacing: 2 }}>
                    CONFIRMAR RELACIÓN
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: UI_COLORS.textPrimary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.85rem" }}>
                        {applyTarget && (
                            <>
                                <strong>{ACTION_LABELS[applyTarget.action] ?? applyTarget.action}</strong> relación:
                                <br />
                                <br />
                                <strong>{applyTarget.fromEntityTitle}</strong>
                                {" → "}
                                [{WIKI_RELATION_TYPE_LABELS[applyTarget.relationType] ?? applyTarget.relationType}]
                                {" → "}
                                <strong>{applyTarget.toEntityTitle}</strong>
                                <br />
                                <br />
                                <span style={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>
                                    Razón: {applyTarget.reason}
                                </span>
                            </>
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setApplyTarget(null)}
                        sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.8rem" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => applyTarget && handleApplyRelation(applyTarget)}
                        disabled={applying}
                        variant="contained"
                        sx={{
                            bgcolor: UI_COLORS.accent,
                            color: "#000",
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.75rem",
                            "&:hover": { bgcolor: UI_COLORS.accentStrong },
                        }}
                    >
                        {applying ? <CircularProgress size={14} /> : "Aplicar"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
