/**
 * NAR dossier — gamified relationship track (wiki entityRelations).
 * Sync Meter (−10…+10) + rank names. Players: view + filter.
 * DM: drag strength, add/remove relations (manual, spoiler-safe).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Autocomplete,
    Box,
    CircularProgress,
    Collapse,
    FormControl,
    IconButton,
    InputBase,
    MenuItem,
    Select,
    TextField,
    createFilterOptions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SearchIcon from "@mui/icons-material/Search";
import { useDispatch, useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { WIKI_ENTITY_TYPES, WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";
import {
    WIKI_RELATION_STRENGTH_MAX,
    WIKI_RELATION_STRENGTH_MIN,
    WIKI_RELATION_TYPES,
    defaultStrengthForRelation,
    filterAffinityRelatableEntities,
    getAffinityRelationTypeOptionsForContext,
    getRelationDisplayLabel,
    isAffinityRelation,
    resolveRelationEndpoints,
    suggestRelationTypeForPair,
    validateRelationCreate,
} from "../../constants/wikiRelationTypes";
import { isKnownPlayerCharacterName, isPlayerCharacter } from "../../utils/characterRosterKind";
import { resolveWikiEntityImagePath } from "../../utils/resolveWikiEntityImage";
import {
    addWikiRelation,
    removeWikiRelation,
    updateWikiRelation,
} from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";
import CharAvatar from "./CharAvatar";
import { syncRankFromStrength } from "../../utils/syncRank";

export { syncRankFromStrength };

const NAR_ACCENT = UI_COLORS.accentStrong;

const FILTER_CHIPS = [
    { id: "all", label: "TODOS" },
    { id: "pj", label: "PJ" },
    { id: "npc", label: "NPC" },
    { id: "locacion", label: "LUGARES" },
    { id: "organizacion", label: "ORGS" },
    { id: "ideologia", label: "IDEOL." },
    { id: "other", label: "OTROS" },
];

/** Chips for DM create form — affinity targets only. */
const CREATE_TYPE_CHIPS = [
    { id: "all", label: "TODOS" },
    { id: WIKI_ENTITY_TYPES.PERSONAJE, label: "PERSONAJES" },
    { id: WIKI_ENTITY_TYPES.ORGANIZACION, label: "ORGS" },
    { id: WIKI_ENTITY_TYPES.LOCACION, label: "LUGARES" },
    { id: WIKI_ENTITY_TYPES.IDEOLOGIA, label: "IDEOL." },
];

function suggestAffinityType(fromEntity, toEntity) {
    const affinityOpts = getAffinityRelationTypeOptionsForContext(fromEntity, toEntity);
    if (!affinityOpts.length) return "";
    const suggested = suggestRelationTypeForPair(fromEntity, toEntity);
    if (suggested && affinityOpts.some((o) => o.value === suggested)) return suggested;
    return affinityOpts[0].value;
}

