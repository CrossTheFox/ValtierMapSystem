import { Box, Chip } from "@mui/material";
import { useSelector } from "react-redux";
import MapIcon from "@mui/icons-material/Map";
import PeopleIcon from "@mui/icons-material/People";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { HUD_SURFACE } from "../../constants/designSystem";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { collectPinsForWikiLocation, linkedLocationIdsOf } from "../../constants/wiki/archiveIdentity.js";
import { findVttCharacter } from "../../utils/resolveWikiEntityImage";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

const chipSx = {
    bgcolor: `${UI_COLORS.anomaly}11`,
    border: `1px solid ${UI_COLORS.anomaly}44`,
    color: UI_COLORS.anomaly,
    height: 22,
    cursor: "pointer",
    "&:hover": { bgcolor: `${UI_COLORS.anomaly}22` },
    "& .MuiChip-label": { px: 0.65 },
};

function mapLabel(maps, mapId) {
    if (!mapId) return "sin mapa";
    const hit = (maps || []).find((m) => m.id === mapId);
    return hit?.name || String(mapId).slice(0, 8);
}

function pinCoords(pin) {
    const x = pin?.position?.x ?? pin?.x;
    const y = pin?.position?.y ?? pin?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return `${Math.round(x)}, ${Math.round(y)}`;
}

/**
 * Archive reading chrome: VTT instance strip (token vitals or map pins).
 * Wiki article stays the canonical prose; this does not open MESH.
 */
export default function ArchiveVttStrip({
    entity,
    locations = {},
    onOpenVttLocation,
    onOpenVttCharacter,
    compact = false,
}) {
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const maps = useSelector((s) => s.world.maps || []);

    if (!entity) return null;

    if (entity.entityType === WIKI_ENTITY_TYPES.PERSONAJE) {
        const characterId = entity.linkedVttCharacterId;
        if (!characterId) {
            return (
                <Box sx={{ mt: compact ? 0.85 : 1, p: 1, border: `1px dashed ${UI_COLORS.border}`, borderRadius: 1 }}>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                        Sin token en mesa. Edita la ficha para enlazar el personaje jugable.
                    </CyberText>
                </Box>
            );
        }
        const character = findVttCharacter(locations, characterId, charactersById);
        const vit = Number.isFinite(Number(character?.vit)) ? Number(character.vit) : null;
        const hpCur = Number.isFinite(Number(character?.hpCur)) ? Number(character.hpCur) : vit;
        const job = character?.activeClassId || character?.assignedClassIds?.[0] || character?.type || "";
        const loc = character?.locationId ? locations[character.locationId] : null;

        return (
            <Box
                sx={{
                    ...HUD_SURFACE,
                    mt: compact ? 0.85 : 1,
                    px: 1,
                    py: 0.85,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                }}
            >
                <PeopleIcon sx={{ fontSize: "0.85rem", color: UI_COLORS.anomaly }} />
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textPrimary }}>
                    {character?.name || "Token VTT"}
                    {hpCur != null && vit != null ? ` · HP ${hpCur}/${vit}` : ""}
                    {job ? ` · ${job}` : ""}
                </CyberText>
                {loc && (
                    <Chip
                        icon={<MapIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                        label={<CyberText sx={{ fontSize: "0.62rem" }}>Ir al mapa</CyberText>}
                        size="small"
                        onClick={() => onOpenVttLocation?.(loc.id)}
                        sx={chipSx}
                    />
                )}
                {onOpenVttCharacter && (
                    <Chip
                        label={<CyberText sx={{ fontSize: "0.62rem" }}>Token</CyberText>}
                        size="small"
                        onClick={() => onOpenVttCharacter(characterId)}
                        sx={chipSx}
                    />
                )}
            </Box>
        );
    }

    if (entity.entityType === WIKI_ENTITY_TYPES.LOCACION) {
        const pins = collectPinsForWikiLocation(entity, locations);
        const orphanIds = linkedLocationIdsOf(entity).filter(
            (id) => !pins.some((p) => p.id === id)
        );

        if (pins.length === 0 && orphanIds.length === 0) {
            return (
                <Box sx={{ mt: compact ? 0.85 : 1, p: 1, border: `1px dashed ${UI_COLORS.border}`, borderRadius: 1 }}>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                        Sin pines en el mapa. Elige un pin existente al editar; no se clona el artículo.
                    </CyberText>
                </Box>
            );
        }

        return (
            <Box
                sx={{
                    ...HUD_SURFACE,
                    mt: compact ? 0.85 : 1,
                    px: 1,
                    py: 0.85,
                    maxHeight: compact ? 88 : 120,
                    overflowY: "auto",
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, letterSpacing: "0.12em", display: "block", mb: 0.6 }}>
                    INSTANCIAS EN MAPA
                </CyberText>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.45 }}>
                    {pins.map((pin) => {
                        const roster = Array.isArray(pin.characters) ? pin.characters.length : 0;
                        const coords = pinCoords(pin);
                        return (
                            <Box key={pin.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textPrimary }}>
                                    {pin.name || "Pin"}
                                    {" · "}
                                    {mapLabel(maps, pin.mapId)}
                                    {coords ? ` · ${coords}` : ""}
                                    {roster ? ` · ${roster} en mesa` : ""}
                                </CyberText>
                                <Chip
                                    icon={<MapIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                    label={<CyberText sx={{ fontSize: "0.62rem" }}>Ir al mapa</CyberText>}
                                    size="small"
                                    onClick={() => onOpenVttLocation?.(pin.id)}
                                    sx={chipSx}
                                />
                            </Box>
                        );
                    })}
                    {orphanIds.map((id) => (
                        <Box key={id} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary }}>
                                Pin {String(id).slice(0, 8)} (fuera de este mundo)
                            </CyberText>
                            <Chip
                                icon={<MapIcon sx={{ fontSize: "0.75rem !important", color: `${UI_COLORS.anomaly} !important` }} />}
                                label={<CyberText sx={{ fontSize: "0.62rem" }}>Ir al mapa</CyberText>}
                                size="small"
                                onClick={() => onOpenVttLocation?.(id)}
                                sx={chipSx}
                            />
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    }

    return null;
}
