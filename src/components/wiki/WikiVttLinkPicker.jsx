import { useMemo } from "react";
import { Box, Chip, FormHelperText, Stack } from "@mui/material";
import { useSelector } from "react-redux";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { linkedLocationIdsOf } from "../../constants/wiki/archiveIdentity.js";
import WikiSearchableSelect from "./WikiSearchableSelect";

/**
 * Enlaza una ficha wiki con instancias VTT.
 * PERSONAJE: 1 token. LOCACION: N pines (add/remove, never replace the place).
 */
export default function WikiVttLinkPicker({
    entityType,
    linkedVttLocationId,
    linkedVttLocationIds,
    linkedVttCharacterId,
    onChange,
}) {
    const locations = useSelector((s) => s.world.locations);
    const maps = useSelector((s) => s.world.maps || []);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});

    const pinIds = useMemo(() => {
        if (Array.isArray(linkedVttLocationIds) && linkedVttLocationIds.length) {
            return linkedVttLocationIds.filter(Boolean);
        }
        return linkedLocationIdsOf({ linkedVttLocationId, linkedVttLocationIds });
    }, [linkedVttLocationId, linkedVttLocationIds]);

    const locationOptions = useMemo(
        () => Object.values(locations || {}).map((loc) => {
            const mapName = (maps || []).find((m) => m.id === loc.mapId)?.name;
            return {
                value: loc.id,
                label: loc.name || loc.id,
                sublabel: mapName || loc.mapId || "Sin mapa",
            };
        }),
        [locations, maps]
    );

    const characterOptions = useMemo(
        () => Object.values(charactersById || {}).map((c) => ({
            value: c.id,
            label: c.name,
            sublabel: c.locationId && locations?.[c.locationId]?.name
                ? locations[c.locationId].name
                : "Sin locación",
        })).sort((a, b) => (a.label || "").localeCompare(b.label || "", "es")),
        [charactersById, locations]
    );

    const showLocation = entityType === WIKI_ENTITY_TYPES.LOCACION;
    const showCharacter = entityType === WIKI_ENTITY_TYPES.PERSONAJE;

    const emitPins = (nextIds) => {
        const unique = [...new Set(nextIds.filter(Boolean))];
        onChange({
            linkedVttLocationIds: unique,
            linkedVttLocationId: unique[0] || null,
            linkedVttCharacterId: null,
        });
    };

    const handleAddPin = (v) => {
        if (!v || pinIds.includes(v)) return;
        emitPins([...pinIds, v]);
    };

    const handleRemovePin = (v) => {
        emitPins(pinIds.filter((id) => id !== v));
    };

    const handleCharacterChange = (v) => {
        onChange({
            linkedVttLocationId: null,
            linkedVttLocationIds: [],
            linkedVttCharacterId: v || null,
        });
    };

    if (!showLocation && !showCharacter) return null;

    const addOptions = locationOptions.filter((o) => !pinIds.includes(o.value));

    return (
        <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap" }}>
            {showLocation && (
                <Box sx={{ minWidth: 200, flex: 1 }}>
                    {pinIds.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ mb: 0.75, flexWrap: "wrap" }}>
                            {pinIds.map((id) => {
                                const loc = locations?.[id];
                                return (
                                    <Chip
                                        key={id}
                                        size="small"
                                        label={loc?.name || id.slice(0, 8)}
                                        onDelete={() => handleRemovePin(id)}
                                        sx={{
                                            color: UI_COLORS.textPrimary,
                                            bgcolor: `${UI_COLORS.anomaly}18`,
                                            border: `1px solid ${UI_COLORS.anomaly}44`,
                                            "& .MuiChip-deleteIcon": { color: UI_COLORS.textSecondary },
                                        }}
                                    />
                                );
                            })}
                        </Stack>
                    )}
                    <WikiSearchableSelect
                        label="Añadir pin del mapa"
                        value=""
                        onChange={handleAddPin}
                        options={addOptions}
                        clearLabel="(elegir pin)"
                    />
                    <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.65rem", m: 0, mt: 0.35 }}>
                        Un lugar, varios pines (mapa de campaña e interiores). No clona el artículo.
                    </FormHelperText>
                </Box>
            )}

            {showCharacter && (
                <Box sx={{ minWidth: 200, flex: 1 }}>
                    <WikiSearchableSelect
                        label="Personaje jugable (token)"
                        value={linkedVttCharacterId || ""}
                        onChange={handleCharacterChange}
                        options={characterOptions}
                        clearLabel="(ninguno)"
                    />
                    <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.65rem", m: 0, mt: 0.35 }}>
                        Si está vinculado, su retrato VTT se usa como imagen de la ficha.
                    </FormHelperText>
                </Box>
            )}
        </Box>
    );
}
