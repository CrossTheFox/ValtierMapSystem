import { useMemo } from "react";
import { Box, FormHelperText } from "@mui/material";
import { useSelector } from "react-redux";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import WikiSearchableSelect from "./WikiSearchableSelect";

/**
 * Enlaza una ficha wiki con un elemento del VTT (pin o personaje jugable).
 */
export default function WikiVttLinkPicker({
    entityType,
    linkedVttLocationId,
    linkedVttCharacterId,
    onChange,
}) {
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});

    const locationOptions = useMemo(
        () => Object.values(locations || {}).map((loc) => ({
            value: loc.id,
            label: loc.name,
        })),
        [locations]
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

    const handleLocationChange = (v) => {
        onChange({ linkedVttLocationId: v || null, linkedVttCharacterId: null });
    };

    const handleCharacterChange = (v) => {
        onChange({ linkedVttLocationId: null, linkedVttCharacterId: v || null });
    };

    if (!showLocation && !showCharacter) return null;

    return (
        <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap" }}>
            {showLocation && (
                <Box sx={{ minWidth: 200, flex: 1 }}>
                    <WikiSearchableSelect
                        label="Pin del mapa VTT"
                        value={linkedVttLocationId || ""}
                        onChange={handleLocationChange}
                        options={locationOptions}
                        clearLabel="(sin pin)"
                    />
                    <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.65rem", m: 0, mt: 0.35 }}>
                        Opcional. Enlaza después si aún no hay pin en el mapa.
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
