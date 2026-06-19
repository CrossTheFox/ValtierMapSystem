import { Box } from "@mui/material";

import { UI_COLORS } from "../constants/uiColors";

import CyberTooltip from "./customs/CyberTooltip";



/**

 * Compact icon-only tabs for VTT dialog headers (centered title row, tabs left).

 */

export default function VttDialogHeaderTabs({ tabs = [], value, onChange }) {

    if (!tabs.length) return null;



    return (

        <Box

            className="dialog-no-drag"

            sx={{

                display: "flex",

                alignItems: "center",

                gap: 0.35,

                flexShrink: 0,

                overflowX: "auto",

                overflowY: "hidden",

                "&::-webkit-scrollbar": { display: "none" },

                scrollbarWidth: "none",

            }}

        >

            {tabs.map((tab, index) => {

                const active = value === index;

                return (

                    <CyberTooltip key={tab.label || index} title={tab.label} placement="bottom">

                        <Box

                            component="button"

                            type="button"

                            onClick={() => onChange(null, index)}

                            aria-label={tab.label}

                            aria-current={active ? "page" : undefined}

                            sx={{

                                display: "inline-flex",

                                alignItems: "center",

                                justifyContent: "center",

                                flexShrink: 0,

                                width: 28,

                                height: 28,

                                p: 0,

                                border: `1px solid ${active ? UI_COLORS.accent : UI_COLORS.border}`,

                                borderRadius: 0.75,

                                cursor: "pointer",

                                bgcolor: active ? `${UI_COLORS.accent}14` : "transparent",

                                color: active ? UI_COLORS.accent : UI_COLORS.textSecondary,

                                transition: "color 0.15s, background-color 0.15s, border-color 0.15s, box-shadow 0.15s",

                                boxShadow: active ? `0 0 8px ${UI_COLORS.accentGlow}` : "none",

                                "&:hover": {

                                    color: active ? UI_COLORS.accent : "#ddd",

                                    bgcolor: active ? `${UI_COLORS.accent}18` : "rgba(255,255,255,0.04)",

                                    borderColor: active ? UI_COLORS.accent : `${UI_COLORS.accent}66`,

                                },

                                "& .tab-icon": {

                                    display: "flex",

                                    fontSize: "15px",

                                    lineHeight: 1,

                                    opacity: active ? 1 : 0.8,

                                    filter: active ? `drop-shadow(0 0 4px ${UI_COLORS.accentGlow})` : "none",

                                    "& .MuiSvgIcon-root": { fontSize: "15px" },

                                },

                            }}

                        >

                            {tab.icon ? (

                                <Box className="tab-icon" component="span">{tab.icon}</Box>

                            ) : (

                                <Box

                                    component="span"

                                    sx={{

                                        fontFamily: "'Fira Code', monospace",

                                        fontSize: "8px",

                                        letterSpacing: "0.06em",

                                    }}

                                >

                                    {(tab.label || "?").slice(0, 3)}

                                </Box>

                            )}

                        </Box>

                    </CyberTooltip>

                );

            })}

        </Box>

    );

}

