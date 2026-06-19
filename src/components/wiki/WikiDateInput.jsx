import { useMemo } from "react";
import { Box, TextField } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { formatDateForInput, parseInputToStorage } from "../../utils/wikiTimeline";

const segmentSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.85rem",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.accent}88` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent },
    },
    "& .MuiInputLabel-root": {
        color: UI_COLORS.textSecondary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.75rem",
    },
    "& .MuiInputLabel-root.Mui-focused": { color: UI_COLORS.accent },
    // hide number spinners
    "& input[type=number]": { MozAppearance: "textfield" },
    "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": {
        WebkitAppearance: "none",
        margin: 0,
    },
};

/**
 * Segmented Día / Mes / Año date input (Latin American order). Emits a
 * year-first sortable storage string ("YYYY" | "YYYY-MM" | "YYYY-MM-DD") so the
 * timeline sort/group logic stays unchanged. Year is required; month optional;
 * day requires month.
 *
 * @param {{ value?: string, onChange: (storage: string) => void, required?: boolean }} props
 */
export default function WikiDateInput({ value = "", onChange, required = false }) {
    const seg = useMemo(() => formatDateForInput(value), [value]);

    const emit = (next) => {
        onChange?.(parseInputToStorage(next));
    };

    const handle = (field) => (e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        emit({ ...seg, [field]: raw });
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 220 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <TextField
                    label="Día"
                    value={seg.d}
                    onChange={handle("d")}
                    size="small"
                    type="number"
                    inputProps={{ min: 1, max: 31, "aria-label": "Día" }}
                    sx={{ ...segmentSx, width: 64 }}
                />
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "1rem" }}>/</CyberText>
                <TextField
                    label="Mes"
                    value={seg.m}
                    onChange={handle("m")}
                    size="small"
                    type="number"
                    inputProps={{ min: 1, max: 12, "aria-label": "Mes" }}
                    sx={{ ...segmentSx, width: 64 }}
                />
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "1rem" }}>/</CyberText>
                <TextField
                    label={required ? "Año *" : "Año"}
                    value={seg.y}
                    onChange={handle("y")}
                    size="small"
                    type="number"
                    inputProps={{ min: 1, "aria-label": "Año" }}
                    sx={{ ...segmentSx, width: 92 }}
                />
            </Box>
            <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.65rem" }}>
                Formato DD/MM/AAAA. El año es obligatorio; mes y día son opcionales (el día requiere mes).
            </CyberText>
        </Box>
    );
}
