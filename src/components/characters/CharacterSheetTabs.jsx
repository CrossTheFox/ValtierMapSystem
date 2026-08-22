import { Box, Divider } from "@mui/material";
import BadgeIcon from "@mui/icons-material/Badge";
import ConstructionIcon from "@mui/icons-material/Construction";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import HubIcon from "@mui/icons-material/Hub";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

import CyberTooltip from "../customs/CyberTooltip";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CHARACTER_SHEET_TOKENS } from "../../constants/characterSheetTokens";

export const SHEET_TABS = [
    { id: "IDENTIDAD", label: "IDENTIDAD", short: "ID",   Icon: BadgeIcon, accent: "anomaly" },
    { id: "KIT",         label: "KIT",         short: "KIT", Icon: ConstructionIcon, accent: "anomaly" },
    { id: "MESH",        label: "MESH",        short: "MESH", Icon: HubIcon, accent: "accent" },
    /** Narrative facet (wiki PERSONAJE) — visual accent distinct from play tabs. */
    { id: "NARRATIVA", label: "NARRATIVA", short: "NAR", Icon: AutoStoriesIcon, accent: "accent" },
];

const MALETIN_INTENTS = new Set(["INVENTARIO", "INV", "INVENTORY", "BRIEFCASE"]);

export function isMaletinIntent(tabId) {
    return MALETIN_INTENTS.has(tabId);
}

/** Map legacy tab ids from previous 5-tab sheet. Inventory lives in the KIT drawer. */
export function normalizeSheetTab(tabId) {
    if (tabId === "IDENTIDAD" || tabId === "KIT" || tabId === "MESH" || tabId === "NARRATIVA") {
        return tabId;
    }
    if (isMaletinIntent(tabId)) return "KIT";
    if (tabId === "SKILLS" || tabId === "SKILL_MATRIX") return "KIT";
    if (tabId === "NAR" || tabId === "NARRATIVE" || tabId === "BIO") return "NARRATIVA";
    return "IDENTIDAD";
}

const GOLD = UI_COLORS.loot;

export function MaletinChromeButton({ open, count = 0, onClick }) {
    return (
        <CyberTooltip title={open ? "Cerrar maletín" : "Maletín"} placement="bottom">
            <Box
                component="button"
                type="button"
                className="dialog-no-drag"
                aria-label="Maletín"
                aria-expanded={Boolean(open)}
                onClick={onClick}
                sx={{
                    position: "relative",
                    width: 34,
                    height: 34,
                    border: `1px solid ${open ? GOLD : `${GOLD}88`}`,
                    borderRadius: "4px",
                    bgcolor: open ? GOLD : "rgba(8,8,14,0.88)",
                    color: open ? "#000" : GOLD,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                    "&:hover": {
                        bgcolor: open ? GOLD : `${GOLD}22`,
                    },
                }}
            >
                <WorkOutlineIcon sx={{ fontSize: "1rem" }} />
                {count > 0 ? (
                    <Box
                        component="span"
                        sx={{
                            position: "absolute",
                            top: -5,
                            right: -5,
                            minWidth: 14,
                            height: 14,
                            px: "3px",
                            borderRadius: "7px",
                            bgcolor: open ? "#000" : GOLD,
                            color: open ? GOLD : "#000",
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "8px",
                            lineHeight: "14px",
                            textAlign: "center",
                        }}
                    >
                        {count > 99 ? "99+" : count}
                    </Box>
                ) : null}
            </Box>
        </CyberTooltip>
    );
}

export default function CharacterSheetTabs({ value, onChange, overlay = false }) {
    return (
        <Box
            className="dialog-no-drag"
            sx={{
                flexShrink: 0,
                display: "flex",
                justifyContent: "flex-end",
                gap: 0.25,
                ...(overlay
                    ? {
                          borderRadius: 1,
                          bgcolor: "rgba(10, 10, 20, 0.78)",
                          backdropFilter: "blur(12px)",
                          border: `1px solid ${UI_COLORS.border}`,
                          boxShadow: "0 2px 14px rgba(0,0,0,0.4)",
                          overflow: "hidden",
                          mr: 0.75,
                          mt: 0.25,
                      }
                    : {
                          bgcolor: "rgba(18, 18, 28, 0.72)",
                          borderBottom: `1px solid ${UI_COLORS.border}`,
                          minHeight: CHARACTER_SHEET_TOKENS.tabHeight,
                          width: "100%",
                      }),
            }}
        >
            {SHEET_TABS.map((tab) => {
                const active = value === tab.id;
                const Icon = tab.Icon;
                const tone = tab.accent === "accent"
                    ? UI_COLORS.accent
                    : UI_COLORS.anomaly;
                const isNar = tab.id === "NARRATIVA";
                const tabBtn = (
                    <CyberTooltip key={tab.id} title={tab.label} placement="bottom">
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onChange(tab.id)}
                            sx={{
                                flex: "0 0 auto",
                                minWidth: overlay ? 64 : 72,
                                height: CHARACTER_SHEET_TOKENS.tabHeight,
                                border: "none",
                                borderBottom: overlay
                                    ? "none"
                                    : active
                                      ? `2px solid ${tone}`
                                      : "2px solid transparent",
                                bgcolor: active && overlay ? `${tone}18` : "transparent",
                                color: active ? tone : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                transition: "color 0.15s, background 0.15s",
                                px: 1.1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.4,
                                "&:hover": { color: UI_COLORS.textPrimary },
                            }}
                        >
                            <Icon sx={{ fontSize: "0.8rem", flexShrink: 0 }} />
                            <CyberText
                                sx={{
                                    fontFamily: "monospace",
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.08em",
                                    color: "inherit",
                                }}
                            >
                                {tab.short}
                            </CyberText>
                        </Box>
                    </CyberTooltip>
                );
                if (!isNar) return tabBtn;
                return (
                    <Box
                        key="nar-facet"
                        sx={{ display: "flex", alignItems: "stretch", ml: 0.25 }}
                    >
                        <Divider
                            orientation="vertical"
                            flexItem
                            sx={{ borderColor: `${UI_COLORS.accentStrong}66`, mx: 0.75 }}
                        />
                        {tabBtn}
                    </Box>
                );
            })}
        </Box>
    );
}
