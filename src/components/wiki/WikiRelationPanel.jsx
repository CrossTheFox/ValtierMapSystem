import { useState, useMemo, useEffect } from "react";
import {
    Box,
    IconButton,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Tooltip,
    Autocomplete,
    Collapse,
    InputBase,
    createFilterOptions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";
import {
    WIKI_RELATION_TYPES,
    getRelationDisplayLabel,
    WIKI_RELATION_STRENGTH_MIN,
    WIKI_RELATION_STRENGTH_MAX,
    defaultStrengthForRelationType,
    getRelationTypeOptionsForContext,
    suggestRelationTypeForPair,
    resolveRelationEndpoints,
    filterRelatableEntities,
    validateRelationCreate,
    isKnownRelationType,
} from "../../constants/wikiRelationTypes";
import { addWikiRelation, removeWikiRelation } from "../../store/wikiSlice";
import { getBacklinkIds } from "../../utils/wikiSlug";

const filterEntities = createFilterOptions({
    matchFrom: "any",
    stringify: (option) => `${option.title} ${option.entityType || ""} ${(option.tags || []).join(" ")}`,
});

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.8rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

/**
 * Relation panel showing outgoing/incoming relations for the selected entity,
 * plus a backlinks ("Mencionado en") section.
 * readOnly hides add/remove controls (used for player view).
 */
export default function WikiRelationPanel({ entity, campaignId, onNavigate, readOnly = false }) {
    const dispatch = useDispatch();
    const entities = useSelector((s) => s.wiki.entities);
    const entityRelations = useSelector((s) => s.wiki.entityRelations);
    const uid = useSelector((s) => s.player.profile?.uid);

    const [newTo, setNewTo] = useState("");
    const [newType, setNewType] = useState("");
    const [newStrength, setNewStrength] = useState(0);
    const [newLabel, setNewLabel] = useState("");
    const [adding, setAdding] = useState(false);
    const [filterQuery, setFilterQuery] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState({});

    useEffect(() => {
        setAdding(false);
        setNewTo("");
        setNewType("");
        setNewStrength(0);
        setNewLabel("");
        setFilterQuery("");
        setCollapsedGroups({});
    }, [entity?.id]);

    const backlinkIds = entity ? getBacklinkIds(entity.id, entities) : [];
    const backlinkEntities = entities.filter((e) => backlinkIds.includes(e.id));

    const relatableEntities = useMemo(
        () => (entity ? filterRelatableEntities(entity, entities) : []),
        [entity, entities]
    );
    const selectedToEntity = relatableEntities.find((e) => e.id === newTo) || null;
    const relationTypeOptions = useMemo(
        () => getRelationTypeOptionsForContext(entity, selectedToEntity),
        [entity, selectedToEntity]
    );

    useEffect(() => {
        if (!selectedToEntity || !relationTypeOptions.length) {
            if (newType) {
                setNewType("");
                setNewStrength(0);
            }
            return;
        }
        if (!relationTypeOptions.some((o) => o.value === newType)) {
            const suggested = suggestRelationTypeForPair(entity, selectedToEntity) || relationTypeOptions[0].value;
            setNewType(suggested);
            setNewStrength(defaultStrengthForRelationType(suggested));
        }
    }, [entity, selectedToEntity, relationTypeOptions, newType]);

    function getEntityTitle(id) {
        return entities.find((e) => e.id === id)?.title || id;
    }

    const enrichedRelations = useMemo(() => {
        if (!entity) return [];
        const q = filterQuery.trim().toLowerCase();
        return entityRelations
            .map((rel) => {
                const isFrom = rel.fromEntityId === entity.id;
                const otherId = isFrom ? rel.toEntityId : rel.fromEntityId;
                const otherTitle = getEntityTitle(otherId);
                const typeLabel = isKnownRelationType(rel.relationType)
                    ? getRelationDisplayLabel(rel.relationType, isFrom)
                    : `(${rel.relationType || "tipo obsoleto"})`;
                return { rel, isFrom, otherId, otherTitle, typeLabel };
            })
            .filter(({ otherTitle, typeLabel, rel }) => {
                if (!q) return true;
                const haystack = `${otherTitle} ${typeLabel} ${rel.label || ""}`.toLowerCase();
                return haystack.includes(q);
            })
            .sort((a, b) => a.otherTitle.localeCompare(b.otherTitle, "es", { sensitivity: "base" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entity, entityRelations, entities, filterQuery]);

    const groupedRelations = useMemo(() => {
        const outgoing = [];
        const incoming = [];
        for (const item of enrichedRelations) {
            if (item.isFrom) outgoing.push(item);
            else incoming.push(item);
        }
        return [
            { key: "outgoing", label: "Salientes", items: outgoing },
            { key: "incoming", label: "Entrantes", items: incoming },
        ].filter((g) => g.items.length > 0);
    }, [enrichedRelations]);

    const handleAddRelation = async () => {
        if (!newTo || !newType || !entity || !selectedToEntity) return;
        if (!validateRelationCreate(entity, selectedToEntity, newType)) return;
        const { fromEntityId, toEntityId } = resolveRelationEndpoints(entity, selectedToEntity, newType);
        await dispatch(addWikiRelation({
            campaignId,
            data: {
                fromEntityId,
                toEntityId,
                relationType: newType,
                strength: newStrength,
                label: newType === WIKI_RELATION_TYPES.OTRO ? newLabel : "",
            },
            uid,
        }));
        setNewTo("");
        setNewLabel("");
        setAdding(false);
    };

    const handleRemove = (relationId) => {
        dispatch(removeWikiRelation({ campaignId, relationId }));
    };

    const toggleGroup = (key) => {
        setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    if (!entity) return null;

    return (
        <Box sx={{ height: "100%", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1, p: 1.25, pb: 2.5, boxSizing: "border-box", ...scrollbarSx }}>
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                <CyberTitle variant="caption" sx={{ color: UI_COLORS.textSecondary, letterSpacing: 2, fontSize: "0.6rem" }}>
                    RELACIONES
                </CyberTitle>
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.anomaly }}>
                    {entityRelations.length}
                </CyberText>
            </Box>

            {entityRelations.length > 4 && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.35,
                        bgcolor: UI_COLORS.backgroundPrimary,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 0.75,
                        "&:focus-within": { borderColor: `${UI_COLORS.accent}88` },
                    }}
                >
                    <SearchIcon sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }} />
                    <InputBase
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="Filtrar..."
                        fullWidth
                        sx={{
                            color: UI_COLORS.textPrimary,
                            fontFamily: "'Fira Sans', sans-serif",
                            fontSize: "0.72rem",
                            "& input::placeholder": { color: UI_COLORS.textSecondary, opacity: 0.75 },
                        }}
                    />
                    {filterQuery && (
                        <IconButton size="small" onClick={() => setFilterQuery("")} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                            <ClearIcon sx={{ fontSize: "0.75rem" }} />
                        </IconButton>
                    )}
                </Box>
            )}

            {entityRelations.length === 0 && !adding && (
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.75rem" }}>
                    Sin relaciones registradas.
                </CyberText>
            )}

            {groupedRelations.map(({ key, label, items }) => {
                const collapsed = collapsedGroups[key] ?? false;
                return (
                    <Box key={key}>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => toggleGroup(key)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                width: "100%",
                                px: 0.5,
                                py: 0.35,
                                bgcolor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: UI_COLORS.textSecondary,
                                fontFamily: "'Fira Sans', sans-serif",
                            }}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    fontSize: "1rem",
                                    transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s",
                                }}
                            />
                            <CyberTitle variant="caption" sx={{ fontSize: "0.55rem", letterSpacing: 1.2, color: UI_COLORS.textSecondary }}>
                                {label.toUpperCase()}
                            </CyberTitle>
                            <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.anomaly, ml: "auto" }}>
                                {items.length}
                            </CyberText>
                        </Box>
                        <Collapse in={!collapsed}>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.35, mt: 0.25 }}>
                                {items.map(({ rel, isFrom, otherId, otherTitle, typeLabel }) => (
                                    <RelationRow
                                        key={rel.id}
                                        isFrom={isFrom}
                                        otherTitle={otherTitle}
                                        typeLabel={typeLabel}
                                        strength={rel.strength}
                                        label={rel.label}
                                        readOnly={readOnly}
                                        onNavigate={onNavigate ? () => onNavigate(otherId) : undefined}
                                        onRemove={() => handleRemove(rel.id)}
                                    />
                                ))}
                            </Box>
                        </Collapse>
                    </Box>
                );
            })}

            {filterQuery && enrichedRelations.length === 0 && entityRelations.length > 0 && (
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.72rem", px: 0.5 }}>
                    Ninguna relación coincide con «{filterQuery}».
                </CyberText>
            )}

            {!readOnly && (
                adding ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1, bgcolor: UI_COLORS.backgroundPrimary, border: `1px solid ${UI_COLORS.accent}44`, borderRadius: 1 }}>
                        <Autocomplete
                            size="small"
                            fullWidth
                            options={relatableEntities}
                            value={selectedToEntity}
                            onChange={(_, val) => {
                                const nextId = val?.id || "";
                                setNewTo(nextId);
                                if (val) {
                                    const suggested = suggestRelationTypeForPair(entity, val);
                                    setNewType(suggested || "");
                                    setNewStrength(suggested ? defaultStrengthForRelationType(suggested) : 0);
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
                                    label="Entidad destino"
                                    placeholder="Buscar entidad..."
                                    sx={autocompleteFieldSx}
                                />
                            )}
                            renderOption={(props, opt) => (
                                <Box
                                    component="li"
                                    {...props}
                                    key={opt.id}
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-start",
                                        gap: 0.25,
                                        py: 1,
                                        px: 1.5,
                                        borderBottom: `1px solid ${UI_COLORS.border}`,
                                    }}
                                >
                                    <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.textPrimary, lineHeight: 1.3 }}>
                                        {opt.title}
                                    </CyberText>
                                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, lineHeight: 1.2 }}>
                                        {WIKI_ENTITY_TYPE_LABELS[opt.entityType] || opt.entityType || "Entidad"}
                                    </CyberText>
                                </Box>
                            )}
                            slotProps={{
                                paper: {
                                    sx: {
                                        bgcolor: UI_COLORS.backgroundSecondary,
                                        border: `1px solid ${UI_COLORS.accent}44`,
                                        mt: 0.5,
                                        "& .MuiAutocomplete-listbox": {
                                            maxHeight: 240,
                                            p: 0,
                                            ...CYBER_SCROLL_STYLE,
                                        },
                                        "& .MuiAutocomplete-option": {
                                            color: UI_COLORS.textPrimary,
                                            "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                                            '&[aria-selected="true"]': { bgcolor: `${UI_COLORS.accent}28` },
                                            '&[aria-selected="true"].Mui-focused': { bgcolor: `${UI_COLORS.accent}38` },
                                        },
                                    },
                                },
                            }}
                        />

                        {!relatableEntities.length && (
                            <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.75rem" }}>
                                Ninguna otra ficha admite relación con esta entidad.
                            </CyberText>
                        )}

                        {selectedToEntity && relationTypeOptions.length === 0 && (
                            <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.75rem" }}>
                                No hay tipos de relación lógicos entre estas entidades.
                            </CyberText>
                        )}

                        {selectedToEntity && relationTypeOptions.length > 0 && (
                            <FormControl size="small" fullWidth>
                                <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.75rem" }}>Tipo de relación</InputLabel>
                                <Select
                                    key={`${entity.id}-${selectedToEntity.id}`}
                                    value={newType}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setNewType(next);
                                        setNewStrength(defaultStrengthForRelationType(next));
                                    }}
                                    label="Tipo de relación"
                                    sx={selectSx}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                bgcolor: UI_COLORS.backgroundSecondary,
                                                border: `1px solid ${UI_COLORS.accent}44`,
                                                maxHeight: 280,
                                                ...CYBER_SCROLL_STYLE,
                                            },
                                        },
                                    }}
                                >
                                    {relationTypeOptions.map(({ value, label: optLabel }) => (
                                        <MenuItem key={value} value={value} sx={{ color: UI_COLORS.textPrimary }}>
                                            <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>{optLabel}</CyberText>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <TextField
                            size="small"
                            fullWidth
                            type="number"
                            label={`Afinidad (${WIKI_RELATION_STRENGTH_MIN} a ${WIKI_RELATION_STRENGTH_MAX})`}
                            value={newStrength}
                            onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isNaN(n)) return;
                                setNewStrength(Math.max(WIKI_RELATION_STRENGTH_MIN, Math.min(WIKI_RELATION_STRENGTH_MAX, Math.round(n))));
                            }}
                            inputProps={{ min: WIKI_RELATION_STRENGTH_MIN, max: WIKI_RELATION_STRENGTH_MAX, step: 1 }}
                            variant="outlined"
                            sx={textFieldSx}
                        />

                        {newType === WIKI_RELATION_TYPES.OTRO && (
                            <TextField
                                size="small"
                                fullWidth
                                label="Etiqueta personalizada"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                variant="outlined"
                                sx={textFieldSx}
                            />
                        )}

                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Box
                                component="button"
                                onClick={handleAddRelation}
                                disabled={!selectedToEntity || !newType || !relationTypeOptions.length}
                                sx={btnSx(UI_COLORS.accent)}
                            >
                                <CyberText sx={{ fontSize: "0.75rem" }}>GUARDAR</CyberText>
                            </Box>
                            <Box component="button" onClick={() => setAdding(false)} sx={btnSx(UI_COLORS.textSecondary)}>
                                <CyberText sx={{ fontSize: "0.75rem" }}>CANCELAR</CyberText>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <Box
                        component="button"
                        onClick={() => {
                            setAdding(true);
                            setNewTo("");
                            setNewType("");
                            setNewStrength(0);
                            setNewLabel("");
                        }}
                        sx={btnSx(UI_COLORS.accent)}
                    >
                        <AddIcon sx={{ fontSize: "0.8rem" }} />
                        <CyberText sx={{ fontSize: "0.75rem" }}>AÑADIR RELACIÓN</CyberText>
                    </Box>
                )
            )}

            {backlinkEntities.length > 0 && (
                <>
                    <Divider sx={{ bgcolor: UI_COLORS.border, mt: 0.5 }} />
                    <CyberTitle variant="caption" sx={{ color: UI_COLORS.textSecondary, letterSpacing: 2, fontSize: "0.6rem" }}>
                        MENCIONADO_EN ({backlinkEntities.length})
                    </CyberTitle>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        {backlinkEntities.map((e) => (
                            <CyberText
                                key={e.id}
                                onClick={() => onNavigate && onNavigate(e.id)}
                                sx={{
                                    fontSize: "0.76rem",
                                    color: UI_COLORS.anomaly,
                                    cursor: "pointer",
                                    lineHeight: 1.4,
                                    px: 0.5,
                                    py: 0.2,
                                    borderRadius: 0.5,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    "&:hover": { color: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}0d` },
                                }}
                            >
                                {e.title}
                            </CyberText>
                        ))}
                    </Box>
                </>
            )}
        </Box>
    );
}

function RelationRow({ isFrom, otherTitle, typeLabel, strength, label, readOnly, onNavigate, onRemove }) {
    const hasStrength = strength !== undefined && strength !== 0;
    const direction = isFrom ? "→" : "←";
    const subtype = label ? ` · «${label}»` : "";
    const fullHint = `${otherTitle} — ${direction} ${typeLabel}${subtype}`;
    const canNavigate = typeof onNavigate === "function";

    return (
        <Box
            className="relation-row"
            sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: 0.5,
                px: 0.75,
                py: 0.45,
                borderRadius: 0.75,
                bgcolor: UI_COLORS.backgroundPrimary,
                border: `1px solid ${UI_COLORS.border}`,
                transition: "border-color 0.15s, background-color 0.15s",
                "&:hover": {
                    borderColor: `${UI_COLORS.accent}55`,
                    bgcolor: `${UI_COLORS.accent}06`,
                    "& .relation-delete": { opacity: 1 },
                },
            }}
        >
            <Tooltip title={fullHint} enterDelay={400}>
                <Box
                    onClick={canNavigate ? onNavigate : undefined}
                    role={canNavigate ? "button" : undefined}
                    tabIndex={canNavigate ? 0 : undefined}
                    onKeyDown={canNavigate ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onNavigate();
                        }
                    } : undefined}
                    sx={{
                        minWidth: 0,
                        cursor: canNavigate ? "pointer" : "default",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, minWidth: 0 }}>
                        <CyberText
                            component="span"
                            sx={{
                                fontSize: "0.78rem",
                                color: UI_COLORS.accent,
                                lineHeight: 1.25,
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                                ".relation-row:hover &": canNavigate
                                    ? { color: UI_COLORS.accentStrong, textDecoration: "underline" }
                                    : undefined,
                            }}
                        >
                            {otherTitle}
                        </CyberText>
                        {hasStrength && (
                            <CyberText
                                sx={{
                                    fontSize: "0.58rem",
                                    color: strength > 0 ? UI_COLORS.anomaly : UI_COLORS.accentStrong,
                                    flexShrink: 0,
                                    lineHeight: 1,
                                }}
                            >
                                {strength > 0 ? "+" : ""}{strength}
                            </CyberText>
                        )}
                    </Box>
                    <CyberText
                        sx={{
                            fontSize: "0.62rem",
                            color: UI_COLORS.textSecondary,
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {direction} {typeLabel}{subtype}
                    </CyberText>
                </Box>
            </Tooltip>
            {!readOnly && (
                <Tooltip title="Eliminar relación">
                    <IconButton
                        className="relation-delete"
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        sx={{
                            opacity: 0.35,
                            color: UI_COLORS.textSecondary,
                            p: 0.25,
                            transition: "opacity 0.15s, color 0.15s",
                            "&:hover": { color: UI_COLORS.accentStrong, opacity: 1 },
                        }}
                    >
                        <DeleteIcon sx={{ fontSize: "0.78rem" }} />
                    </IconButton>
                </Tooltip>
            )}
        </Box>
    );
}

function btnSx(color) {
    return {
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1.5,
        py: 0.5,
        bgcolor: `${color}11`,
        border: `1px solid ${color}66`,
        borderRadius: 1,
        color,
        cursor: "pointer",
        fontFamily: "'Fira Sans', sans-serif",
        transition: "background-color 0.15s, border-color 0.15s",
        "&:hover": { bgcolor: `${color}22`, borderColor: color },
        "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
    };
}

const scrollbarSx = CYBER_SCROLL_STYLE;

const textFieldSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontSize: "0.8rem",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent },
    },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.75rem" },
};

const autocompleteFieldSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.8rem",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.accent}88` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent },
        "& .MuiAutocomplete-input": { color: UI_COLORS.textPrimary },
    },
    "& .MuiInputLabel-root": {
        color: UI_COLORS.textSecondary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.75rem",
    },
    "& .MuiInputLabel-root.Mui-focused": { color: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};
