import { useState, useMemo, useEffect } from "react";
import { Box, IconButton, Divider, FormControl, InputLabel, Select, MenuItem, TextField, Tooltip, Autocomplete, createFilterOptions } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
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

    useEffect(() => {
        setAdding(false);
        setNewTo("");
        setNewType("");
        setNewStrength(0);
        setNewLabel("");
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

    if (!entity) return null;

    return (
        <Box sx={{ height: "100%", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1.5, p: 1.5, pb: 2.5, boxSizing: "border-box", ...scrollbarSx }}>
            <CyberTitle variant="caption" sx={{ color: UI_COLORS.textSecondary, letterSpacing: 2, fontSize: "0.6rem" }}>
                RELACIONES
            </CyberTitle>

            {entityRelations.length === 0 && !adding && (
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>
                    Sin relaciones registradas.
                </CyberText>
            )}

            {entityRelations.map((rel) => {
                const isFrom = rel.fromEntityId === entity.id;
                const otherId = isFrom ? rel.toEntityId : rel.fromEntityId;
                const otherTitle = getEntityTitle(otherId);
                const typeLabel = isKnownRelationType(rel.relationType)
                    ? getRelationDisplayLabel(rel.relationType, isFrom)
                    : `(${rel.relationType || "tipo obsoleto"})`;
                return (
                    <Box
                        key={rel.id}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            bgcolor: UI_COLORS.backgroundPrimary,
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: 1,
                            px: 1.5,
                            py: 0.75,
                        }}
                    >
                        <LinkIcon sx={{ color: UI_COLORS.accent, fontSize: "0.85rem", flexShrink: 0 }} />
                        <Box sx={{ flex: 1, overflow: "hidden" }}>
                            <CyberText
                                sx={{ fontSize: "0.75rem", color: UI_COLORS.textSecondary, lineHeight: 1.2 }}
                            >
                                {isFrom ? "→" : "←"} {typeLabel}
                            </CyberText>
                            <CyberText
                                component="span"
                                onClick={() => onNavigate && onNavigate(otherId)}
                                sx={{
                                    fontSize: "0.82rem",
                                    color: UI_COLORS.accent,
                                    cursor: "pointer",
                                    lineHeight: 1.3,
                                    "&:hover": { color: UI_COLORS.accentStrong, textDecoration: "underline" },
                                }}
                            >
                                {otherTitle}
                            </CyberText>
                            {(rel.strength !== undefined && rel.strength !== 0) && (
                                <CyberText sx={{ fontSize: "0.68rem", color: rel.strength > 0 ? UI_COLORS.anomaly : UI_COLORS.accentStrong, lineHeight: 1.2 }}>
                                    afinidad {rel.strength > 0 ? "+" : ""}{rel.strength}
                                </CyberText>
                            )}
                            {rel.label && (
                                <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, lineHeight: 1.2 }}>
                                    «{rel.label}»
                                </CyberText>
                            )}
                        </Box>
                        {!readOnly && (
                            <Tooltip title="Eliminar relación">
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemove(rel.id)}
                                    sx={{ color: UI_COLORS.textSecondary, "&:hover": { color: UI_COLORS.accentStrong } }}
                                >
                                    <DeleteIcon sx={{ fontSize: "0.85rem" }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                );
            })}

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
                                    {relationTypeOptions.map(({ value, label }) => (
                                        <MenuItem key={value} value={value} sx={{ color: UI_COLORS.textPrimary }}>
                                            <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>{label}</CyberText>
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
                            sx={{
                                "& .MuiOutlinedInput-root": { bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, fontSize: "0.8rem", "& fieldset": { borderColor: UI_COLORS.border }, "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent } },
                                "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.75rem" },
                            }}
                        />

                        {newType === WIKI_RELATION_TYPES.OTRO && (
                            <TextField
                                size="small"
                                fullWidth
                                label="Etiqueta personalizada"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                variant="outlined"
                                sx={{
                                    "& .MuiOutlinedInput-root": { bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, fontSize: "0.8rem", "& fieldset": { borderColor: UI_COLORS.border }, "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent } },
                                    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.75rem" },
                                }}
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
                        MENCIONADO_EN
                    </CyberTitle>
                    {backlinkEntities.map((e) => (
                        <CyberText
                            key={e.id}
                            onClick={() => onNavigate && onNavigate(e.id)}
                            sx={{
                                fontSize: "0.8rem",
                                color: UI_COLORS.anomaly,
                                cursor: "pointer",
                                lineHeight: 1.5,
                                "&:hover": { color: UI_COLORS.accent },
                            }}
                        >
                            → {e.title}
                        </CyberText>
                    ))}
                </>
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
