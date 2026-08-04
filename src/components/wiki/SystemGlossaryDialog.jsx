/**
 * Diálogo de glosario del sistema — accesible desde el archivo narrativo.
 */
import { useMemo, useState } from "react";
import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import SearchIcon from "@mui/icons-material/Search";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    SYSTEM_GLOSSARY_SECTIONS,
    searchGlossary,
} from "../../constants/systemGlossary";

/** Misma capa que WikiAiConfigDialog — por encima del overlay del archivo (1500). */
const GLOSSARY_DIALOG_Z = 1800;

const searchSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.85rem",
        bgcolor: UI_COLORS.backgroundPrimary,
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.anomaly}88` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.anomaly },
    },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontSize: "0.78rem" },
};

const accordionSx = {
    bgcolor: "transparent",
    boxShadow: "none",
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: "6px !important",
    mb: 0.75,
    "&:before": { display: "none" },
    "&.Mui-expanded": { mb: 0.75 },
};

function GlossaryEntry({ term, definition }) {
    return (
        <Box sx={{ mb: 1.25, "&:last-child": { mb: 0 } }}>
            <CyberText
                sx={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: UI_COLORS.anomaly,
                    display: "block",
                    mb: 0.35,
                    lineHeight: 1.35,
                }}
            >
                {term}
            </CyberText>
            <CyberText
                sx={{
                    fontSize: "0.76rem",
                    color: UI_COLORS.textPrimary,
                    lineHeight: 1.5,
                    opacity: 0.92,
                }}
            >
                {definition}
            </CyberText>
        </Box>
    );
}

export default function SystemGlossaryDialog({ open, onClose }) {
    const [query, setQuery] = useState("");

    const sections = useMemo(
        () => searchGlossary(query, SYSTEM_GLOSSARY_SECTIONS),
        [query]
    );

    const totalEntries = useMemo(
        () => sections.reduce((n, s) => n + s.entries.length, 0),
        [sections]
    );

    const handleClose = () => {
        setQuery("");
        onClose?.();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            sx={{ zIndex: GLOSSARY_DIALOG_Z }}
            PaperProps={{
                sx: {
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderRadius: 1.5,
                    maxHeight: "min(88vh, 820px)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    backgroundImage: "none",
                    boxShadow: `0 0 40px ${UI_COLORS.anomaly}22`,
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1.25,
                    px: 2,
                    flexShrink: 0,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                }}
            >
                <LibraryBooksIcon sx={{ color: UI_COLORS.anomaly, fontSize: "1.2rem" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.accent, letterSpacing: 2 }}>
                        GLOSARIO DEL SISTEMA
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                        Conceptos del archivo narrativo, entidades, relaciones, IA y VTT
                    </CyberText>
                </Box>
                <IconButton size="small" onClick={handleClose} aria-label="Cerrar glosario" sx={{ color: UI_COLORS.textSecondary }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    px: 2,
                    py: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Buscar concepto…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <SearchIcon sx={{ color: UI_COLORS.textSecondary, fontSize: "1rem", mr: 0.5 }} />
                            ),
                        },
                    }}
                    sx={searchSx}
                />

                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5, flexShrink: 0 }}>
                    {totalEntries} entradas
                    {query.trim() ? ` · filtrado por «${query.trim()}»` : ""}
                </CyberText>

                {sections.length === 0 && (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem", py: 2, textAlign: "center" }}>
                        No hay resultados para esa búsqueda.
                    </CyberText>
                )}

                {sections.map((section, idx) => (
                    <Accordion
                        key={section.id}
                        defaultExpanded={query.trim().length > 0 || idx < 2}
                        sx={accordionSx}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon sx={{ color: UI_COLORS.textSecondary }} />}
                            sx={{
                                minHeight: 40,
                                px: 1.25,
                                "& .MuiAccordionSummary-content": { my: 0.75 },
                            }}
                        >
                            <Box>
                                <CyberTitle sx={{ fontSize: "0.72rem", color: UI_COLORS.accent, letterSpacing: 1.2 }}>
                                    {section.title.toUpperCase()}
                                </CyberTitle>
                                {section.description && (
                                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mt: 0.25, lineHeight: 1.35 }}>
                                        {section.description}
                                    </CyberText>
                                )}
                                <CyberText sx={{ fontSize: "0.58rem", color: `${UI_COLORS.anomaly}aa`, mt: 0.25 }}>
                                    {section.entries.length} términos
                                </CyberText>
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25, borderTop: `1px solid ${UI_COLORS.border}` }}>
                            {section.entries.map((entry) => (
                                <GlossaryEntry key={`${section.id}:${entry.term}`} {...entry} />
                            ))}
                        </AccordionDetails>
                    </Accordion>
                ))}
            </DialogContent>
        </Dialog>
    );
}
