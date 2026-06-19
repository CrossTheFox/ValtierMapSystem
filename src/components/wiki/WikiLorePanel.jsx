import { useState } from "react";
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import LockIcon from "@mui/icons-material/Lock";

import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

/**
 * Single lore entry card — handles locked state, date, and click.
 * Extracted from WorldDrawer so it can be reused and tested independently.
 *
 * @param {{ entry: object, onClick: Function }} props
 */
function LoreItem({ entry, onClick, onDmArchiveOpen }) {
    const [showHint, setShowHint] = useState(false);
    const isLocked = entry.isLocked;

    const dateLabel = entry.created_at
        ? new Date(
              entry.created_at.seconds
                  ? entry.created_at.seconds * 1000
                  : entry.created_at
          ).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
          })
        : "N/A";

    const handleLockedClick = (e) => {
        e.stopPropagation();
        setShowHint((prev) => !prev);
    };

    return (
        <Box
            onClick={(e) => {
                if (isLocked) return handleLockedClick(e);
                e.stopPropagation();
                onClick(entry);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isLocked) setShowHint((prev) => !prev);
                    else onClick(entry);
                }
            }}
            sx={{
                position: "relative",
                p: 1.5,
                mb: 1.5,
                cursor: "pointer",
                borderRadius: "4px",
                backgroundColor: "rgba(255,255,255,0.03)",
                borderLeft: `2px solid ${
                    isLocked
                        ? showHint
                            ? UI_COLORS.anomaly
                            : "rgba(255,255,255,0.1)"
                        : "transparent"
                }`,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                overflow: "hidden",
                "&:hover": {
                    backgroundColor: isLocked
                        ? "rgba(255,255,255,0.05)"
                        : `${UI_COLORS.anomaly}14`,
                },
                "&:focus-visible": {
                    outline: `1px solid ${UI_COLORS.accent}`,
                    outlineOffset: 2,
                },
            }}
        >
            {isLocked && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 2,
                        backdropFilter: showHint ? "blur(8px)" : "blur(4px)",
                        backgroundColor: showHint
                            ? "rgba(0,0,0,0.7)"
                            : "rgba(0,0,0,0.4)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.3s ease",
                        px: 2,
                        textAlign: "center",
                    }}
                >
                    <LockIcon
                        sx={{
                            color: UI_COLORS.anomaly,
                            fontSize: "1.5rem",
                            filter: `drop-shadow(0 0 5px ${UI_COLORS.anomaly})`,
                            mb: showHint ? 1 : 0,
                        }}
                    />
                    {showHint && (
                        <CyberText
                            variant="caption"
                            sx={{ color: UI_COLORS.anomaly, animation: "fadeIn 0.3s" }}
                        >
                            OBJETIVO: {entry.unlockGoal || "Misión desconocida"}
                        </CyberText>
                    )}
                </Box>
            )}

            <Box sx={{ opacity: isLocked ? 0.2 : 1 }}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 0.5,
                    }}
                >
                    <LocalLibraryIcon
                        sx={{ fontSize: "0.9rem", color: `${UI_COLORS.anomaly}80` }}
                    />
                    <CyberText
                        variant="caption"
                        sx={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}
                    >
                        ({dateLabel})
                    </CyberText>
                </Box>

                <CyberText
                    variant="body2"
                    sx={{
                        color: UI_COLORS.anomaly,
                        fontWeight: "bold",
                        textTransform: "uppercase",
                    }}
                >
                    {entry.title}
                </CyberText>

                <CyberText variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                    {entry.summary}
                </CyberText>

                {onDmArchiveOpen && !entry.isLocked && (
                    <Box
                        onClick={(e) => { e.stopPropagation(); onDmArchiveOpen(entry); }}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            mt: 0.75,
                            px: 1,
                            py: 0.3,
                            bgcolor: `${UI_COLORS.accent}11`,
                            border: `1px solid ${UI_COLORS.accent}44`,
                            borderRadius: 1,
                            cursor: "pointer",
                            "&:hover": { bgcolor: `${UI_COLORS.accent}22`, borderColor: UI_COLORS.accent },
                        }}
                    >
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.accent, lineHeight: 1 }}>
                            ABRIR EN ARCHIVO
                        </CyberText>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/**
 * Lore accordion panel — groups entries by category and renders LoreItem cards.
 * Reads from the `lore` array passed as prop; click propagation is handled by the
 * parent (WorldDrawer dispatches setSelectedLore).
 *
 * @param {{ lore: object[], onEntryClick: Function, onDmArchiveOpen?: Function }} props
 */
export default function WikiLorePanel({ lore = [], onEntryClick, onDmArchiveOpen }) {
    const [expandedCategory, setExpandedCategory] = useState(false);

    const categories = [...new Set(lore.map((item) => item.category))];

    const handleAccordionChange = (category) => (_event, isExpanded) => {
        setExpandedCategory(isExpanded ? category : false);
    };

    if (categories.length === 0) {
        return (
            <CyberTitle variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                No archive entries found...
            </CyberTitle>
        );
    }

    return (
        <>
            {categories.map((cat) => (
                <Accordion
                    key={cat}
                    disableGutters
                    elevation={0}
                    expanded={expandedCategory === cat}
                    onChange={handleAccordionChange(cat)}
                    sx={{
                        backgroundColor: "transparent",
                        color: UI_COLORS.textPrimary,
                        "&:before": { display: "none" },
                    }}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: UI_COLORS.accent }} />}
                        sx={{
                            px: 1,
                            "& .MuiAccordionSummary-content": { margin: "12px 0" },
                        }}
                    >
                        <CyberText
                            variant="subtitle2"
                            sx={{ color: UI_COLORS.accent, letterSpacing: 1 }}
                        >
                            {cat.toUpperCase()}
                        </CyberText>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 1, pt: 0, pb: 2 }}>
                        {lore
                            .filter((item) => item.category === cat)
                            .map((entry) => (
                                <LoreItem
                                    key={entry.id}
                                    entry={entry}
                                    onClick={onEntryClick}
                                    onDmArchiveOpen={onDmArchiveOpen}
                                />
                            ))}
                    </AccordionDetails>
                </Accordion>
            ))}
        </>
    );
}
