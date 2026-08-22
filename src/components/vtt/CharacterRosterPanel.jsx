import { useMemo, useState } from "react";
import {
    Box, Paper, IconButton, TextField, InputAdornment, Chip,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useDispatch, useSelector } from "react-redux";

import { openCharacterSheet } from "../../store/uiSlice";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_RIGHT_DOCK } from "../../constants/vttHudTokens";
import { listCampaignCharacters } from "../../utils/characterCombat";
import { characterRosterKind } from "../../utils/characterRosterKind";

/**
 * DM campaign roster in the right dock (same surface pattern as tokens/chat).
 * Opens any character dossier from search + PJ/NPC filters.
 */
export default function CharacterRosterPanel({ open, onClose }) {
    const dispatch = useDispatch();
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const locations = useSelector((s) => s.world.locations);
    const [query, setQuery] = useState("");
    const [kindFilter, setKindFilter] = useState("all"); // all | pc | npc

    const roster = useMemo(
        () => listCampaignCharacters(charactersById, locations)
            .slice()
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es")),
        [charactersById, locations],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return roster.filter((c) => {
            const kind = characterRosterKind(c);
            if (kindFilter === "pc" && kind !== "pc") return false;
            if (kindFilter === "npc" && kind !== "npc") return false;
            if (!q) return true;
            const name = (c.name || "").toLowerCase();
            const tag = kind === "pc" ? "pj player pc" : "npc";
            return name.includes(q) || tag.includes(q);
        });
    }, [roster, query, kindFilter]);

    if (!open) return null;

    const handleOpen = (charId) => {
        dispatch(openCharacterSheet({ tab: "IDENTIDAD", characterId: charId }));
        setQuery("");
    };

    const filterChip = (id, label) => {
        const active = kindFilter === id;
        return (
            <Box
                key={id}
                component="button"
                type="button"
                onClick={() => setKindFilter(id)}
                sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: "3px",
                    border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                    bgcolor: active ? `${UI_COLORS.anomaly}18` : "transparent",
                    color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.5rem",
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                }}
            >
                {label}
            </Box>
        );
    };

    return (
        <Paper
            elevation={0}
            data-no-token-drop
            sx={{
                width: "100%",
                maxHeight: VTT_RIGHT_DOCK.rosterPanelMaxHeight,
                flexShrink: 0,
                bgcolor: `${UI_COLORS.backgroundSecondary}f2`,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.25,
                    py: 0.5,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                }}
            >
                <GroupsIcon sx={{ fontSize: "0.95rem", color: UI_COLORS.accent }} />
                <CyberTitle sx={{ fontSize: "0.62rem", color: UI_COLORS.accent, letterSpacing: 2, flex: 1 }}>
                    PERSONAJES
                </CyberTitle>
                <Chip
                    label={`${filtered.length}/${roster.length}`}
                    size="small"
                    sx={{ height: 18, fontSize: "0.55rem", color: UI_COLORS.textPrimary }}
                />
                <IconButton size="small" onClick={onClose} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
            </Box>

            <Box sx={{ px: 1.25, pt: 0.85, pb: 0.65, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Buscar nombre o PJ / NPC…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: "0.95rem", color: UI_COLORS.textSecondary }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        mb: 0.75,
                        "& .MuiOutlinedInput-root": {
                            color: UI_COLORS.textPrimary,
                            fontSize: "0.72rem",
                            bgcolor: "rgba(0,0,0,0.35)",
                            borderRadius: "4px",
                            "& fieldset": { borderColor: UI_COLORS.border },
                            "&:hover fieldset": { borderColor: UI_COLORS.anomaly },
                            "&.Mui-focused fieldset": { borderColor: UI_COLORS.anomaly },
                        },
                        "& .MuiInputBase-input::placeholder": {
                            color: UI_COLORS.textSecondary,
                            opacity: 1,
                        },
                    }}
                />
                <Box sx={{ display: "flex", gap: 0.5 }}>
                    {filterChip("all", "TODOS")}
                    {filterChip("pc", "PJ")}
                    {filterChip("npc", "NPC")}
                </Box>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    p: 0.75,
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {filtered.map((c) => {
                    const kind = characterRosterKind(c);
                    const isPc = kind === "pc";
                    return (
                        <Box
                            key={c.id}
                            component="button"
                            type="button"
                            onClick={() => handleOpen(c.id)}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.85,
                                width: "100%",
                                textAlign: "left",
                                px: 0.85,
                                py: 0.65,
                                mb: 0.35,
                                borderRadius: "4px",
                                border: `1px solid ${isPc ? `${UI_COLORS.anomaly}55` : UI_COLORS.border}`,
                                bgcolor: "rgba(0,0,0,0.28)",
                                cursor: "pointer",
                                color: UI_COLORS.textPrimary,
                                "&:hover": {
                                    borderColor: UI_COLORS.accent,
                                    bgcolor: `${UI_COLORS.accent}12`,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: "0.62rem",
                                    letterSpacing: "0.04em",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {(c.name || "—").toUpperCase()}
                            </Box>
                            <Box
                                sx={{
                                    flexShrink: 0,
                                    px: 0.55,
                                    py: "1px",
                                    borderRadius: "2px",
                                    border: `1px solid ${isPc ? UI_COLORS.anomaly : "rgba(255,255,255,0.28)"}`,
                                    color: isPc ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.45rem",
                                    letterSpacing: "0.1em",
                                }}
                            >
                                {isPc ? "PJ" : "NPC"}
                            </Box>
                        </Box>
                    );
                })}
                {filtered.length === 0 && (
                    <CyberText
                        sx={{
                            fontSize: "0.62rem",
                            color: UI_COLORS.textSecondary,
                            py: 2,
                            textAlign: "center",
                        }}
                    >
                        {roster.length === 0 ? "No hay personajes en la campaña." : "Sin coincidencias"}
                    </CyberText>
                )}
            </Box>
        </Paper>
    );
}
