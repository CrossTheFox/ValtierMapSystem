import { useState } from "react";
import { Box, Collapse, IconButton, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { getWikiCreationOrderChain } from "../../constants/wiki/wikiCreationOrder";

/**
 * Hint de orden recomendado al crear fichas en el archivo narrativo.
 * Se muestra arriba a la derecha del editor (solo en modo creación).
 */
export default function WikiCreationOrderHint({ currentEntityType }) {
    const [open, setOpen] = useState(false);
    const steps = getWikiCreationOrderChain();

    return (
        <Box
            sx={{
                flex: "1 1 220px",
                minWidth: 200,
                maxWidth: 420,
                ml: "auto",
                alignSelf: "flex-start",
            }}
        >
            <Box
                sx={{
                    bgcolor: `${UI_COLORS.accent}08`,
                    border: `1px solid ${UI_COLORS.accent}33`,
                    borderRadius: 1,
                    overflow: "hidden",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        px: 1,
                        py: 0.5,
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                    onClick={() => setOpen((v) => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpen((v) => !v);
                        }
                    }}
                >
                    <InfoOutlinedIcon sx={{ fontSize: "0.95rem", color: UI_COLORS.accent }} />
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.accent, letterSpacing: 1, flex: 1 }}>
                        ORDEN_RECOMENDADO
                    </CyberText>
                    <Tooltip title={open ? "Ocultar" : "Ver dependencias"}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen((v) => !v);
                            }}
                            sx={{
                                color: UI_COLORS.textSecondary,
                                transform: open ? "rotate(180deg)" : "none",
                                transition: "transform 0.2s",
                            }}
                        >
                            <ExpandMoreIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Collapse in={open}>
                    <Box sx={{ px: 1.25, pb: 1.25, pt: 0.25 }}>
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, mb: 1, lineHeight: 1.45 }}>
                            De lo general a lo concreto. Los enlaces entre fichas son opcionales, pero este orden evita
                            dejar referencias vacías.
                        </CyberText>

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.35, alignItems: "center", mb: 1 }}>
                            {steps.map((step, i) => (
                                <Box key={step.entityType} sx={{ display: "flex", alignItems: "center", gap: 0.35 }}>
                                    {i > 0 && (
                                        <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, mx: 0.15 }}>
                                            →
                                        </CyberText>
                                    )}
                                    <CyberText
                                        sx={{
                                            fontSize: "0.62rem",
                                            px: 0.6,
                                            py: 0.15,
                                            borderRadius: 0.5,
                                            bgcolor:
                                                currentEntityType === step.entityType
                                                    ? `${UI_COLORS.accent}22`
                                                    : UI_COLORS.backgroundPrimary,
                                            border: `1px solid ${
                                                currentEntityType === step.entityType
                                                    ? UI_COLORS.accent
                                                    : UI_COLORS.border
                                            }`,
                                            color:
                                                currentEntityType === step.entityType
                                                    ? UI_COLORS.accent
                                                    : UI_COLORS.textPrimary,
                                            fontWeight: currentEntityType === step.entityType ? 600 : 400,
                                        }}
                                    >
                                        {step.index}. {step.label}
                                    </CyberText>
                                </Box>
                            ))}
                        </Box>

                        <Box component="ul" sx={{ m: 0, pl: 2.25, display: "flex", flexDirection: "column", gap: 0.35 }}>
                            {steps.map((step) => (
                                <Box component="li" key={`note-${step.entityType}`} sx={{ listStyle: "disc" }}>
                                    <CyberText
                                        component="span"
                                        sx={{
                                            fontSize: "0.6rem",
                                            color:
                                                currentEntityType === step.entityType
                                                    ? UI_COLORS.accent
                                                    : UI_COLORS.textSecondary,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        <Box component="span" sx={{ color: UI_COLORS.textPrimary, fontWeight: 500 }}>
                                            {step.label}:
                                        </Box>{" "}
                                        {step.note}
                                        {step.subOrder ? (
                                            <>
                                                {" "}
                                                <Box component="span" sx={{ display: "block", mt: 0.25, fontStyle: "italic" }}>
                                                    Jerarquía locación: {step.subOrder}
                                                </Box>
                                            </>
                                        ) : null}
                                    </CyberText>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Collapse>
            </Box>
        </Box>
    );
}
