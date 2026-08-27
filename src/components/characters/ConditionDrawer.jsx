import { forwardRef } from "react";
import { Box, ClickAwayListener, Popper } from "@mui/material";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    COND_GROUPS,
    CHARACTER_CONDITIONS,
} from "../../constants/characterConditions";

const PANEL_SX = {
    width: 300,
    maxHeight: 360,
    overflow: "auto",
    bgcolor: "rgba(8,8,14,0.98)",
    border: "1px solid rgba(167,139,250,0.4)",
    boxShadow: "-14px 8px 40px rgba(0,0,0,0.6)",
    p: "10px",
    ...CYBER_SCROLL_STYLE,
};

/** Above combat HUD (1200) and initiative (1300); below wiki overlay (1500). */
const HUD_DRAWER_Z = 1400;

function DrawerPanel({ activeKeys, onToggle, onClose, sx }) {
    const keys = Array.isArray(activeKeys) ? activeKeys : [];
    return (
        <Box
            data-cond-drawer
            role="dialog"
            aria-label="Conditions drawer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{ ...PANEL_SX, ...sx }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", mb: 1 }}>
                <Box component="h4" sx={{ m: 0, fontFamily: "Orbitron, sans-serif", fontSize: "0.62rem", letterSpacing: "0.12em", color: "#c4b5fd" }}>
                    CONDITIONS · {keys.length}
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    sx={{
                        bgcolor: "transparent", border: "1px solid rgba(255,255,255,0.2)",
                        color: "#fff", width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                    }}
                >
                    ✕
                </Box>
            </Box>
            {COND_GROUPS.map((g) => {
                const rows = CHARACTER_CONDITIONS.filter((d) => d.group === g.id);
                const n = rows.filter((d) => keys.includes(d.key)).length;
                return (
                    <Box key={g.id} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "5px", py: "2px" }}>
                            <Box component="span" sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.46rem", letterSpacing: "0.12em", color: g.accent }}>
                                {g.label}
                            </Box>
                            <Box component="span" sx={{ fontFamily: "'Fira Code', monospace", fontSize: "0.62rem", opacity: 0.55, color: "#fff" }}>
                                {n}
                            </Box>
                        </Box>
                        {rows.map((d) => {
                            const on = keys.includes(d.key);
                            return (
                                <Box
                                    key={d.code}
                                    component="button"
                                    type="button"
                                    onClick={() => onToggle(d.key)}
                                    title={[d.effect, d.hook ? `hook: ${d.hook}` : ""].filter(Boolean).join(" · ")}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "10px 1fr auto",
                                        gap: "8px",
                                        alignItems: "center",
                                        width: "100%",
                                        textAlign: "left",
                                        p: "7px 8px",
                                        mb: "4px",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        bgcolor: "transparent",
                                        color: "rgba(255,255,255,0.38)",
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.68rem",
                                        cursor: "pointer",
                                        ...(on ? {
                                            color: "#fff",
                                            borderColor: `${g.accent}59`,
                                            bgcolor: `${g.accent}14`,
                                        } : {}),
                                    }}
                                >
                                    <Box
                                        component="i"
                                        sx={{
                                            display: "block",
                                            width: 8, height: 8,
                                            border: `1.5px solid ${on ? g.accent : "currentColor"}`,
                                            bgcolor: on ? g.accent : "transparent",
                                            boxShadow: on ? `0 0 6px ${g.accent}` : "none",
                                        }}
                                    />
                                    <Box component="span">{d.title}</Box>
                                    <Box component="span" sx={{ opacity: 0.5, fontSize: "0.58rem" }}>{d.code}</Box>
                                </Box>
                            );
                        })}
                    </Box>
                );
            })}
        </Box>
    );
}

/**
 * Grouped conditions panel.
 * @param {"below"|"above"} [placement] — inline fallback when not portaled.
 * @param {Element|null} [anchorEl] — if set, portals via Popper (escapes HUD clipPath).
 */
