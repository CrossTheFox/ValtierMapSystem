import { useState } from "react";
import { Box, Popover, List, ListItemButton } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import CharAvatar from "./CharAvatar";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { formatClassLabel } from "../../constants/characterSheetTokens";

export default function CharacterAvatarPicker({
    characters = [],
    selectedId,
    onSelect,
    size = 44,
    variant = "header",
}) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const selected = characters.find((c) => c.id === selectedId) || characters[0];
    const isHeader = variant === "header" || variant === "float";
    const isFloat = variant === "float";

    if (!characters.length) return null;

    const handleOpen = (e) => {
        e.stopPropagation();
        if (characters.length > 1) setAnchorEl(e.currentTarget);
    };

    const handleClose = () => setAnchorEl(null);

    const handlePick = (charId) => {
        onSelect?.(charId);
        handleClose();
    };

    const trigger = (
        <Box
            className="dialog-no-drag"
            onClick={handleOpen}
            role="button"
            tabIndex={0}
            aria-haspopup="listbox"
            aria-expanded={open}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpen(e);
                }
            }}
            sx={{
                position: isHeader ? "relative" : "absolute",
                top: isHeader ? undefined : -12,
                left: isHeader ? undefined : 16,
                zIndex: isHeader ? 2 : 1300,
                cursor: characters.length > 1 ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                flexShrink: 0,
                mr: isHeader && !isFloat ? 0.5 : 0,
                ...(isHeader && !isFloat && {
                    transform: "translateY(2px)",
                }),
            }}
        >
            <Box
                sx={{
                    position: "relative",
                    borderRadius: "50%",
                    border: `2px solid ${UI_COLORS.accent}`,
                    boxShadow: isFloat
                        ? `0 0 10px ${UI_COLORS.accentGlow || "rgba(255,102,255,0.2)"}`
                        : `0 0 14px ${UI_COLORS.accentGlow || "rgba(255,102,255,0.25)"}`,
                    bgcolor: "#0d0d14",
                    p: isFloat ? 0.15 : 0.2,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": characters.length > 1
                        ? { transform: "scale(1.04)", boxShadow: `0 0 18px ${UI_COLORS.accent}55` }
                        : {},
                }}
            >
                <CharAvatar
                    imagePath={selected?.imageUrl}
                    name={selected?.name}
                    size={size}
                    status={selected?.status || "alive"}
                />
            </Box>
            {characters.length > 1 && (
                <KeyboardArrowDownIcon
                    sx={{
                        fontSize: "0.75rem",
                        color: UI_COLORS.accent,
                        opacity: open ? 1 : 0.65,
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                    }}
                />
            )}
        </Box>
    );

    return (
        <>
            {trigger}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.75,
                            width: 300,
                            maxHeight: "min(440px, 58vh)",
                            bgcolor: "rgba(26, 26, 42, 0.95)",
                            backdropFilter: "blur(16px)",
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: 2,
                            overflow: "hidden",
                            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${UI_COLORS.accent}22`,
                        },
                    },
                }}
            >
                <Box
                    sx={{
                        px: 1.5,
                        py: 1,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.anomaly, letterSpacing: "0.12em" }}>
                        SELECCIONAR PERSONAJE
                    </CyberText>
                    <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary }}>
                        {characters.length}
                    </CyberText>
                </Box>
                <List dense disablePadding role="listbox" sx={{ overflowY: "auto", py: 0.5 }}>
                    {characters.map((char) => {
                        const active = char.id === selectedId;
                        return (
                            <ListItemButton
                                key={char.id}
                                selected={active}
                                onClick={() => handlePick(char.id)}
                                sx={{
                                    gap: 1.25,
                                    py: 1,
                                    px: 1.5,
                                    borderLeft: active ? `3px solid ${UI_COLORS.anomaly}` : "3px solid transparent",
                                    "&.Mui-selected": {
                                        bgcolor: `${UI_COLORS.anomaly}12`,
                                        "&:hover": { bgcolor: `${UI_COLORS.anomaly}18` },
                                    },
                                }}
                            >
                                <CharAvatar
                                    imagePath={char.imageUrl}
                                    name={char.name}
                                    size={40}
                                    status={char.status || "alive"}
                                />
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <CyberTitle
                                        sx={{
                                            fontSize: "0.72rem",
                                            color: active ? UI_COLORS.anomaly : UI_COLORS.textPrimary,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {char.name?.toUpperCase() || "???"}
                                    </CyberTitle>
                                    {char.activeClassId && (
                                        <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                                            {formatClassLabel(char.activeClassId)}
                                        </CyberText>
                                    )}
                                </Box>
                            </ListItemButton>
                        );
                    })}
                </List>
            </Popover>
        </>
    );
}
