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
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    AI_MODES, AI_MODE_LABELS, AI_MODE_TOOLTIPS, SITUATION_INTENTS,
    AI_PROVIDERS, AI_PROVIDER_LABELS, AI_PROVIDER_TOOLTIPS,
    CONFIDENCE_TOOLTIPS, TONE_LABELS,
    GEMINI_MODELS, OPENROUTER_MODELS,
    CASCADE_CONTEXT_OPTS, cascadeOptsForDepth,
} from "../../constants/wiki/narrativeAiSchemas";
import {
    buildSituationContext,
    buildCascadeContext,
    computePropagationWaves,
} from "../../utils/buildSituationContext";
import { resolveWikiMentions }   from "../../utils/resolveWikiMentions";
import { validateAiResponse }    from "../../utils/validateAiResponse";
import { generateNarrativeAi }   from "../../../firebase/services/narrativeAiService";
import { addWikiRelation, removeWikiRelation } from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";
import { WIKI_RELATION_TYPE_LABELS, defaultStrengthForRelationType } from "../../constants/wikiRelationTypes";
import WikiCascadeResult from "./WikiCascadeResult";
import {
    resolveNarrativeAiConfig,
    getExplicitlyMentionedEntityIds,
} from "../../constants/wiki/narrativeAiConfig";
import { filterGraphEntities } from "../../utils/wikiGraphEntities";

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
                onClick={(e) => setAnchorEl(e.currentTarget)}
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
                hideBackdrop
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            ...labMenuPaperSx,
                            minWidth: anchorEl?.offsetWidth ?? 200,
                        },
                    },
                }}
                sx={{ zIndex: 1700 }}
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
        <CyberText
            component="span"
            sx={{
                fontSize: "0.7rem",
                color: warn ? UI_COLORS.accentStrong : UI_COLORS.textSecondary,
                mr: 1.5,
            }}
        >
            {label}: <strong style={{ color: warn ? UI_COLORS.accentStrong : UI_COLORS.anomaly }}>{value}</strong>
        </CyberText>
    );
}

