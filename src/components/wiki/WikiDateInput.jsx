import { useState, useEffect, useRef } from "react";
import { Box, TextField } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { formatDateForInput, parseInputToStorage } from "../../utils/wikiTimeline";

const segmentSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Code', monospace",
        fontSize: "0.9rem",
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
    "& .MuiInputBase-input": {
        color: UI_COLORS.textPrimary,
        textAlign: "center",
        letterSpacing: "0.04em",
    },
};

const FIELD_LIMITS = { d: 2, m: 2, y: 4 };

/**
 * Segmented Día / Mes / Año (calendario D.Z.). Campos de texto numérico con
 * estado local para evitar pérdida de dígitos al escribir. Emite strings
 * year-first: "YYYY" | "YYYY-MM" | "YYYY-MM-DD".
 */
export default function WikiDateInput({ value = "", onChange, required = false }) {
    const [seg, setSeg] = useState(() => formatDateForInput(value));
    const emittedRef = useRef(value ?? "");

    useEffect(() => {
        const external = value ?? "";
        if (external !== emittedRef.current) {
            setSeg(formatDateForInput(external));
            emittedRef.current = external;
        }
    }, [value]);

    const commit = (next) => {
        setSeg(next);
        const storage = parseInputToStorage(next);
        emittedRef.current = storage;
        onChange?.(storage);
    };

    const handle = (field) => (e) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, FIELD_LIMITS[field]);
        commit({ ...seg, [field]: raw });
    };

    const handleKeyDown = (field) => (e) => {
        if (e.key !== "Backspace" || e.target.value !== "") return;
        if (field === "m" && seg.d) commit({ ...seg, d: "" });
        if (field === "y" && seg.m) commit({ ...seg, m: "" });
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 220 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <TextField
                    label="Día"
                    value={seg.d}
                    onChange={handle("d")}
                    onKeyDown={handleKeyDown("d")}
                    size="small"
                    type="text"
                    inputMode="numeric"
                    inputProps={{ maxLength: 2, "aria-label": "Día" }}
                    placeholder="DD"
                    sx={{ ...segmentSx, width: 58 }}
                />
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "1rem", userSelect: "none" }}>/</CyberText>
                <TextField
                    label="Mes"
                    value={seg.m}
                    onChange={handle("m")}
                    onKeyDown={handleKeyDown("m")}
                    size="small"
                    type="text"
                    inputMode="numeric"
                    inputProps={{ maxLength: 2, "aria-label": "Mes" }}
                    placeholder="MM"
                    sx={{ ...segmentSx, width: 58 }}
                />
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "1rem", userSelect: "none" }}>/</CyberText>
                <TextField
                    label={required ? "Año *" : "Año"}
                    value={seg.y}
                    onChange={handle("y")}
                    onKeyDown={handleKeyDown("y")}
                    size="small"
                    type="text"
                    inputMode="numeric"
                    inputProps={{ maxLength: 4, "aria-label": "Año" }}
                    placeholder="AAAA"
                    sx={{ ...segmentSx, width: 88 }}
                />
            </Box>
            <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.65rem", lineHeight: 1.45 }}>
                Calendario D.Z. · año obligatorio · mes y día opcionales
            </CyberText>
        </Box>
    );
}
