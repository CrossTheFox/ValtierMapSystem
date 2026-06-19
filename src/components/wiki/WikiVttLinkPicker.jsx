import { Box, FormControl, InputLabel, Select, MenuItem, FormHelperText } from "@mui/material";
import { useSelector } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.82rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

const labelSx = {
    color: UI_COLORS.textSecondary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.78rem",
    "&.Mui-focused": { color: UI_COLORS.accent },
};

/**
 * Enlaza una ficha wiki con un elemento del VTT (pin o personaje jugable).
 * Locación narrativa: solo pin del mapa (opcional). Personaje: solo token VTT.
 *
 * @param {{ entityType?: string, linkedVttLocationId?: string|null, linkedVttCharacterId?: string|null, onChange: Function }} props
 */
export default function WikiVttLinkPicker({
    entityType,
    linkedVttLocationId,
    linkedVttCharacterId,
    onChange,
}) {
    const locations = useSelector((s) => s.world.locations);

    const locationOptions = Object.values(locations || {});
    const characterOptions = Object.values(locations || {}).flatMap((loc) =>
        (loc.characters || []).map((c) => ({ ...c, locationName: loc.name }))
    );

    const showLocation = entityType === WIKI_ENTITY_TYPES.LOCACION;
    const showCharacter = entityType === WIKI_ENTITY_TYPES.PERSONAJE;

    const handleLocationChange = (e) => {
        onChange({ linkedVttLocationId: e.target.value || null, linkedVttCharacterId: null });
    };

    const handleCharacterChange = (e) => {
        onChange({ linkedVttLocationId: null, linkedVttCharacterId: e.target.value || null });
    };

    if (!showLocation && !showCharacter) return null;

    return (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {showLocation && (
                <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                    <InputLabel sx={labelSx}>Pin del mapa VTT</InputLabel>
                    <Select
                        value={linkedVttLocationId || ""}
                        onChange={handleLocationChange}
                        label="Pin del mapa VTT"
                        sx={selectSx}
                        MenuProps={{ PaperProps: { sx: { bgcolor: UI_COLORS.backgroundSecondary } } }}
                    >
                        <MenuItem value="">
                            <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary }}>
                                (sin pin — solo narrativa)
                            </CyberText>
                        </MenuItem>
                        {locationOptions.map((loc) => (
                            <MenuItem key={loc.id} value={loc.id}>
                                <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>
                                    {loc.name}
                                </CyberText>
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.7rem" }}>
                        Opcional. Regiones, países o ciudades sin pin pueden quedar solo en el archivo; enlaza después desde aquí o desde el editor de ubicaciones VTT.
                    </FormHelperText>
                </FormControl>
            )}

            {showCharacter && (
                <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                    <InputLabel sx={labelSx}>Personaje jugable (token)</InputLabel>
                    <Select
                        value={linkedVttCharacterId || ""}
                        onChange={handleCharacterChange}
                        label="Personaje jugable (token)"
                        sx={selectSx}
                        MenuProps={{ PaperProps: { sx: { bgcolor: UI_COLORS.backgroundSecondary } } }}
                    >
                        <MenuItem value="">
                            <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary }}>
                                (ninguno)
                            </CyberText>
                        </MenuItem>
                        {characterOptions.map((char) => (
                            <MenuItem key={char.id} value={char.id}>
                                <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textPrimary }}>
                                    {char.name}
                                    <Box component="span" sx={{ color: UI_COLORS.textSecondary, fontSize: "0.7rem" }}>
                                        {" "}({char.locationName})
                                    </Box>
                                </CyberText>
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText sx={{ color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.7rem" }}>
                        Opcional. Personajes históricos pueden no tener token en el mapa.
                    </FormHelperText>
                </FormControl>
            )}
        </Box>
    );
}