const filterEntities = createFilterOptions({
    matchFrom: "any",
    stringify: (option) =>
        `${option.title} ${option.entityType || ""} ${(option.tags || []).join(" ")}`,
});

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "0.78rem",
        bgcolor: "rgba(8,8,14,0.55)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${NAR_ACCENT}66` },
        "&.Mui-focused fieldset": { borderColor: NAR_ACCENT },
    },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
};

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: '"Fira Code", monospace',
    fontSize: "0.72rem",
    bgcolor: "rgba(8,8,14,0.55)",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${NAR_ACCENT}66` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: NAR_ACCENT },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

function clampStrength(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Math.max(WIKI_RELATION_STRENGTH_MIN, Math.min(WIKI_RELATION_STRENGTH_MAX, Math.round(n)));
}

function strengthFromClientX(clientX, trackEl) {
    if (!trackEl) return 0;
    const rect = trackEl.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return clampStrength(t * 20 - 10);
}

function classifyPersonajeKind(entity, charactersById) {
    if (!entity || entity.entityType !== WIKI_ENTITY_TYPES.PERSONAJE) return null;
    const vttId = entity.linkedVttCharacterId;
    if (vttId && charactersById?.[vttId]) {
        return isPlayerCharacter(charactersById[vttId]) ? "pj" : "npc";
    }
    if (isKnownPlayerCharacterName(entity.title)) return "pj";
    return "npc";
}

function SyncMeter({ strength, interactive = false, disabled = false, onChange, onCommit }) {
    const trackRef = useRef(null);
    const dragging = useRef(false);
    const [local, setLocal] = useState(strength);
    const [hovering, setHovering] = useState(false);

    useEffect(() => {
        if (!dragging.current) setLocal(strength);
    }, [strength]);

    const s = Number.isFinite(local) ? local : 0;
    const pct = (Math.abs(s) / 10) * 50;
    const left = 50 + (s / 10) * 50;
    const rank = syncRankFromStrength(s);
    const fillBg =
        s > 0
            ? "linear-gradient(90deg, transparent, rgba(0,242,234,0.9))"
            : "linear-gradient(90deg, rgba(255,51,85,0.9), transparent)";
    const knobBorder =
        s > 0 ? UI_COLORS.anomaly : s < 0 ? UI_COLORS.danger : NAR_ACCENT;

    const applyFromEvent = useCallback((clientX, commit) => {
        const next = strengthFromClientX(clientX, trackRef.current);
        setLocal(next);
        onChange?.(next);
        if (commit) onCommit?.(next);
    }, [onChange, onCommit]);

    const onPointerDown = (e) => {
        if (!interactive || disabled) return;
        e.preventDefault();
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        applyFromEvent(e.clientX, false);
    };

    const onPointerMove = (e) => {
        if (!dragging.current || !interactive || disabled) return;
        applyFromEvent(e.clientX, false);
    };

    const endDrag = (e) => {
        if (!dragging.current) return;
        dragging.current = false;
        applyFromEvent(e.clientX, true);
    };

    return (
        <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.65, flexWrap: "wrap" }}>
                <Box
                    sx={{
                        px: 0.75,
                        py: 0.25,
                        border: `1px solid ${rank.color}77`,
                        bgcolor: `${rank.color}14`,
                        fontFamily: '"Orbitron", sans-serif',
                        fontSize: "0.5rem",
                        letterSpacing: "0.14em",
                        color: rank.color,
                        transition: "border-color 0.25s, color 0.25s, background-color 0.25s, box-shadow 0.25s",
                        boxShadow: hovering || dragging.current ? `0 0 10px ${rank.color}44` : "none",
                    }}
                >
                    {rank.label}
                </Box>
                <CyberText
                    sx={{
                        fontFamily: '"Orbitron", sans-serif',
                        fontSize: "0.55rem",
                        letterSpacing: "0.1em",
                        color: rank.color,
                        transition: "color 0.25s",
                    }}
                >
                    {s > 0 ? `+${s}` : `${s}`}
                </CyberText>
                {interactive && (
                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, ml: "auto" }}>
                        arrastra
                    </CyberText>
                )}
            </Box>

            <Box
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                role={interactive ? "slider" : "img"}
                aria-valuemin={WIKI_RELATION_STRENGTH_MIN}
                aria-valuemax={WIKI_RELATION_STRENGTH_MAX}
                aria-valuenow={s}
                aria-label="Afinidad SYNC"
                tabIndex={interactive && !disabled ? 0 : -1}
                onKeyDown={(e) => {
                    if (!interactive || disabled) return;
                    let next = s;
                    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = clampStrength(s + 1);
                    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = clampStrength(s - 1);
                    else if (e.key === "Home") next = WIKI_RELATION_STRENGTH_MIN;
                    else if (e.key === "End") next = WIKI_RELATION_STRENGTH_MAX;
                    else return;
                    e.preventDefault();
                    setLocal(next);
                    onChange?.(next);
                    onCommit?.(next);
                }}
                sx={{
                    position: "relative",
                    height: interactive ? 14 : 10,
                    borderRadius: "2px",
                    border: `1px solid ${hovering && interactive ? `${NAR_ACCENT}88` : UI_COLORS.border}`,
                    background:
                        "linear-gradient(90deg, rgba(255,51,85,0.28), rgba(255,255,255,0.06) 50%, rgba(0,242,234,0.28))",
                    overflow: "visible",
                    cursor: interactive && !disabled ? "ew-resize" : "default",
                    touchAction: "none",
                    userSelect: "none",
                    transition: "border-color 0.2s, height 0.2s, box-shadow 0.2s",
                    boxShadow: hovering && interactive ? `0 0 12px ${UI_COLORS.accentGlow}` : "none",
                    outline: "none",
                    "&:focus-visible": {
                        boxShadow: `0 0 0 1px ${NAR_ACCENT}`,
                    },
                }}
            >
                {s !== 0 && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            ...(s > 0
                                ? { left: "50%", width: `${pct}%` }
                                : { right: "50%", width: `${pct}%` }),
                            background: fillBg,
                            boxShadow:
                                s > 0
                                    ? "0 0 12px rgba(0,242,234,0.45)"
                                    : "0 0 12px rgba(255,51,85,0.45)",
                            opacity: 0.95,
                            transition: dragging.current
                                ? "none"
                                : "width 0.22s ease, box-shadow 0.22s ease",
                        }}
                    />
                )}
                <Box
                    sx={{
                        position: "absolute",
                        left: "50%",
                        top: -4,
                        bottom: -4,
                        width: 2,
                        bgcolor: NAR_ACCENT,
                        transform: "translateX(-50%)",
                        boxShadow: `0 0 6px ${UI_COLORS.accentGlow}`,
                        pointerEvents: "none",
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: `${left}%`,
                        width: interactive ? 14 : 11,
                        height: interactive ? 14 : 11,
                        border: `2px solid ${knobBorder}`,
                        borderRadius: "1px",
                        bgcolor: UI_COLORS.backgroundSecondary,
                        transform: "translate(-50%, -50%) rotate(45deg)",
                        boxShadow: `0 0 10px ${knobBorder}aa`,
                        zIndex: 2,
                        pointerEvents: "none",
                        transition: dragging.current
                            ? "none"
                            : "left 0.22s ease, border-color 0.22s, box-shadow 0.22s, width 0.15s, height 0.15s",
                    }}
                />
            </Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mt: 0.35,
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.48rem",
                    color: UI_COLORS.textSecondary,
                }}
            >
                <span>−10</span>
                <span>0</span>
                <span>+10</span>
            </Box>
        </Box>
    );
}

function RelationCard({
    row,
    canEdit,
    busy,
    confirmDelete,
    onAskDelete,
    onCancelDelete,
    onConfirmDelete,
    onStrengthCommit,
}) {
    return (
        <Box
            sx={{
                py: 1.15,
                px: 0.25,
                borderBottom: `1px solid ${UI_COLORS.border}`,
                animation: "narRelFade 0.28s ease",
                "@keyframes narRelFade": {
                    from: { opacity: 0, transform: "translateY(4px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
                "&:last-child": { borderBottom: 0 },
                transition: "background-color 0.2s",
                "&:hover": {
                    bgcolor: "rgba(255,255,255,0.02)",
                },
            }}
        >
            <Box sx={{ display: "flex", gap: 1, mb: 0.7 }}>
                <CharAvatar
                    imagePath={row.imagePath}
                    name={row.otherTitle}
                    size={38}
                    status={row.avatarStatus || "alive"}
                    crop={row.avatarCrop || null}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                        <CyberText
                            sx={{
                                fontSize: "0.84rem",
                                fontWeight: 600,
                                color: UI_COLORS.textPrimary,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {row.otherTitle}
                        </CyberText>
                        {canEdit && (
                            <Box sx={{ flexShrink: 0 }}>
                                {confirmDelete ? (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                                        <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.danger, mr: 0.25 }}>
                                            ¿Borrar?
                                        </CyberText>
                                        <IconButton
                                            size="small"
                                            disabled={busy}
                                            onClick={onConfirmDelete}
                                            aria-label="Confirmar borrar"
                                            sx={{ color: UI_COLORS.danger, p: 0.3 }}
                                        >
                                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={onCancelDelete}
                                            aria-label="Cancelar"
                                            sx={{ color: UI_COLORS.textSecondary, p: 0.3 }}
                                        >
                                            <CloseIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Box>
                                ) : (
                                    <IconButton
                                        size="small"
                                        disabled={busy}
                                        onClick={onAskDelete}
                                        aria-label="Eliminar relación"
                                        sx={{
                                            color: UI_COLORS.textSecondary,
                                            p: 0.35,
                                            "&:hover": { color: UI_COLORS.danger },
                                        }}
                                    >
                                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                )}
                            </Box>
                        )}
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.35, alignItems: "center" }}>
                        <Box
                            sx={{
                                px: 0.55,
                                py: 0.15,
                                border: `1px solid ${NAR_ACCENT}55`,
                                bgcolor: `${NAR_ACCENT}12`,
                                fontFamily: '"Fira Code", monospace',
                                fontSize: "0.55rem",
                                color: UI_COLORS.textPrimary,
                                letterSpacing: "0.04em",
                            }}
                        >
                            {row.relationLabel}
                        </Box>
                        {row.kindBadge && (
                            <Box
                                sx={{
                                    px: 0.45,
                                    py: 0.12,
                                    border: `1px solid ${UI_COLORS.border}`,
                                    fontFamily: '"Orbitron", sans-serif',
                                    fontSize: "0.48rem",
                                    letterSpacing: "0.1em",
                                    color: UI_COLORS.textSecondary,
                                }}
                            >
                                {row.kindBadge}
                            </Box>
                        )}
                        {row.otherTypeLabel && row.entityType !== WIKI_ENTITY_TYPES.PERSONAJE && (
                            <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                                {row.otherTypeLabel}
                            </CyberText>
                        )}
                    </Box>
                </Box>
            </Box>
            <SyncMeter
                strength={row.strength}
                interactive={canEdit}
                disabled={busy}
                onCommit={(next) => {
                    if (next !== row.strength) onStrengthCommit(row.id, next, row);
                }}
            />
        </Box>
    );
}

/**
 * @param {{
 *   entityId: string,
 *   campaignId: string,
 *   canEdit?: boolean,
 * }} props
 */
export default function DossierRelationTrack({
    entityId,
    campaignId,
    canEdit = false,
    /** @deprecated use canEdit */
    canEditStrength = false,
}) {
    const dmEdit = canEdit || canEditStrength;
    const dispatch = useDispatch();
    const relations = useSelector((s) => s.wiki.relations);
    const entities = useSelector((s) => s.wiki.entities);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const relationsStatus = useSelector((s) => s.wiki.relationsStatus);
    const loadedCampaignId = useSelector((s) => s.wiki.loadedCampaignId);
    const charactersById = useSelector((s) => s.world.charactersById || {});
    const locations = useSelector((s) => s.world.locations || {});
    const uid = useSelector((s) => s.player.profile?.uid);

    const graphLoading = Boolean(
        campaignId
        && (
            (loadedCampaignId && loadedCampaignId !== campaignId)
            || wikiStatus === "idle"
            || wikiStatus === "loading"
            || relationsStatus === "idle"
            || relationsStatus === "loading"
        ),
    );

    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [createTypeFilter, setCreateTypeFilter] = useState("all");
    const [busyId, setBusyId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [newTo, setNewTo] = useState(null);
    const [newType, setNewType] = useState("");
    const [newStrength, setNewStrength] = useState(0);
    const [newLabel, setNewLabel] = useState("");
    const [creating, setCreating] = useState(false);

    const selfEntity = useMemo(
        () => (entities || []).find((e) => e.id === entityId) || null,
        [entities, entityId]
    );

    const entityById = useMemo(() => {
        const map = new Map();
        for (const e of entities || []) {
            if (e?.id) map.set(e.id, e);
        }
        return map;
    }, [entities]);

    const relatableEntities = useMemo(() => {
        if (!selfEntity) return [];
        const pool = filterAffinityRelatableEntities(selfEntity, entities);
        if (createTypeFilter === "all") return pool;
        return pool.filter((e) => e.entityType === createTypeFilter);
    }, [selfEntity, entities, createTypeFilter]);

    const relationTypeOptions = useMemo(
        () => getAffinityRelationTypeOptionsForContext(selfEntity, newTo),
        [selfEntity, newTo]
    );

    const rows = useMemo(() => {
        if (!entityId) return [];
        const list = [];
        for (const rel of relations || []) {
            const from = rel.fromEntityId;
            const to = rel.toEntityId;
            if (from !== entityId && to !== entityId) continue;
            const outgoing = from === entityId;
            const otherId = outgoing ? to : from;
            const other = entityById.get(otherId);
            const selfType = selfEntity?.entityType || WIKI_ENTITY_TYPES.PERSONAJE;
            const entityType = other?.entityType || "";
            if (!isAffinityRelation({
                relationType: rel.relationType,
                fromEntityType: outgoing ? selfType : entityType,
                toEntityType: outgoing ? entityType : selfType,
            })) {
                continue;
            }
            const strength = Number.isFinite(rel.strength) ? rel.strength : 0;
            const personajeKind = classifyPersonajeKind(other, charactersById);
            let filterKey = "other";
            if (entityType === WIKI_ENTITY_TYPES.PERSONAJE) {
                filterKey = personajeKind === "pj" ? "pj" : "npc";
            } else if (entityType === WIKI_ENTITY_TYPES.LOCACION) {
                filterKey = "locacion";
            } else if (entityType === WIKI_ENTITY_TYPES.ORGANIZACION) {
                filterKey = "organizacion";
            } else if (entityType === WIKI_ENTITY_TYPES.IDEOLOGIA) {
                filterKey = "ideologia";
            }
            const kindBadge =
                entityType === WIKI_ENTITY_TYPES.PERSONAJE
                    ? (personajeKind === "pj" ? "PJ" : "NPC")
                    : null;
            const linkedChar = other?.linkedVttCharacterId
                ? (charactersById[other.linkedVttCharacterId] || null)
                : null;
            list.push({
                id: rel.id,
                strength,
                otherId,
                otherTitle: other?.title || otherId || "?",
                entityType,
                otherTypeLabel: WIKI_ENTITY_TYPE_LABELS[entityType] || entityType || "",
                relationLabel: getRelationDisplayLabel(rel.relationType, outgoing),
                relationType: rel.relationType,
                customLabel: rel.label || "",
                filterKey,
                kindBadge,
                rank: syncRankFromStrength(strength),
                imagePath: resolveWikiEntityImagePath(other, locations, charactersById),
                avatarStatus: linkedChar?.status || "alive",
                avatarCrop: linkedChar?.tokenCrop || null,
            });
        }
        list.sort(
            (a, b) =>
                Math.abs(b.strength) - Math.abs(a.strength)
                || a.otherTitle.localeCompare(b.otherTitle, "es")
        );
        return list;
    }, [relations, entityId, entityById, charactersById, selfEntity, locations]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((row) => {
            if (typeFilter !== "all" && row.filterKey !== typeFilter) return false;
            if (!q) return true;
            const hay = [
                row.otherTitle,
                row.relationLabel,
                row.otherTypeLabel,
                row.customLabel,
                row.rank.label,
                row.kindBadge || "",
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [rows, query, typeFilter]);

    const commitStrength = useCallback(async (relationId, nextStrength, row) => {
        if (!dmEdit || !campaignId || !relationId) return;
        const clamped = clampStrength(nextStrength);
        setBusyId(relationId);
        try {
            await dispatch(updateWikiRelation({
                campaignId,
                relationId,
                data: {
                    strength: clamped,
                    relationType: row?.relationType,
                    fromEntityType: selfEntity?.entityType,
                    toEntityType: row?.entityType,
                },
            })).unwrap();
        } catch (err) {
            console.error("[DossierRelationTrack] strength", err);
            dispatch(showSnackbar({
                message: "No se pudo actualizar la afinidad",
                severity: "error",
            }));
        } finally {
            setBusyId(null);
        }
    }, [dmEdit, campaignId, dispatch, selfEntity]);

    const handleRemove = useCallback(async (relationId) => {
        if (!dmEdit || !campaignId || !relationId) return;
        setBusyId(relationId);
        try {
            await dispatch(removeWikiRelation({ campaignId, relationId })).unwrap();
            setDeleteId(null);
        } catch (err) {
            console.error("[DossierRelationTrack] remove", err);
            dispatch(showSnackbar({
                message: "No se pudo eliminar la relación",
                severity: "error",
            }));
        } finally {
            setBusyId(null);
        }
    }, [dmEdit, campaignId, dispatch]);

    const resetAddForm = useCallback(() => {
        setAdding(false);
        setNewTo(null);
        setNewType("");
        setNewStrength(0);
        setNewLabel("");
        setCreateTypeFilter("all");
    }, []);

    const handleCreate = useCallback(async () => {
        if (!dmEdit || !campaignId || !selfEntity || !newTo || !newType) return;
        if (!validateRelationCreate(selfEntity, newTo, newType)) {
            dispatch(showSnackbar({
                message: "Tipo de relación no válido para ese par",
                severity: "warning",
            }));
            return;
        }
        if (!isAffinityRelation({
            relationType: newType,
            fromEntityType: selfEntity.entityType,
            toEntityType: newTo.entityType,
        })) {
            dispatch(showSnackbar({
                message: "Solo vínculos de afinidad desde el Dossier",
                severity: "warning",
            }));
            return;
        }
        setCreating(true);
        try {
            const { fromEntityId, toEntityId } = resolveRelationEndpoints(
                selfEntity,
                newTo,
                newType
            );
            await dispatch(addWikiRelation({
                campaignId,
                data: {
                    fromEntityId,
                    toEntityId,
                    relationType: newType,
                    strength: clampStrength(newStrength),
                    label: newType === WIKI_RELATION_TYPES.OTRO ? (newLabel || "") : "",
                    fromEntityType: selfEntity.entityType,
                    toEntityType: newTo.entityType,
                },
                uid,
            })).unwrap();
            resetAddForm();
        } catch (err) {
            console.error("[DossierRelationTrack] create", err);
            dispatch(showSnackbar({
                message: "No se pudo crear la relación",
                severity: "error",
            }));
        } finally {
            setCreating(false);
        }
    }, [
        dmEdit,
        campaignId,
        selfEntity,
        newTo,
        newType,
        newStrength,
        newLabel,
        uid,
        dispatch,
        resetAddForm,
    ]);

    const chipCounts = useMemo(() => {
        const counts = {
            all: rows.length,
            pj: 0,
            npc: 0,
            locacion: 0,
            organizacion: 0,
            ideologia: 0,
            other: 0,
        };
        for (const r of rows) {
            if (counts[r.filterKey] !== undefined) counts[r.filterKey] += 1;
        }
        return counts;
    }, [rows]);

    return (
        <Box
            sx={{
                height: "100%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                border: `1px solid ${NAR_ACCENT}44`,
                borderRadius: "6px",
                bgcolor: "rgba(255,20,147,0.04)",
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    flexShrink: 0,
                    px: 1.5,
                    py: 1,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0, flex: 1 }}>
                    <CyberTitle
                        sx={{
                            fontSize: "0.7rem",
                            letterSpacing: "0.14em",
                            color: NAR_ACCENT,
                        }}
                    >
                        RELACIONES
                    </CyberTitle>
                    <CyberTooltip
                        title={
                            "Track de vínculos narrativos. Rango: HOSTIL → VÍNCULO (−10…+10). "
                            + "La IA usa estos valores de forma obligatoria. "
                            + (dmEdit
                                ? "Como DJ puedes arrastrar el medidor, crear y borrar vínculos aquí (manual, sin spoilers automáticos)."
                                : "Solo lectura: el DJ mantiene el track.")
                        }
                    >
                        <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, cursor: "help" }}>
                            {graphLoading ? "sincronizando…" : `${rows.length} sync`}
                        </CyberText>
                    </CyberTooltip>
                </Box>
                {dmEdit && !adding && (
                    <IconButton
                        size="small"
                        onClick={() => setAdding(true)}
                        aria-label="Añadir relación"
                        sx={{
                            color: NAR_ACCENT,
                            border: `1px solid ${NAR_ACCENT}55`,
                            borderRadius: "4px",
                            p: 0.35,
                            "&:hover": { bgcolor: `${NAR_ACCENT}18` },
                        }}
                    >
                        <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                )}
            </Box>

            <Box sx={{ flexShrink: 0, px: 1.25, pt: 1, pb: 0.75, display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.4,
                        bgcolor: "rgba(8,8,14,0.55)",
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: "4px",
                        "&:focus-within": { borderColor: `${NAR_ACCENT}88` },
                    }}
                >
                    <SearchIcon sx={{ color: UI_COLORS.textSecondary, fontSize: "0.85rem" }} />
                    <InputBase
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar vínculo, nombre, rango…"
                        fullWidth
                        sx={{
                            color: UI_COLORS.textPrimary,
                            fontFamily: "'Fira Sans', sans-serif",
                            fontSize: "0.72rem",
                            "& input::placeholder": { color: UI_COLORS.textSecondary, opacity: 0.75 },
                        }}
                    />
                    {query && (
                        <IconButton
                            size="small"
                            onClick={() => setQuery("")}
                            sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                        >
                            <ClearIcon sx={{ fontSize: "0.75rem" }} />
                        </IconButton>
                    )}
                </Box>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                    {FILTER_CHIPS.map((chip) => {
                        const on = typeFilter === chip.id;
                        const count = chipCounts[chip.id] ?? 0;
                        if (chip.id !== "all" && count === 0 && !on) return null;
                        return (
                            <Box
                                key={chip.id}
                                component="button"
                                type="button"
                                onClick={() => setTypeFilter(chip.id)}
                                sx={{
                                    border: on ? `1px solid ${NAR_ACCENT}99` : `1px solid ${UI_COLORS.border}`,
                                    bgcolor: on ? `${NAR_ACCENT}22` : "transparent",
                                    color: on ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                                    fontFamily: '"Orbitron", sans-serif',
                                    fontSize: "0.48rem",
                                    letterSpacing: "0.1em",
                                    px: 0.7,
                                    py: 0.35,
                                    borderRadius: "3px",
                                    cursor: "pointer",
                                    transition: "background-color 0.15s, border-color 0.15s, color 0.15s",
                                    "&:hover": { color: UI_COLORS.textPrimary, borderColor: `${NAR_ACCENT}66` },
                                }}
                            >
                                {chip.label}
                                {chip.id !== "all" ? ` ${count}` : ""}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Collapse in={dmEdit && adding} unmountOnExit>
                <Box
                    sx={{
                        flexShrink: 0,
                        mx: 1.25,
                        mb: 1,
                        p: 1.25,
                        border: `1px solid ${NAR_ACCENT}55`,
                        borderRadius: "5px",
                        bgcolor: "rgba(8,8,14,0.65)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <CyberTitle sx={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: NAR_ACCENT }}>
                            NUEVO VÍNCULO (MANUAL)
                        </CyberTitle>
                        <IconButton size="small" onClick={resetAddForm} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                            <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </Box>
                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary }}>
                        Solo afinidad (personajes, orgs, lugares, ideologías). Idiomas, eventos y reliquias en HECHOS.
                    </CyberText>

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                        {CREATE_TYPE_CHIPS.map((chip) => {
                            const on = createTypeFilter === chip.id;
                            return (
                                <Box
                                    key={chip.id}
                                    component="button"
                                    type="button"
                                    onClick={() => {
                                        setCreateTypeFilter(chip.id);
                                        if (newTo && chip.id !== "all" && newTo.entityType !== chip.id) {
                                            setNewTo(null);
                                            setNewType("");
                                            setNewStrength(0);
                                        }
                                    }}
                                    sx={{
                                        border: on ? `1px solid ${NAR_ACCENT}99` : `1px solid ${UI_COLORS.border}`,
                                        bgcolor: on ? `${NAR_ACCENT}22` : "transparent",
                                        color: on ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                                        fontFamily: '"Orbitron", sans-serif',
                                        fontSize: "0.48rem",
                                        letterSpacing: "0.1em",
                                        px: 0.7,
                                        py: 0.35,
                                        borderRadius: "3px",
                                        cursor: "pointer",
                                        "&:hover": { color: UI_COLORS.textPrimary, borderColor: `${NAR_ACCENT}66` },
                                    }}
                                >
                                    {chip.label}
                                </Box>
                            );
                        })}
                    </Box>

                    <Autocomplete
                        size="small"
                        fullWidth
                        options={relatableEntities}
                        value={newTo}
                        onChange={(_, val) => {
                            setNewTo(val);
                            if (val && selfEntity) {
                                const suggested = suggestAffinityType(selfEntity, val);
                                setNewType(suggested || "");
                                setNewStrength(
                                    suggested
                                        ? defaultStrengthForRelation(
                                            suggested,
                                            selfEntity.entityType,
                                            val.entityType
                                        )
                                        : 0
                                );
                            } else {
                                setNewType("");
                                setNewStrength(0);
                            }
                        }}
                        getOptionLabel={(opt) => opt?.title || ""}
                        isOptionEqualToValue={(a, b) => a?.id === b?.id}
                        filterOptions={filterEntities}
                        noOptionsText="Sin coincidencias"
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                size="small"
                                placeholder="Buscar ficha (PJ, NPC, lugar, org…)"
                                sx={fieldSx}
                            />
                        )}
                        renderOption={(props, opt) => {
                            const { key, ...rest } = props;
                            const kind = classifyPersonajeKind(opt, charactersById);
                            const imagePath = resolveWikiEntityImagePath(opt, locations, charactersById);
                            return (
                                <Box
                                    component="li"
                                    key={key}
                                    {...rest}
                                    sx={{
                                        display: "flex",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 1,
                                        py: 0.85,
                                        px: 1.25,
                                        color: UI_COLORS.textPrimary,
                                    }}
                                >
                                    <CharAvatar
                                        imagePath={imagePath}
                                        name={opt.title}
                                        size={28}
                                    />
                                    <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 0.15 }}>
                                        <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>
                                            {opt.title}
                                        </CyberText>
                                        <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.anomaly }}>
                                            {WIKI_ENTITY_TYPE_LABELS[opt.entityType] || opt.entityType}
                                            {kind ? ` · ${kind === "pj" ? "PJ" : "NPC"}` : ""}
                                        </CyberText>
                                    </Box>
                                </Box>
                            );
                        }}
                        slotProps={{
                            paper: {
                                sx: {
                                    ...cyberMenuPaperSx,
                                    border: `1px solid ${NAR_ACCENT}44`,
                                    mt: 0.5,
                                    "& .MuiAutocomplete-listbox": {
                                        maxHeight: 220,
                                        p: 0,
                                        ...CYBER_SCROLL_STYLE,
                                    },
                                    "& .MuiAutocomplete-option": {
                                        color: UI_COLORS.textPrimary,
                                        "&:hover": { bgcolor: `${NAR_ACCENT}18` },
                                        '&[aria-selected="true"]': { bgcolor: `${NAR_ACCENT}28` },
                                    },
                                },
                            },
                        }}
                    />

                    {newTo && relationTypeOptions.length > 0 && (
                        <FormControl size="small" fullWidth>
                            <Select
                                value={newType}
                                displayEmpty
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setNewType(next);
                                    setNewStrength(
                                        defaultStrengthForRelation(
                                            next,
                                            selfEntity?.entityType,
                                            newTo?.entityType
                                        )
                                    );
                                }}
                                sx={selectSx}
                                MenuProps={{ PaperProps: { sx: { ...cyberMenuPaperSx, maxHeight: 260, ...CYBER_SCROLL_STYLE } } }}
                            >
                                <MenuItem value="" disabled sx={cyberMenuItemSx}>
                                    Tipo de relación…
                                </MenuItem>
                                {relationTypeOptions.map(({ value, label }) => (
                                    <MenuItem key={value} value={value} sx={cyberMenuItemSx}>
                                        {label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {newType === WIKI_RELATION_TYPES.OTRO && (
                        <InputBase
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="Etiqueta personalizada…"
                            sx={{
                                px: 1,
                                py: 0.5,
                                border: `1px solid ${UI_COLORS.border}`,
                                borderRadius: "4px",
                                color: UI_COLORS.textPrimary,
                                fontSize: "0.75rem",
                                bgcolor: "rgba(8,8,14,0.55)",
                            }}
                        />
                    )}

                    {newTo && newType && (
                        <SyncMeter
                            strength={newStrength}
                            interactive
                            onCommit={(v) => setNewStrength(v)}
                            onChange={(v) => setNewStrength(v)}
                        />
                    )}

                    <Box
                        component="button"
                        type="button"
                        disabled={!newTo || !newType || creating}
                        onClick={handleCreate}
                        sx={{
                            border: `1px solid ${NAR_ACCENT}88`,
                            bgcolor: `${NAR_ACCENT}22`,
                            color: UI_COLORS.textPrimary,
                            fontFamily: '"Orbitron", sans-serif',
                            fontSize: "0.55rem",
                            letterSpacing: "0.14em",
                            py: 0.75,
                            borderRadius: "4px",
                            cursor: !newTo || !newType || creating ? "default" : "pointer",
                            opacity: !newTo || !newType || creating ? 0.45 : 1,
                            transition: "background-color 0.15s, opacity 0.15s",
                            "&:hover": {
                                bgcolor: !newTo || !newType || creating ? `${NAR_ACCENT}22` : `${NAR_ACCENT}33`,
                            },
                        }}
                    >
                        {creating ? "CREANDO…" : "CREAR VÍNCULO"}
                    </Box>
                </Box>
            </Collapse>

            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1.5, py: 0.25, ...CYBER_SCROLL_STYLE }}>
                {graphLoading && (
                    <Box
                        sx={{
                            py: 3,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <CircularProgress size={22} sx={{ color: NAR_ACCENT }} />
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                            Sincronizando vínculos…
                        </CyberText>
                    </Box>
                )}
                {!graphLoading && !rows.length && !adding && (
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, py: 2, display: "block" }}>
                        Sin vínculos narrativos aún.
                        {dmEdit ? " Usa + para añadir uno manualmente." : ""}
                    </CyberText>
                )}
                {!graphLoading && rows.length > 0 && filtered.length === 0 && (
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, py: 2, display: "block" }}>
                        Ningún vínculo coincide con el filtro.
                    </CyberText>
                )}
                {!graphLoading && filtered.map((row) => (
                    <RelationCard
                        key={row.id}
                        row={row}
                        canEdit={dmEdit}
                        busy={busyId === row.id}
                        confirmDelete={deleteId === row.id}
                        onAskDelete={() => setDeleteId(row.id)}
                        onCancelDelete={() => setDeleteId(null)}
                        onConfirmDelete={() => handleRemove(row.id)}
                        onStrengthCommit={commitStrength}
                    />
                ))}
            </Box>
        </Box>
    );
}
