/**
 * NAR RED — structural facts (no Sync Meter). Players: read. DM: add/remove.
 */

import { useCallback, useMemo, useState } from "react";
import {
    Autocomplete,
    Box,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    TextField,
    createFilterOptions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useDispatch, useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { WIKI_ENTITY_TYPE_LABELS, WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import {
    WIKI_RELATION_TYPES,
    filterStructuralRelatableEntities,
    getRelationDisplayLabel,
    getStructuralRelationTypeOptionsForContext,
    isStructuralDossierTargetType,
    isStructuralRelation,
    suggestRelationTypeForPair,
} from "../../constants/wikiRelationTypes";
import { addWikiRelation, removeWikiRelation } from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";

const NAR_ACCENT = UI_COLORS.accentStrong;

const STRUCT_CREATE_CHIPS = [
    { id: "all", label: "TODOS" },
    { id: WIKI_ENTITY_TYPES.IDIOMA, label: "IDIOMAS" },
    { id: WIKI_ENTITY_TYPES.EVENTO_HISTORICO, label: "EVENTOS" },
    { id: WIKI_ENTITY_TYPES.ESPECIE, label: "ESPECIES" },
    { id: WIKI_ENTITY_TYPES.RELIQUIA, label: "RELIQUIAS" },
    { id: WIKI_ENTITY_TYPES.CRONICA, label: "CRÓNICAS" },
    { id: WIKI_ENTITY_TYPES.GLOSARIO, label: "GLOSARIO" },
];

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

function suggestStructuralType(fromEntity, toEntity) {
    const opts = getStructuralRelationTypeOptionsForContext(fromEntity, toEntity);
    if (!opts.length) return "";
    const suggested = suggestRelationTypeForPair(fromEntity, toEntity);
    if (suggested && opts.some((o) => o.value === suggested)) return suggested;
    return opts[0].value;
}

/**
 * @param {{
 *   entityId: string,
 *   campaignId: string,
 *   canEdit?: boolean,
 *   variant?: "panel" | "fichaStrip",
 * }} props
 */
export default function DossierStructuralFacts({
    entityId,
    campaignId,
    canEdit = false,
    variant = "panel",
}) {
    const compact = variant === "fichaStrip";
    const dispatch = useDispatch();
    const relations = useSelector((s) => s.wiki.relations);
    const entities = useSelector((s) => s.wiki.entities);
    const uid = useSelector((s) => s.player.profile?.uid);

    const [adding, setAdding] = useState(false);
    const [createTypeFilter, setCreateTypeFilter] = useState("all");
    const [newTo, setNewTo] = useState(null);
    const [newType, setNewType] = useState("");
    const [newLabel, setNewLabel] = useState("");
    const [creating, setCreating] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

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

    const rows = useMemo(() => {
        if (!entityId) return [];
        const list = [];
        const selfType = selfEntity?.entityType || WIKI_ENTITY_TYPES.PERSONAJE;
        for (const rel of relations || []) {
            const from = rel.fromEntityId;
            const to = rel.toEntityId;
            if (from !== entityId && to !== entityId) continue;
            const outgoing = from === entityId;
            const otherId = outgoing ? to : from;
            const other = entityById.get(otherId);
            const entityType = other?.entityType || "";
            if (!isStructuralRelation({
                relationType: rel.relationType,
                fromEntityType: outgoing ? selfType : entityType,
                toEntityType: outgoing ? entityType : selfType,
            })) {
                continue;
            }
            list.push({
                id: rel.id,
                otherId,
                otherTitle: other?.title || otherId || "?",
                entityType,
                otherTypeLabel: WIKI_ENTITY_TYPE_LABELS[entityType] || entityType || "",
                relationLabel: getRelationDisplayLabel(rel.relationType, outgoing),
                relationType: rel.relationType,
                customLabel: rel.label || "",
            });
        }
        list.sort((a, b) => a.otherTitle.localeCompare(b.otherTitle, "es"));
        return list;
    }, [relations, entityId, entityById, selfEntity]);

    const relatableEntities = useMemo(() => {
        if (!selfEntity) return [];
        const pool = filterStructuralRelatableEntities(selfEntity, entities);
        if (createTypeFilter === "all") return pool;
        return pool.filter((e) => e.entityType === createTypeFilter);
    }, [selfEntity, entities, createTypeFilter]);

    const relationTypeOptions = useMemo(
        () => getStructuralRelationTypeOptionsForContext(selfEntity, newTo),
        [selfEntity, newTo]
    );

    const resetAddForm = useCallback(() => {
        setAdding(false);
        setNewTo(null);
        setNewType("");
        setNewLabel("");
        setCreateTypeFilter("all");
    }, []);

    const handleCreate = useCallback(async () => {
        if (!campaignId || !uid || !selfEntity || !newTo || !newType) return;
        if (!isStructuralDossierTargetType(newTo.entityType)) {
            dispatch(showSnackbar({
                message: "Esa ficha va en Relaciones (afinidad), no en Hechos.",
                severity: "warning",
            }));
            return;
        }
        if (!isStructuralRelation({
            relationType: newType,
            fromEntityType: selfEntity.entityType,
            toEntityType: newTo.entityType,
        })) {
            dispatch(showSnackbar({
                message: "Ese vínculo es de afinidad — usá Relaciones.",
                severity: "warning",
            }));
            return;
        }
        setCreating(true);
        try {
            await dispatch(addWikiRelation({
                campaignId,
                data: {
                    fromEntityId: entityId,
                    toEntityId: newTo.id,
                    relationType: newType,
                    strength: 0,
                    label: newType === WIKI_RELATION_TYPES.OTRO ? (newLabel || "") : "",
                    fromEntityType: selfEntity.entityType,
                    toEntityType: newTo.entityType,
                },
                uid,
            })).unwrap();
            resetAddForm();
        } catch (err) {
            dispatch(showSnackbar({
                message: err?.message || "No se pudo crear el hecho",
                severity: "error",
            }));
        } finally {
            setCreating(false);
        }
    }, [campaignId, uid, selfEntity, newTo, newType, newLabel, entityId, dispatch, resetAddForm]);

    const handleDelete = useCallback(async (relationId) => {
        if (!campaignId || !relationId) return;
        setBusyId(relationId);
        try {
            await dispatch(removeWikiRelation({ campaignId, relationId })).unwrap();
            setDeleteId(null);
        } catch (err) {
            dispatch(showSnackbar({
                message: err?.message || "No se pudo eliminar",
                severity: "error",
            }));
        } finally {
            setBusyId(null);
        }
    }, [campaignId, dispatch]);

    return (
        <Box
            sx={{
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: compact ? "4px" : "6px",
                bgcolor: "rgba(8,8,14,0.4)",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                flexShrink: 0,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    px: compact ? 1 : 1.25,
                    py: compact ? 0.45 : 0.85,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <CyberTitle
                        sx={{
                            fontSize: compact ? "0.55rem" : "0.65rem",
                            letterSpacing: "0.14em",
                            color: UI_COLORS.anomaly,
                        }}
                    >
                        HECHOS
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary }}>
                        {rows.length} estructural{rows.length === 1 ? "" : "es"}
                    </CyberText>
                </Box>
                {canEdit && (
                    <IconButton
                        size="small"
                        onClick={() => setAdding((v) => !v)}
                        aria-label="Añadir hecho"
                        sx={{
                            color: adding ? NAR_ACCENT : UI_COLORS.textSecondary,
                            border: `1px solid ${adding ? `${NAR_ACCENT}66` : UI_COLORS.border}`,
                            borderRadius: "4px",
                            p: 0.35,
                        }}
                    >
                        {adding ? <CloseIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                )}
            </Box>

            {canEdit && adding && (
                <Box
                    sx={{
                        mx: 1.1,
                        mt: 1,
                        mb: 0.5,
                        p: 1.1,
                        border: `1px solid ${UI_COLORS.anomaly}44`,
                        borderRadius: "5px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.85,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                        Idioma, evento, reliquia, etc. Sin medidor de afinidad.
                    </CyberText>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.35 }}>
                        {STRUCT_CREATE_CHIPS.map((chip) => {
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
                                        }
                                    }}
                                    sx={{
                                        border: on ? `1px solid ${UI_COLORS.anomaly}99` : `1px solid ${UI_COLORS.border}`,
                                        bgcolor: on ? `${UI_COLORS.anomaly}18` : "transparent",
                                        color: on ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                                        fontFamily: '"Orbitron", sans-serif',
                                        fontSize: "0.45rem",
                                        letterSpacing: "0.08em",
                                        px: 0.65,
                                        py: 0.3,
                                        borderRadius: "3px",
                                        cursor: "pointer",
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
                                setNewType(suggestStructuralType(selfEntity, val) || "");
                            } else {
                                setNewType("");
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
                                placeholder="Buscar ficha estructural…"
                                sx={fieldSx}
                            />
                        )}
                        renderOption={(props, opt) => {
                            const { key, ...rest } = props;
                            return (
                                <Box
                                    component="li"
                                    key={key}
                                    {...rest}
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-start",
                                        py: 0.75,
                                        px: 1.1,
                                        color: UI_COLORS.textPrimary,
                                    }}
                                >
                                    <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary }}>
                                        {opt.title}
                                    </CyberText>
                                    <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.anomaly }}>
                                        {WIKI_ENTITY_TYPE_LABELS[opt.entityType] || opt.entityType}
                                    </CyberText>
                                </Box>
                            );
                        }}
                        slotProps={{
                            paper: {
                                sx: {
                                    ...cyberMenuPaperSx,
                                    mt: 0.5,
                                    "& .MuiAutocomplete-listbox": {
                                        maxHeight: 200,
                                        p: 0,
                                        ...CYBER_SCROLL_STYLE,
                                    },
                                    "& .MuiAutocomplete-option": {
                                        color: UI_COLORS.textPrimary,
                                        "&:hover": { bgcolor: `${UI_COLORS.anomaly}18` },
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
                                onChange={(e) => setNewType(e.target.value)}
                                sx={selectSx}
                                MenuProps={{
                                    PaperProps: {
                                        sx: { ...cyberMenuPaperSx, maxHeight: 240, ...CYBER_SCROLL_STYLE },
                                    },
                                }}
                            >
                                <MenuItem value="" disabled sx={cyberMenuItemSx}>
                                    Tipo de hecho…
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
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="Etiqueta…"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            sx={fieldSx}
                        />
                    )}
                    <Box
                        component="button"
                        type="button"
                        disabled={creating || !newTo || !newType}
                        onClick={handleCreate}
                        sx={{
                            alignSelf: "flex-end",
                            border: `1px solid ${UI_COLORS.anomaly}66`,
                            bgcolor: `${UI_COLORS.anomaly}18`,
                            color: UI_COLORS.textPrimary,
                            px: 1.4,
                            py: 0.55,
                            borderRadius: "4px",
                            cursor: creating || !newTo || !newType ? "default" : "pointer",
                            fontFamily: '"Fira Code", monospace',
                            fontSize: "0.62rem",
                            opacity: creating || !newTo || !newType ? 0.4 : 1,
                        }}
                    >
                        {creating ? "…" : "CREAR"}
                    </Box>
                </Box>
            )}

            <Box
                sx={{
                    flex: compact ? "0 1 auto" : 1,
                    minHeight: 0,
                    maxHeight: compact ? 112 : 220,
                    overflow: "auto",
                    px: compact ? 0.75 : 1.1,
                    py: compact ? 0.4 : 0.5,
                    ...(compact
                        ? {
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: 0.5,
                            alignContent: "start",
                        }
                        : {}),
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {!rows.length && (
                    <CyberText
                        sx={{
                            fontSize: compact ? "0.58rem" : "0.68rem",
                            color: UI_COLORS.textSecondary,
                            py: compact ? 0.5 : 1.25,
                            display: "block",
                            gridColumn: compact ? "1 / -1" : undefined,
                        }}
                    >
                        Sin hechos estructurales (idioma, evento, reliquia…).
                    </CyberText>
                )}
                {rows.map((row) => {
                    const busy = busyId === row.id;
                    const confirmDelete = deleteId === row.id;
                    return (
                        <Box
                            key={row.id}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 0.5,
                                py: compact ? 0.4 : 0.75,
                                px: compact ? 0.45 : 0,
                                borderBottom: compact ? "none" : `1px solid ${UI_COLORS.border}`,
                                border: compact ? `1px solid ${UI_COLORS.border}` : undefined,
                                borderRadius: compact ? "3px" : 0,
                                bgcolor: compact ? "rgba(0,0,0,0.22)" : "transparent",
                                minWidth: 0,
                                "&:last-child": compact ? undefined : { borderBottom: 0 },
                            }}
                        >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <CyberText
                                    sx={{
                                        fontSize: compact ? "0.62rem" : "0.78rem",
                                        fontWeight: 600,
                                        color: UI_COLORS.textPrimary,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {row.otherTitle}
                                </CyberText>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.35, mt: 0.15 }}>
                                    <Box
                                        sx={{
                                            px: 0.4,
                                            py: 0.05,
                                            border: `1px solid ${UI_COLORS.anomaly}55`,
                                            bgcolor: `${UI_COLORS.anomaly}10`,
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: compact ? "0.45rem" : "0.52rem",
                                            color: UI_COLORS.textPrimary,
                                        }}
                                    >
                                        {row.relationLabel}
                                    </Box>
                                    {row.otherTypeLabel && (
                                        <CyberText sx={{ fontSize: compact ? "0.45rem" : "0.52rem", color: UI_COLORS.textSecondary }}>
                                            {row.otherTypeLabel}
                                        </CyberText>
                                    )}
                                    {row.customLabel ? (
                                        <CyberText sx={{ fontSize: compact ? "0.45rem" : "0.52rem", color: UI_COLORS.textSecondary }}>
                                            · {row.customLabel}
                                        </CyberText>
                                    ) : null}
                                </Box>
                            </Box>
                            {canEdit && (
                                <Box sx={{ flexShrink: 0 }}>
                                    {confirmDelete ? (
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.2 }}>
                                            <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.danger }}>
                                                ¿Borrar?
                                            </CyberText>
                                            <IconButton
                                                size="small"
                                                disabled={busy}
                                                onClick={() => handleDelete(row.id)}
                                                sx={{ color: UI_COLORS.danger, p: 0.25 }}
                                            >
                                                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => setDeleteId(null)}
                                                sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                                            >
                                                <CloseIcon sx={{ fontSize: 13 }} />
                                            </IconButton>
                                        </Box>
                                    ) : (
                                        <IconButton
                                            size="small"
                                            disabled={busy}
                                            onClick={() => setDeleteId(row.id)}
                                            sx={{
                                                color: UI_COLORS.textSecondary,
                                                p: 0.3,
                                                "&:hover": { color: UI_COLORS.danger },
                                            }}
                                        >
                                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    )}
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