export function ConditionDrawer({
    activeKeys,
    onToggle,
    onClose,
    placement = "below",
    anchorEl = null,
    open = true,
}) {
    const panel = (
        <DrawerPanel activeKeys={activeKeys} onToggle={onToggle} onClose={onClose} />
    );

    if (anchorEl != null) {
        const above = placement === "above";
        return (
            <Popper
                open={Boolean(open)}
                anchorEl={anchorEl}
                placement={above ? "top-end" : "bottom-end"}
                modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
                popperOptions={{ strategy: "fixed" }}
                sx={{ zIndex: HUD_DRAWER_Z }}
            >
                <ClickAwayListener
                    onClickAway={(event) => {
                        if (anchorEl?.contains?.(event.target)) return;
                        onClose?.(event);
                    }}
                >
                    <Box>{panel}</Box>
                </ClickAwayListener>
            </Popper>
        );
    }

    if (!open) return null;

    return (
        <DrawerPanel
            activeKeys={activeKeys}
            onToggle={onToggle}
            onClose={onClose}
            sx={{
                position: "absolute",
                zIndex: 60,
                right: 0,
                ...(placement === "above"
                    ? { bottom: "calc(100% + 6px)" }
                    : { top: "calc(100% + 6px)" }),
            }}
        />
    );
}

/** Skewed Conditions tag — mockup seam `.cond-btn`. Opens the grouped drawer. */
export const ConditionsTagBtn = forwardRef(function ConditionsTagBtn({
    condNeg = false,
    condPos = false,
    activeCount = 0,
    open = false,
    onClick,
}, ref) {
    return (
        <Box
            ref={ref}
            component="button"
            type="button"
            data-cond-btn
            onClick={onClick}
            title="Conditions"
            aria-label="Conditions drawer"
            aria-pressed={open}
            sx={{
                position: "relative",
                flexShrink: 0,
                width: 28,
                height: 22,
                transform: "skewX(-12deg)",
                border: `2px solid ${condNeg ? "rgba(255,102,128,0.7)" : condPos ? "rgba(93,255,154,0.6)" : "rgba(233,224,255,0.5)"}`,
                background: condNeg
                    ? "linear-gradient(180deg, rgba(255,102,128,0.4), rgba(14,10,28,0.98))"
                    : condPos
                        ? "linear-gradient(180deg, rgba(93,255,154,0.4), rgba(14,10,28,0.98))"
                        : "linear-gradient(180deg, rgba(233,224,255,0.28), rgba(14,10,28,0.98))",
                color: condNeg ? "#ff6680" : condPos ? "#5dff9a" : "#e9e0ff",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                filter: open ? "brightness(1.15)" : undefined,
                "&:hover": { filter: "brightness(1.15)" },
            }}
        >
            <Box
                component="svg"
                viewBox="0 0 16 16"
                sx={{ width: 13, height: 13, transform: "skewX(12deg)" }}
            >
                <path
                    fill="currentColor"
                    d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.2a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm-.6 2.4h1.2v3.6H7.4V5.1Zm0 4.8h1.2v1.2H7.4V9.9Z"
                />
            </Box>
            {activeCount > 0 && (
                <Box
                    component="span"
                    sx={{
                        position: "absolute", top: -6, right: -7,
                        transform: "skewX(12deg)",
                        minWidth: 14, height: 14, px: "3px",
                        borderRadius: "7px",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Orbitron, sans-serif", fontSize: "0.4rem",
                        bgcolor: condNeg ? "#ff3355" : condPos ? "#5dff9a" : "#a78bfa",
                        color: condNeg ? "#fff" : "#0a0a12",
                        border: "1px solid rgba(0,0,0,0.85)",
                    }}
                >
                    {activeCount}
                </Box>
            )}
        </Box>
    );
});

export default ConditionDrawer;