function SituationCard({ situation, index }) {
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
                            <CyberText key={i} sx={{ fontSize: "0.7rem", color: UI_COLORS.accentStrong }}>
                                ⚠ {e}
                            </CyberText>
                        ))}
                    </Box>
                )}
            </Collapse>
        </Box>
    );
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

    // Controls
    const hasGeminiDirect = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
    const hasOpenRouter   = Boolean(import.meta.env.VITE_OPENROUTER_API_KEY);
    const defaultProvider = hasGeminiDirect
        ? AI_PROVIDERS.GEMINI_DIRECT
        : hasOpenRouter
            ? AI_PROVIDERS.OPENROUTER
            : AI_PROVIDERS.GEMINI;

    const [mode, setMode]           = useState(AI_MODES.SITUATION);
    const [provider, setProvider]   = useState(defaultProvider);
    const [modelId, setModelId]     = useState(GEMINI_MODELS[0].value);
    const [intent, setIntent]       = useState("");
    const [instruction, setInstruction] = useState("");

    // Cascade propagation depth (slider 1–8)
    const [propagationDepth, setPropagationDepth] = useState(4);

    // Cascade: live mention preview from instruction text
    const [mentionPreview, setMentionPreview] = useState(null);

    // Results
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);
    const [result, setResult]       = useState(null);
    const [contextMeta, setContextMeta] = useState(null);
    const [tokenUsage, setTokenUsage]   = useState(null);

    // Apply confirmation dialog
    const [applyTarget, setApplyTarget] = useState(null);
    const [applying, setApplying]       = useState(false);

    const modelOptions = provider === AI_PROVIDERS.OPENROUTER ? OPENROUTER_MODELS : GEMINI_MODELS;
    const graphEntities = filterGraphEntities(entities);

    const propagationOpts = useMemo(() => ({
        aiRules,
        eventText: instruction,
    }), [aiRules, instruction]);

    const handleProviderChange = (newProvider) => {
        setProvider(newProvider);
        setModelId(newProvider === AI_PROVIDERS.OPENROUTER
            ? OPENROUTER_MODELS[0].value
            : GEMINI_MODELS[0].value
        );
    };

    // Live mention preview (cascade only, debounced by user typing)
    const handleInstructionChange = useCallback((value) => {
        setInstruction(value);
        if (mode === AI_MODES.CASCADE && value.trim().length > 3) {
            const { resolved, ambiguous } = resolveWikiMentions(value, entities);
            setMentionPreview({ resolved, ambiguous });
        } else {
            setMentionPreview(null);
        }
    }, [mode, entities]);

    const handleGenerate = useCallback(async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        setContextMeta(null);
        setTokenUsage(null);

        try {
            const anchorId = selectedEntity?.id;

            if (mode === AI_MODES.CASCADE) {
                const depthOpts = cascadeOptsForDepth(propagationDepth);
                const { waves } = computePropagationWaves(anchorId, graphEntities, relations, {
                    strategy: "cascade",
                    maxWaves: depthOpts.maxWaves,
                    ...propagationOpts,
                });
                onPropagationStart?.(waves);

                // CASCADE: wider context, wave pre-computation, mention expansion
                const ctx = buildCascadeContext(graphEntities, relations, {
                    anchorEntityId: anchorId,
                    eventText: instruction,
                    role: "dm",
                    aiRules,
                    ...depthOpts,
                }, graphEntities);
                setContextMeta(ctx.meta);

                const { raw, usage } = await generateNarrativeAi({
                    mode,
                    contextText:      ctx.text,
                    instruction:      instruction || null,
                    resolvedMentions: ctx.resolvedMentions,
                    guardrailsText:   ctx.guardrailsText,
                    generationParams,
                    provider,
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
                });
                setResult(validated);
            } else {
                const { waves } = computePropagationWaves(anchorId, graphEntities, relations, {
                    strategy: "bfs",
                    maxDepth: 2,
                    ...propagationOpts,
                });
                onPropagationStart?.(waves);

                // SITUATION / NARRATIVE_IMPACT: standard flow
                const ctx = buildSituationContext(graphEntities, relations, {
                    anchorEntityId: anchorId,
                    intent,
                    role: "dm",
                });
                setContextMeta(ctx.meta);

                const { raw, usage } = await generateNarrativeAi({
                    mode,
                    contextText: ctx.text,
                    intent:      intent || null,
                    instruction: instruction || null,
                    generationParams,
                    provider,
                    modelId,
                });
                setTokenUsage(usage);

                const contextEntities = graphEntities.filter((e) => ctx.meta.entityIds.includes(e.id));
                const validated = validateAiResponse(mode, raw, contextEntities, graphEntities);
                setResult(validated);
            }
        } catch (err) {
            setError(err.message ?? "Error desconocido.");
        } finally {
            onPropagationEnd?.();
            setLoading(false);
        }
    }, [mode, provider, modelId, intent, instruction, selectedEntity, graphEntities, relations, aiRules, generationParams, propagationOpts, onPropagationStart, onPropagationEnd]);

    // When the anchor entity or depth changes in cascade mode, update the static preview halo.
    // When leaving cascade mode, clear it.
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
    }, [mode, selectedEntity?.id, propagationDepth, graphEntities, relations, aiRules, instruction, onPropagationStart, onPropagationEnd]);

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

            {/* Controls (scrollable) */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    px: 1.5,
                    py: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    ...CYBER_SCROLL_STYLE,
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

                {/* Provider + Model */}
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <LabDropdown
                            label="Proveedor"
                            value={provider}
                            onChange={handleProviderChange}
                            options={[
                                {
                                    value: AI_PROVIDERS.GEMINI,
                                    label: AI_PROVIDER_LABELS[AI_PROVIDERS.GEMINI],
                                    hint: AI_PROVIDER_TOOLTIPS[AI_PROVIDERS.GEMINI],
                                },
                                {
                                    value: AI_PROVIDERS.GEMINI_DIRECT,
                                    label: AI_PROVIDER_LABELS[AI_PROVIDERS.GEMINI_DIRECT],
                                    hint: AI_PROVIDER_TOOLTIPS[AI_PROVIDERS.GEMINI_DIRECT],
                                    disabled: !hasGeminiDirect,
                                    suffix: !hasGeminiDirect ? " (sin key)" : "",
                                },
                                {
                                    value: AI_PROVIDERS.OPENROUTER,
                                    label: AI_PROVIDER_LABELS[AI_PROVIDERS.OPENROUTER],
                                    hint: AI_PROVIDER_TOOLTIPS[AI_PROVIDERS.OPENROUTER],
                                    disabled: !hasOpenRouter,
                                    suffix: !hasOpenRouter ? " (sin key)" : "",
                                },
                            ]}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
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
                                maxWidth: 160,
                            }}
                        />
                    ) : (
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.accentStrong }}>
                            Selecciona una entidad en el wiki
                        </CyberText>
                    )}
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
                                            <CyberText key={i} sx={{ fontSize: "0.63rem", color: "#ffa726" }}>
                                                ⚠ "{a.text}" es ambiguo ({a.candidates.map((c) => c.title).join(", ")})
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
                            {`~${12000 + propagationDepth * 2500} tokens · ${20 + propagationDepth * 10} fichas máx`}
                        </CyberText>
                    </Box>
                )}

                {/* Generate button */}
                <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    disabled={
                        loading
                        || !selectedEntity
                        || ((mode === AI_MODES.NARRATIVE_IMPACT || mode === AI_MODES.CASCADE) && !instruction.trim())
                    }
                    onClick={handleGenerate}
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
                    {loading ? "Generando…" : "Generar"}
                </Button>

                {/* Context meta */}
                {contextMeta && (
                    <Box>
                        <MetaBadge label="fichas" value={contextMeta.entityCount} />
                        <MetaBadge label="relaciones" value={contextMeta.relationCount} />
                        {contextMeta.waveCount != null && (
                            <MetaBadge label="ondas" value={contextMeta.waveCount} />
                        )}
                        {contextMeta.impactTargetCount != null && (
                            <MetaBadge label="impactos" value={contextMeta.impactTargetCount} />
                        )}
                        {contextMeta.truncated && <MetaBadge label="truncado" value="SÍ" warn />}
                        {tokenUsage && (
                            <MetaBadge
                                label="tokens"
                                value={`${tokenUsage.promptTokenCount ?? tokenUsage.prompt_tokens ?? "?"} in / ${tokenUsage.candidatesTokenCount ?? tokenUsage.completion_tokens ?? "?"} out`}
                            />
                        )}
                    </Box>
                )}

                {/* Error */}
                {error && (
                    <Box sx={{ p: 1.5, bgcolor: `${UI_COLORS.accentStrong}18`, border: `1px solid ${UI_COLORS.accentStrong}44`, borderRadius: 1 }}>
                        <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.accentStrong }}>
                            {error}
                        </CyberText>
                        {error.includes("firebase-tools") || error.includes("PERMISSION_DENIED") ? (
                            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                                Ejecuta: <code>npx -y firebase-tools@latest init ailogic</code>
                            </CyberText>
                        ) : null}
                        {error.includes("prepayment credits") || error.includes("depleted") ? (
                            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, mt: 0.5 }}>
                                Los créditos prepago del proyecto Firebase están agotados.
                                Solución rápida: añade <code>VITE_GEMINI_API_KEY</code> al <code>.env</code>
                                (misma clave que <code>GEMINI_API_KEY</code> del CLI), reinicia <code>npm run dev</code>
                                y usa proveedor <strong>Gemini API (local)</strong>.
                                O recarga créditos en{" "}
                                <a href="https://ai.studio/projects" target="_blank" rel="noreferrer" style={{ color: UI_COLORS.anomaly }}>
                                    ai.studio/projects
                                </a>.
                            </CyberText>
                        ) : null}
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
                            <SituationCard key={i} situation={s} index={i} />
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
                                    <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.accentStrong, mb: 0.75 }}>
                                        ✗ {rel.validationError}
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
                                        <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textPrimary, mb: 0.25 }}>
                                            🚫 {b.description}
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

            {/* ── Confirm apply dialog ── */}
            <Dialog
                open={Boolean(applyTarget)}
                onClose={() => setApplyTarget(null)}
                sx={{ zIndex: 1500 }}
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
