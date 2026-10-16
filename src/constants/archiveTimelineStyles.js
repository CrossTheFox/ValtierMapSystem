import { keyframes } from "@emotion/react";
import { UI_COLORS } from "./uiColors";
import { TYPO } from "./designSystem";
import { CYBER_SCROLL_STYLE } from "./cyberScrollStyle";
import { ARCHIVE_BORDER, ARCHIVE_TBG_SX } from "./archiveChrome";
import { CODEX_TYPES } from "./wiki/archiveCodex";

const MUTED = UI_COLORS.textSecondary;
const NAR = UI_COLORS.accentStrong;
const CYAN = UI_COLORS.anomaly;
const FIELD_BG = "rgba(8, 8, 14, .55)";
const CARD_BG = "rgba(10, 10, 16, .72)";
const SESSION_C = "#c4b5fd";

/* Mock `solarHud` 2.2s and `solarHalo` 5s. They always run (alto 2: no prefers-reduced-motion). */
const solarHud = keyframes`
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
`;
const solarHalo = keyframes`
    0%, 100% { opacity: 0.72; }
    50% { opacity: 1; }
`;
const paintIn = keyframes`
    from { opacity: 0; transform: translateY(-6px) scale(0.96); }
    to { opacity: 1; transform: none; }
`;
const swatchGlow = keyframes`
    0%, 100% { opacity: 0.45; transform: scale(1); }
    50% { opacity: 0.9; transform: scale(1.08); }
`;

const btnSx = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", p: "7px 12px", borderRadius: "4px",
    border: `1px solid ${UI_COLORS.border}`, color: "#fff", background: FIELD_BG, cursor: "pointer",
    fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap",
    "&:hover:not(:disabled)": { borderColor: NAR, background: `${NAR}18` },
    "&:focus-visible": { outline: `2px solid ${CYAN}`, outlineOffset: "1px" },
    "&:disabled": { opacity: 0.55, cursor: "default" },
    "&.pri": { borderColor: NAR, background: `${NAR}22`, "&:hover:not(:disabled)": { background: `${NAR}38` } },
    "&.danger": { borderColor: `${UI_COLORS.danger}88`, color: "#ff8095", "&:hover:not(:disabled)": { borderColor: UI_COLORS.danger, background: `${UI_COLORS.danger}18` } },
};

const fieldSx = {
    width: "100%", boxSizing: "border-box", color: "#fff", background: FIELD_BG,
    border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px", p: "6px 8px",
    fontFamily: TYPO.body, fontSize: "13.5px", outline: "none",
    "&:focus": { borderColor: NAR, boxShadow: `0 0 0 1px ${NAR}55` },
    "&::placeholder": { color: MUTED },
    "& option": { background: UI_COLORS.backgroundSecondary, color: "#fff" },
};

const headSx = { fontFamily: TYPO.title, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase" };

/**
 * Timeline (`#screen-timeline`): solar graph and calendar from the Archive mock, skinned like the VTT
 * Dossier (NAR) and the Neural Lab. Class names follow `_archive-src/archive.css`.
 */
export const ARCHIVE_TIMELINE_SX = {
    position: "relative",
    flex: 1,
    width: "100%",
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    background: UI_COLORS.backgroundPrimary,
    color: UI_COLORS.textPrimary,
    fontFamily: TYPO.body,
    fontSize: "13.5px",
    lineHeight: 1.5,
    "& p": { m: 0 },
    "& .scroll": CYBER_SCROLL_STYLE,

    "& .tl-host": { position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
    "& .tl-empty-start": {
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 4,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px",
        maxWidth: 420,
        p: "12px 14px",
        borderRadius: "8px",
        border: `1px solid ${UI_COLORS.border}`,
        background: "#0d0d14",
        color: UI_COLORS.textPrimary,
        "& p": { m: 0, flex: "1 1 180px", color: UI_COLORS.textPrimary, fontSize: "13px" },
        "& .btn": btnSx,
    },
    "& .tl-host > .solar-host": { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
    "& .tl-cal-layer": {
        position: "absolute", inset: 0, zIndex: 4, display: "flex", minHeight: 0,
        background: UI_COLORS.backgroundPrimary,
        "& .tl-cal": { flex: 1, minHeight: 0 },
    },
    "& .tl-tools": {
        position: "absolute", top: 10, right: 10, zIndex: 8,
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px",
    },
    "& .tool-slot": { position: "relative" },
    "& .tool-pub": {
        height: 32, display: "inline-flex", alignItems: "center", gap: "8px", p: "0 10px", boxSizing: "border-box",
        color: "#ffffff", background: "rgba(8, 8, 14, .9)", backdropFilter: "blur(10px)",
        border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px", cursor: "help",
        "& .k": { ...headSx, fontSize: "9px", color: MUTED },
        "& .v": { fontFamily: TYPO.mono, fontSize: "12px", color: CYAN },
        "&.is-none .v": { color: MUTED },
    },
    "& .pub-chip": {
        display: "flex", alignItems: "center", gap: "8px", width: "100%", boxSizing: "border-box", mt: "8px",
        minHeight: 30, p: "4px 10px", borderRadius: "6px", textAlign: "left", cursor: "pointer",
        color: "#ffffff", background: "rgba(8, 8, 14, .45)", border: `1px dashed ${UI_COLORS.border}`,
        transition: "border-color .16s ease, box-shadow .16s ease, background .16s ease",
        "& i": {
            width: 10, height: 10, borderRadius: "50%", flex: "none",
            border: `1px solid ${MUTED}`, background: "transparent", transition: "background .16s ease, box-shadow .16s ease",
        },
        "& .k": { ...headSx, fontSize: "9px", color: MUTED, flex: "none" },
        "& .v": { fontFamily: TYPO.body, fontSize: "12.5px", color: "#ffffff", flex: 1, minWidth: 0 },
        "& .hint": { ...headSx, fontSize: "9px", color: MUTED, flex: "none" },
        "&.on": {
            borderStyle: "solid", borderColor: "rgba(0, 242, 234, .55)", background: "rgba(0, 242, 234, .07)",
            "& i": { background: CYAN, borderColor: CYAN, boxShadow: `0 0 10px ${CYAN}` },
            "& .v": { color: CYAN },
        },
        "&:hover, &:focus-visible": { borderColor: "#ffffff", outline: "none", "& .hint": { color: "#ffffff" } },
        "&.is-busy": { opacity: 0.6, pointerEvents: "none" },
    },
    "& .tool-btn": {
        width: 32, height: 32, p: 0, display: "grid", placeItems: "center", cursor: "pointer",
        color: "#ffffff", background: "rgba(8, 8, 14, .9)",
        border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px",
        backdropFilter: "blur(10px)",
        transition: "border-color .16s ease, color .16s ease, box-shadow .16s ease",
        "& svg": { width: 16, height: 16, display: "block" },
        "&:hover, &:focus-visible": { borderColor: "#ffffff", outline: "none" },
        "&[aria-pressed='true']": {
            color: CYAN, borderColor: CYAN, boxShadow: "0 0 12px rgba(0, 242, 234, .4)",
        },
    },
    "& .tool-search": { display: "flex", alignItems: "center", gap: "6px" },
    "& .tool-search .solar-q": { width: 168, mb: 0, p: "6px 8px", fontSize: "13px" },
        "& .tool-kicker": {
        m: "8px 10px 2px", fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".12em",
        textTransform: "uppercase", color: MUTED,
    },
    "& .tool-pop": {
        position: "absolute", top: 38, right: 0, zIndex: 2, minWidth: 220, maxHeight: "50vh", overflow: "auto",
        p: "4px", borderRadius: "6px", color: "#ffffff",
        background: "rgba(10, 10, 16, .96)", border: `1px solid ${UI_COLORS.border}`,
        boxShadow: "0 14px 36px rgba(0, 0, 0, .55)",
        ...CYBER_SCROLL_STYLE,
        "& button": {
            display: "block", width: "100%", textAlign: "left", color: "#ffffff", background: "transparent",
            border: 0, borderRadius: "4px", p: "7px 10px", fontFamily: TYPO.body, fontSize: "13px", cursor: "pointer",
            "&:hover, &:focus-visible": { background: `${UI_COLORS.accent}18`, outline: "none" },
            "&[aria-pressed='true']": { color: CYAN, boxShadow: `inset 2px 0 0 ${CYAN}` },
        },
    },

    /* ── solar ── */
    "& .solar": {
        position: "relative",
        flex: 1,
        height: "100%",
        minHeight: 0,
        background: UI_COLORS.backgroundPrimary,
        "& .hud-pulse": { animation: `${solarHud} 2.2s ease-in-out infinite` },
        "& .halo-pulse": { transformBox: "fill-box", transformOrigin: "center", animation: `${solarHalo} 5s ease-in-out infinite` },
        "&.is-shut .solar-panel": { display: "none" },
    },
    "& .solar-stage": {
        position: "absolute", inset: 0,
        background: UI_COLORS.backgroundPrimary,
        userSelect: "none", WebkitUserSelect: "none",
    },
    "& .solar-stage > svg": {
        width: "100%", height: "100%", display: "block", touchAction: "none",
        background: UI_COLORS.backgroundPrimary, pointerEvents: "none", userSelect: "none",
    },
    "& .solar-camera": {
        position: "absolute", inset: 0, zIndex: 1, width: "100%", height: "100%", display: "block",
        touchAction: "none", cursor: "grab",
    },
    "& .solar-panel": {
        position: "absolute", top: 52, right: 10, bottom: 12, zIndex: 5,
        width: "min(340px, calc(100% - 24px))",
        display: "flex", flexDirection: "column", minHeight: 0,
        borderRadius: "10px", overflow: "hidden",
        background: "rgba(8, 8, 14, .97)", color: "#fff",
        border: `1px solid ${UI_COLORS.border}`,
        boxShadow: "0 18px 48px rgba(0, 0, 0, .55)",
        backdropFilter: "blur(14px)",
    },
    "& .solar-body": { flex: 1, minHeight: 0, overflow: "auto", p: "12px 12px 20px", boxSizing: "border-box", ...CYBER_SCROLL_STYLE },
    "& .solar-q": { ...fieldSx, mb: "14px" },
    "& .solar .bucket": { ...headSx, fontSize: "10px", color: CYAN, mt: "16px" },
    "& .solar .chrono": { position: "relative", p: "8px 0 12px" },
    "& .solar .chrono .rail": {
        position: "absolute", left: "50%", top: 10, bottom: 10, width: 2, transform: "translateX(-50%)",
        background: UI_COLORS.loot, boxShadow: "0 0 10px rgba(245, 197, 66, 0.55)", zIndex: 0,
    },
    "& .solar .stop": {
        position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 28px minmax(0, 1fr)", alignItems: "start", mb: "18px",
        "& > *": { minWidth: 0 },
    },
    "& .solar .mark": {
        pt: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontFamily: TYPO.title, fontSize: "13px", letterSpacing: ".06em", color: "var(--c, #f5c542)", cursor: "pointer",
        borderRadius: "4px", transition: "color .16s ease, text-shadow .16s ease, background .16s ease",
        "&.left": { textAlign: "right", pr: "8px" },
        "&.right": { textAlign: "left", pl: "8px" },
        "&.is-on": { color: "#fff" },
        "&:hover": { color: "#fff", textShadow: "0 0 10px var(--c, #f5c542)" },
    },
    "& .solar .hub": { display: "flex", justifyContent: "center", pt: "1px" },
    "& .solar button.node": {
        position: "relative", width: 28, height: 28, p: 0, cursor: "pointer",
        border: "1px solid transparent", borderRadius: "4px", background: "transparent", color: "#fff",
        transition: "transform .16s ease, border-color .16s ease, box-shadow .16s ease",
        "& .glyph": { width: 26, height: 26, display: "block" },
        "&.is-on": { borderColor: "#fff", boxShadow: "0 0 10px rgba(255,255,255,.35)" },
        "&.is-near": { borderColor: "var(--c, #f5c542)", boxShadow: "0 0 12px var(--c, #f5c542)" },
        "&:hover": {
            borderColor: "var(--c, #f5c542)",
            boxShadow: "0 0 14px color-mix(in srgb, var(--c, #f5c542) 55%, transparent)",
            transform: "scale(1.12)",
        },
    },
    "& .solar .fold": {
        width: 16, height: 16, p: 0, flex: "none", cursor: "pointer", color: "#fff",
        border: `1px solid ${UI_COLORS.border}`, borderRadius: "3px", background: "transparent",
        fontSize: "11px", lineHeight: 1,
        "&:hover": { borderColor: CYAN, color: CYAN },
    },
    "& .solar .par-block": {
        position: "relative", zIndex: 1, display: "grid",
        gridTemplateColumns: "32px minmax(0, 1fr) 32px", alignItems: "start", gap: "4px", mb: "16px",
        "&.is-pair": { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    "& .solar .par-pair": {
        display: "grid", gridTemplateColumns: "minmax(0, 1fr) 12px minmax(0, 1fr)", gap: "4px", alignItems: "start", minWidth: 0,
        "&.is-one": { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    "& .solar .par-card": {
        minWidth: 0, p: "6px 6px 8px", borderRadius: "6px", cursor: "pointer", color: "#fff",
        border: "1px solid color-mix(in srgb, var(--c, #f5c542) 45%, transparent)",
        background: "rgba(255,255,255,.03)",
        transition: "border-color .16s ease, box-shadow .16s ease, background .16s ease, transform .16s ease",
        "&.is-on": { borderColor: "#fff", boxShadow: "0 0 12px rgba(255,255,255,.2)" },
        "&.is-near": { boxShadow: "inset 2px 0 0 var(--c, #f5c542)" },
        "&:hover": {
            borderColor: "var(--c, #f5c542)",
            background: "rgba(255,255,255,.07)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--c, #f5c542) 40%, transparent)",
        },
        "&:has(.leaf:hover, .par-card:hover)": {
            borderColor: "color-mix(in srgb, var(--c, #f5c542) 45%, transparent)",
            background: "rgba(255,255,255,.03)",
            boxShadow: "none",
        },
        "& .nm": { fontSize: "13px" },
        "& .glyph": { width: 22, height: 22, display: "block", transition: "transform .16s ease" },
        "&:hover > .par-top .glyph": { transform: "scale(1.08)" },
    },
    "& .solar .par-top, & .solar .leaf-top": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" },
    "& .solar .twin": {
        display: "flex", flexDirection: "column", justifyContent: "center", gap: "3px", minHeight: 28, pt: "10px",
        "& span": { display: "block", height: "2px", borderRadius: "1px", background: "#00f2ea", boxShadow: "0 0 6px #00f2ea" },
    },
    "& .solar .par-nav": {
        width: 28, height: 28, p: 0, mt: "8px", cursor: "pointer", color: CYAN,
        border: "1px solid rgba(0, 242, 234, .45)", borderRadius: "4px", background: "rgba(0, 242, 234, .06)",
        "& .par-ico": { width: 22, height: 18, display: "block", margin: "0 auto" },
        "&:hover:not(:disabled)": { borderColor: CYAN, boxShadow: "0 0 10px rgba(0, 242, 234, .45)" },
        "&:disabled": { opacity: 0.28, cursor: "default" },
    },
    "& .solar .copy": {
        position: "relative", pt: "1px", minWidth: 0,
        "&.to-right": { pl: "10px", textAlign: "left" },
        "&.to-left": { pr: "10px", textAlign: "right" },
        "&.to-right::before, &.to-left::before": { content: '""', position: "absolute", top: 11, width: 10, height: "1px", background: "var(--c, #f5c542)" },
        "&.to-right::before": { left: 0 },
        "&.to-left::before": { right: 0 },
    },
    "& .solar .head": {
        cursor: "pointer", borderRadius: "4px",
        transition: "background .16s ease, box-shadow .16s ease",
        "&.is-on": { color: "#fff", background: "rgba(255, 255, 255, .04)" },
        "&.is-near": { boxShadow: "inset 2px 0 0 var(--c, #f5c542)" },
        "&:hover": {
            background: "rgba(255,255,255,.07)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--c, #f5c542) 50%, transparent)",
        },
    },
    "& .solar .kicker-row": { display: "flex", alignItems: "center", gap: "6px" },
    "& .solar .copy.to-left .kicker-row": { justifyContent: "flex-end" },
    "& .solar .kicker": { ...headSx, fontSize: "9px", color: "var(--c, #f5c542)" },
    "& .solar .nm": {
        mt: "1px", color: "#fff", fontSize: "14px", overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
        "&.era": { ...headSx, fontSize: "12px", letterSpacing: ".08em" },
    },
    "& .solar .rg": { mt: "2px", fontFamily: TYPO.mono, fontSize: "11px", color: MUTED },
    "& .solar .note": { mt: "4px", color: UI_COLORS.loot, fontSize: "12px", "&.dotted": { opacity: 0.72 } },
    "& .solar .twig": {
        mt: "8px", p: "2px 0 2px 14px", borderLeft: "1px solid var(--c, #f5c542)", display: "flex", flexDirection: "column", gap: "8px",
    },
    "& .solar .copy.to-left .twig": { borderLeft: 0, borderRight: "1px solid var(--c, #f5c542)", p: "2px 14px 2px 0" },
        "& .stop.is-off > .mark, & .stop.is-off > .hub, & .stop.is-off > .copy > .head": {
        opacity: 0.28, pointerEvents: "none",
    },
    "& .leaf.is-off > .leaf-top, & .leaf.is-off > .nm, & .leaf.is-off > .rg": {
        opacity: 0.28, pointerEvents: "none",
    },
    "& .par-card.is-off > .par-top, & .par-card.is-off > .nm, & .par-card.is-off > .rg": {
        opacity: 0.28, pointerEvents: "none",
    },
    "& .solar .leaf": {
        position: "relative", cursor: "pointer", color: "#fff", pl: "4px", borderRadius: "4px",
        transition: "background .16s ease, box-shadow .16s ease",
        "& .glyph": { width: 18, height: 18, display: "block", flex: "none", transition: "transform .16s ease" },
        "&.is-on .nm": { color: "#fff", textShadow: "0 0 8px rgba(255,255,255,.45)" },
        "&.is-near": { boxShadow: "inset 2px 0 0 var(--c, #f5c542)" },
        "&:hover": {
            background: "rgba(255,255,255,.07)",
            boxShadow: "0 0 12px color-mix(in srgb, var(--c, #f5c542) 32%, transparent)",
        },
        "&:hover > .leaf-top .glyph": { transform: "scale(1.1)" },
        "&:has(.leaf:hover)": { background: "transparent", boxShadow: "none" },
        "& .nm": { fontSize: "13px" },
    },
    "& .solar .session": {
        mt: "6px", p: "6px 8px", borderLeft: `2px solid ${SESSION_C}`, borderRadius: "0 4px 4px 0", background: `${SESSION_C}0d`,
        "& .when": { color: "#fff", fontSize: "12px" },
        "& .recap": { mt: "3px", color: MUTED, fontSize: "12px", fontStyle: "italic" },
    },
    "& .solar .copy.to-left .session": { borderLeft: 0, borderRight: `2px solid ${SESSION_C}`, borderRadius: "4px 0 0 4px" },
    "& .solar .par-step": {
        border: "1px dashed rgba(0, 242, 234, .45)", borderRadius: "6px", p: "4px 0 0", mb: "12px",
        "& > .kicker": { textAlign: "center", color: "#00f2ea" },
    },
    "& .solar .twig .par": { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "8px", p: "4px", borderRadius: "4px", background: "rgba(0, 242, 234, .06)" },
    "& .solar .jump": {
        position: "relative", zIndex: 1, m: "2px 0 18px", textAlign: "center",
        fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".16em", color: UI_COLORS.danger,
        "& span": { background: UI_COLORS.backgroundSecondary, p: "0 8px" },
    },
    "& .solar .empty-mini, & .solar-dossier .empty-mini": { mt: "6px", color: MUTED, fontSize: "12px" },

    /* ── dossier, top-left of the map, under the solar bar ── */
    "& .solar-stage .solar-dossier": {
        position: "absolute", zIndex: 8, top: 12, left: 12,
        width: "max-content", minWidth: 280, maxWidth: "min(460px, calc(100% - 250px))", maxHeight: "calc(100% - 24px)",
        userSelect: "text", WebkitUserSelect: "text",
        overflow: "auto", boxSizing: "border-box", p: "10px 12px 12px", borderRadius: "8px",
        "&.is-mini": {
            width: "max-content", maxWidth: "min(440px, calc(100% - 250px))",
            p: "8px 10px", overflow: "visible",
        },
        background: UI_COLORS.backgroundSecondary, color: "#fff",
        border: "1px solid color-mix(in srgb, var(--c, #f5c542) 40%, transparent)",
        boxShadow: "0 18px 48px rgba(0, 0, 0, .6), 0 0 18px color-mix(in srgb, var(--c, #f5c542) 14%, transparent)",
        ...CYBER_SCROLL_STYLE,
        "&[hidden]": { display: "none" },
        "& .bar": { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--c, #f5c542)", borderRadius: "8px 0 0 8px" },
        "& .corner": { position: "absolute", width: 10, height: 10, border: "1px solid var(--c, #f5c542)", pointerEvents: "none" },
        "& .corner.tl": { top: 5, left: 5, borderRight: 0, borderBottom: 0 },
        "& .corner.tr": { top: 5, right: 5, borderLeft: 0, borderBottom: 0 },
        "& .corner.bl": { bottom: 5, left: 5, borderRight: 0, borderTop: 0 },
        "& .corner.br": { bottom: 5, right: 5, borderLeft: 0, borderTop: 0 },
        "& header, & .dossier-top": { display: "flex", alignItems: "center", gap: "8px" },
        "& .dossier-top h2": { flex: 1, minWidth: 0, maxWidth: "none", fontSize: "15px", overflow: "hidden" },
        "& .dossier-top .inline-hit": {
            display: "block", maxWidth: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        },
        "& .meta-row": { display: "flex", alignItems: "flex-start", gap: "10px", mt: "8px", flexWrap: "nowrap" },
        "& .meta-row .meta": { mt: 0, flex: 1, minWidth: 0 },
        "& .date-chip": {
            display: "flex", alignItems: "baseline", gap: "8px", width: "100%", boxSizing: "border-box",
            minHeight: 28, p: "4px 10px", borderRadius: "6px", textAlign: "left", cursor: "pointer",
            color: "#ffffff", background: "rgba(8, 8, 14, .45)", border: `1px solid ${UI_COLORS.border}`,
            "& .k": { ...headSx, fontSize: "9px", color: MUTED, flex: "none" },
            "& .v": { fontFamily: TYPO.mono, fontSize: "13px", color: "#ffffff", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
            "&.is-empty .v": { color: MUTED },
            "&.is-static": { cursor: "default" },
            "&:hover:not(.is-static), &:focus-visible": { borderColor: "#ffffff", outline: "none" },
        },
        "& .date-edit": { display: "flex", flexWrap: "wrap", gap: "8px", width: "100%" },
        "& .date-edit .solar-field": { mt: 0, flex: "1 1 120px" },
        "& .type-slot": { position: "relative", flex: "none" },
        "& .paints": { position: "relative", marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" },
        "& .swatch": {
            display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer",
            p: "3px 8px 3px 4px", borderRadius: "999px", color: "#ffffff", background: "transparent",
            border: `1px solid ${UI_COLORS.border}`,
            fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".1em", textTransform: "uppercase",
            "& i": {
                width: 14, height: 14, borderRadius: "50%", flex: "none",
                background: "var(--c, #f5c542)", boxShadow: "0 0 8px var(--c, #f5c542)",
            },
            "&.aura i": {
                background: "radial-gradient(circle, color-mix(in srgb, var(--c, #ff1493) 80%, transparent) 0%, transparent 72%)",
                boxShadow: "0 0 10px var(--c, #ff1493)",
            },
            "&:hover, &:focus-visible, &.on": { borderColor: "var(--c, #f5c542)", outline: "none" },
            "&.is-static": { cursor: "default" },
        },
        "& .paints .paint-pop": { left: "auto", right: 0, top: 34 },
        "& .sum-block": { mt: "2px" },
        "& .sum-hit": {
            display: "block", width: "100%", textAlign: "left", p: 0, m: 0, border: 0, background: "transparent",
            color: "#ffffff", fontFamily: TYPO.body, fontSize: "13px", lineHeight: 1.45,
            whiteSpace: "pre-wrap", cursor: "text",
        },
        "& .sum-hit.is-empty, & .sum.is-empty": { color: MUTED },
        "& .sum-edit": { minHeight: 72, resize: "vertical" },
        "& .sum-body": { position: "relative" },
        "& .sum-hit.rich, & .sum.rich, & .rich-edit": { whiteSpace: "pre-wrap" },
        "& .rich-edit": {
            minHeight: 72, color: "#ffffff", outline: "none", cursor: "text",
            fontFamily: TYPO.body, fontSize: "13px", lineHeight: 1.45,
        },
        "& .mn": {
            color: "var(--c, #f5c542)", fontWeight: 600,
            background: "color-mix(in srgb, var(--c, #f5c542) 18%, transparent)",
            borderRadius: "3px", padding: "0 3px",
        },
        "& .mention-pop .mn-name": { color: "var(--c, #f5c542)", fontWeight: 600 },
        "& .mention-pop .mn-type": {
            display: "block", marginTop: "1px", color: MUTED,
            fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".08em", textTransform: "uppercase",
        },
        "& .mention-pop": {
            position: "absolute", zIndex: 6, left: 0, right: 0, top: "100%", mt: "4px",
            maxHeight: 180, overflow: "auto", ...CYBER_SCROLL_STYLE,
            background: "rgba(12, 12, 20, .96)", border: `1px solid ${UI_COLORS.border}`,
            borderRadius: "6px", boxShadow: "0 10px 28px rgba(0,0,0,.45)",
            "& button": {
                display: "block", width: "100%", textAlign: "left", p: "7px 10px", m: 0,
                border: 0, background: "transparent", color: "#ffffff", cursor: "pointer",
                fontFamily: TYPO.body, fontSize: "13px",
                "&:hover, &.on": { background: "rgba(245, 197, 66, .14)", color: "#ffffff" },
            },
        },
        "& .ix-list": { display: "flex", flexWrap: "wrap", gap: "6px", mt: "6px" },
        "& .ix-chip": {
            display: "inline-flex", alignItems: "center", gap: "4px",
            p: "2px 6px 2px 8px", borderRadius: "999px", color: "#ffffff",
            border: `1px solid ${UI_COLORS.border}`, fontFamily: TYPO.body, fontSize: "12px",
            "&.is-place": { borderColor: `${CYAN}88` },
            "&.is-inherited": { color: MUTED, borderStyle: "dashed" },
        },
        "& .ix-x": {
            width: 16, height: 16, p: 0, border: 0, borderRadius: "50%", cursor: "pointer",
            color: "#ffffff", background: "transparent", lineHeight: 1,
            "&:hover": { color: "#ff8095" },
        },
        "& .ix-block": { position: "relative" },
        "& .rel-rule.ix-rule": {
            "&::before": { order: 0 },
            "& > span": { order: 1 },
            "&::after": { order: 2 },
            "& .ix-plus": { order: 3, flex: "none", ml: "8px", width: 22, height: 22 },
        },
        "& .ix-plus svg": { width: 14, height: 14, display: "block" },
        "& .ix-block .ix-pick": { left: "auto", right: 0, width: "min(260px, 100%)", top: 28 },
        "& .ix-void": {
            p: "12px 12px 14px",
            "& .k": {
                m: 0, fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".14em",
                textTransform: "uppercase", color: CYAN,
            },
            "& .t": { m: "6px 0 0", color: "#ffffff", fontSize: "13px" },
            "& .d": { m: "4px 0 0", color: MUTED, fontSize: "12px", lineHeight: 1.45 },
        },
        "& .mention-pop .ix-kicker": {
            m: 0, p: "8px 10px 2px", fontFamily: TYPO.title, fontSize: "9px",
            letterSpacing: ".12em", textTransform: "uppercase", color: MUTED,
        },
        "& .ix-add": { position: "relative", display: "flex", gap: "8px", mt: "8px" },
        "& .ix-add-btn": {
            p: "4px 8px", borderRadius: "999px", cursor: "pointer", color: "#ffffff",
            background: "transparent", border: `1px solid ${UI_COLORS.border}`,
            fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase",
            "&:hover": { borderColor: "#ffffff" },
        },
        "& .ident": { display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0, flex: 1 },
        "& .ident h2": { m: 0, flex: "0 1 auto", minWidth: "auto", maxWidth: 200, fontSize: "13px" },
        "& .ident .meta": { mt: 0, flex: "none", whiteSpace: "nowrap" },
        "& .ident .inline-hit": { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 },
        "& .head-tools": { display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" },
        "& .icon-btn": {
            width: 28, height: 28, p: 0, display: "grid", placeItems: "center",
            color: "#ffffff", background: "transparent", border: `1px solid ${UI_COLORS.border}`,
            borderRadius: "4px", cursor: "pointer",
            "&:hover": { borderColor: "#ffffff" },
            "&.danger": {
                color: "#ff8095", borderColor: `${UI_COLORS.danger}88`,
                "&:hover": { borderColor: UI_COLORS.danger, background: `${UI_COLORS.danger}18` },
            },
            "& .ico": { width: 15, height: 15, display: "block" },
        },
        "& .type-face": {
            display: "inline-flex", alignItems: "center", gap: "8px",
            p: "4px 8px 4px 2px", m: 0, border: "1px solid transparent", borderRadius: "6px",
            background: "transparent", color: "var(--c, #f5c542)", cursor: "pointer",
            transition: "background .16s ease, box-shadow .16s ease, border-color .16s ease",
            "& .glyph": { width: 28, height: 22, display: "block", flex: "none", transition: "transform .16s ease" },
            "& .role": { ...headSx, fontSize: "10px", color: "var(--c, #f5c542)" },
            "&:hover, &:focus-visible": {
                background: "rgba(255, 255, 255, .06)",
                borderColor: "color-mix(in srgb, var(--c, #f5c542) 55%, transparent)",
                boxShadow: "0 0 16px color-mix(in srgb, var(--c, #f5c542) 35%, transparent)",
                outline: "none",
                "& .glyph": { transform: "scale(1.08)" },
            },
            "&.is-static": { cursor: "default", "&:hover": { background: "transparent", borderColor: "transparent", boxShadow: "none", "& .glyph": { transform: "none" } } },
        },
        "& .paint": { position: "relative", flex: "none" },
        "& .paint-swatch": {
            position: "relative", width: 28, height: 28, p: 0, borderRadius: "50%", cursor: "pointer",
            border: `1px solid ${UI_COLORS.border}`, background: "transparent",
            transition: "transform .16s ease, box-shadow .16s ease",
            "& .aura": {
                position: "absolute", inset: 1, borderRadius: "50%", background: "var(--aura, #ff1493)",
                animation: `${swatchGlow} 2.4s ease-in-out infinite`,
            },
            "& .ink": {
                position: "absolute", inset: 8, borderRadius: "50%", background: "var(--ink, #f5c542)",
                boxShadow: "0 0 8px var(--ink, #f5c542)",
            },
            "&:hover, &:focus-visible": {
                transform: "scale(1.08)", outline: "none",
                boxShadow: "0 0 14px var(--aura, #ff1493)",
            },
            "&.is-static": { cursor: "default", "&:hover": { transform: "none", boxShadow: "none" } },
        },
        "& .head-tools .paint-pop": { left: "auto", right: 0 },
        "& .paint-pop": {
            position: "absolute", zIndex: 4, top: 36, left: 0, width: 228, p: "10px",
            borderRadius: "8px", color: "#ffffff", background: "#100814",
            border: "1px solid rgba(255, 20, 147, .45)",
            boxShadow: "0 18px 40px rgba(0, 0, 0, .72), 0 0 18px rgba(255, 20, 147, .22)",
            transformOrigin: "top left", animation: `${paintIn} .18s ease`,
        },
        "& .paint-chips": { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", mb: "8px" },
        "& .chip": {
            display: "flex", alignItems: "center", gap: "6px", p: "5px 7px", cursor: "pointer",
            color: "#ffffff", background: "transparent", border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px",
            fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase",
            "& i": {
                width: 14, height: 14, borderRadius: "50%", flex: "none", background: "var(--c, #f5c542)",
                boxShadow: "0 0 8px var(--c, #f5c542)",
            },
            "&:hover, &:focus-visible": { borderColor: "var(--c, #f5c542)", outline: "none" },
            "&.on": { borderColor: "var(--c, #f5c542)", background: "rgba(255, 255, 255, .04)" },
        },
        "& .sv": {
            position: "relative", height: 112, borderRadius: "4px", cursor: "crosshair", touchAction: "none",
            border: `1px solid ${UI_COLORS.border}`,
        },
        "& .hue": {
            position: "relative", height: 14, mt: "8px", borderRadius: "7px", cursor: "pointer", touchAction: "none",
            background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            border: `1px solid ${UI_COLORS.border}`,
        },
        "& .sv .thumb, & .hue .thumb": {
            position: "absolute", width: 12, height: 12, borderRadius: "50%",
            border: "2px solid #fff", boxShadow: "0 0 0 1px #000, 0 0 8px rgba(0,0,0,.6)",
            transform: "translate(-50%, -50%)", pointerEvents: "none",
        },
        "& .sv .thumb": { top: 0, left: 0 },
        "& .hue .thumb": { top: "50%", left: 0 },
        "& .hex": {
            ...fieldSx, width: "100%", mt: "8px", p: "5px 8px", fontFamily: TYPO.mono, fontSize: "12px",
            letterSpacing: ".06em", textTransform: "lowercase",
        },
        "& .paint-row": {
            display: "flex", alignItems: "center", gap: "8px", mt: "8px", color: "#ffffff",
            fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase",
            "& > span:first-of-type": { flex: "none", width: 42 },
        },
        "& .slide": {
            position: "relative", flex: 1, height: 18, cursor: "pointer", touchAction: "none",
        },
        "& .slide-track": {
            position: "absolute", left: 0, right: 0, top: 7, height: 4, borderRadius: "2px",
            background: "rgba(255,255,255,.12)", overflow: "hidden",
        },
        "& .slide-fill": {
            display: "block", height: "100%", width: "40%", borderRadius: "2px",
            background: "linear-gradient(to right, rgba(0, 242, 234, .25), #00f2ea)",
            boxShadow: "0 0 8px rgba(0, 242, 234, .65)",
        },
        "& .slide-knob": {
            position: "absolute", top: 2, left: "40%", width: 14, height: 14, borderRadius: "50%",
            transform: "translateX(-50%)", background: "#041416", border: "2px solid #00f2ea",
            boxShadow: "0 0 10px rgba(0, 242, 234, .8)", pointerEvents: "none",
        },
        "& .paint-n": { width: "auto", fontFamily: TYPO.mono, fontSize: "11px", letterSpacing: 0, textTransform: "none", color: MUTED },
        "& .type-menu": {
            position: "absolute", zIndex: 3, top: "calc(100% + 4px)", left: 0, minWidth: 180, p: "4px", borderRadius: "6px",
            background: UI_COLORS.backgroundSecondary, color: "#ffffff", border: `1px solid ${UI_COLORS.border}`,
            boxShadow: "0 12px 32px rgba(0, 0, 0, .55)",
            "& button": {
                display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", color: "#ffffff", background: "transparent",
                border: 0, borderRadius: "4px", p: "6px 8px", fontFamily: TYPO.body, fontSize: "13.5px", cursor: "pointer",
                "& .glyph": { width: 22, height: 22, display: "block", flex: "none" },
                "&:hover, &:focus-visible": { background: `${UI_COLORS.accent}14`, outline: "none" },
                "&.on": { background: `${UI_COLORS.accent}22`, boxShadow: `inset 2px 0 0 ${UI_COLORS.accent}` },
            },
        },
        "& .role": { ...headSx, fontSize: "10px", color: "var(--c, #f5c542)" },
        "& h2": { ...headSx, fontSize: "13px", letterSpacing: ".06em", m: 0, color: "#ffffff" },
        "& h2 .inline-hit, & .meta .inline-hit": {
            display: "block", width: "100%", textAlign: "left", p: 0, m: 0, border: 0, background: "transparent",
            color: "inherit", font: "inherit", letterSpacing: "inherit", textTransform: "inherit", cursor: "text",
        },
        "& .meta": { mt: "6px", fontFamily: TYPO.mono, fontSize: "12px", color: MUTED },
        "& .inline": fieldSx,
        "& .from": {
            display: "inline-block", mt: "8px", p: 0, border: 0, background: "transparent",
            color: CYAN, fontFamily: TYPO.body, fontSize: "12px", cursor: "pointer",
            "&:hover": { color: "#ffffff" },
        },
        "& .sum": { mt: "10px", fontSize: "14px", color: "#ffffff" },
        "& h3": { ...headSx, fontSize: "10px", color: CYAN, m: "14px 0 0" },
        "& .rel-board": { mt: "14px" },
        "& .rel-cols": {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "0 8px", alignItems: "stretch",
        },
        "& .rel-col + .rel-col": { borderLeft: `1px solid ${UI_COLORS.border}`, pl: "8px" },
        "& .rel-h": {
            display: "flex", alignItems: "center", gap: "6px", m: "0 0 6px",
            "& .sep-ico": { width: 16, height: 16, display: "block", flex: "none" },
        },
        "& .rel-sep": {
            position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center", pt: "2px",
            "&::before": {
                content: '""', position: "absolute", top: 22, bottom: 0, left: "50%", width: "1px",
                background: UI_COLORS.border, transform: "translateX(-50%)",
            },
            "& .sep-ico": { position: "relative", zIndex: 1, width: 18, height: 18, display: "block", background: UI_COLORS.backgroundSecondary },
        },
        "& .rel-col h3": { m: "0 0 6px" },
        "& .rel-card": { display: "flex", gap: "6px", alignItems: "flex-start", mt: "6px", minWidth: 0 },
        "& .glyph-slot": { display: "grid", placeItems: "center", cursor: "pointer" },
        "& .glyph-slot .glyph, & .rel-ico .glyph": { width: 22, height: 22, display: "block" },
        "& .rel-ico": {
            width: 28, height: 28, p: 0, flex: "none", display: "grid", placeItems: "center",
            color: "#ffffff", background: "transparent", border: `1px solid ${UI_COLORS.border}`,
            borderRadius: "4px", cursor: "pointer",
            "& .trash-slot": { display: "none" },
            "& .ico": { width: 14, height: 14, display: "block" },
            "&:hover, &:focus-visible": {
                borderColor: UI_COLORS.danger, color: "#ff8095", outline: "none",
                "& .glyph-slot": { display: "none" },
                "& .trash-slot": { display: "grid" },
            },
        },
        "& .rel-go": {
            flex: 1, minWidth: 0, p: 0, border: 0, background: "transparent", color: "#ffffff",
            textAlign: "left", cursor: "pointer", fontFamily: TYPO.body,
            "& .nm": { display: "block", fontSize: "13px", color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
            "& .when": { display: "block", mt: "1px", fontFamily: TYPO.mono, fontSize: "11px", color: MUTED },
            "&:hover .nm": { color: CYAN },
        },
        "& .rel-rule": {
            display: "flex", alignItems: "center", gap: "8px", m: "14px 0 8px",
            ...headSx, fontSize: "10px", color: MUTED,
            "&::before, &::after": { content: '""', flex: 1, height: "1px", background: UI_COLORS.border },
        },
        "& .rel-group": { display: "flex", flexWrap: "wrap", gap: "4px 8px" },
        "& .rel-group .rel-card": { width: "calc(50% - 8px)", mt: 0 },
        "& button.x, & button.act": btnSx,
        "& .acts": { display: "flex", flexWrap: "wrap", gap: "6px", mt: "12px" },
        "& button.hop": {
            display: "block", width: "100%", textAlign: "left", fontFamily: TYPO.body, fontSize: "14px", color: "#fff",
            background: "transparent", border: 0, borderLeft: "2px solid var(--c, #fff)", borderRadius: "0 4px 4px 0",
            p: "5px 8px", mt: "4px", cursor: "pointer",
            "&:hover": { background: "rgba(255, 255, 255, .05)" },
        },
        "& .session": {
            mt: "8px", p: "8px", borderLeft: `2px solid ${SESSION_C}`, borderRadius: "0 4px 4px 0", background: `${SESSION_C}0d`,
            "& .when": { color: "#fff", fontSize: "13px" },
            "& .rg": { mt: "2px", fontFamily: TYPO.mono, fontSize: "12px", color: SESSION_C },
            "& .recap": { mt: "4px", color: MUTED, fontSize: "13px" },
        },
        "& .solar-field": { display: "flex", flexDirection: "column", gap: "4px", mt: "10px", fontSize: "13px" },
        "& .solar-field[hidden]": { display: "none" },
        "& .fl-t": { ...headSx, fontSize: "9px", color: MUTED },
        "& .input": fieldSx,
        "& textarea.input": { minHeight: 68, resize: "vertical" },
        "& .solar-checks": { display: "flex", flexDirection: "column", gap: "2px" },
        "& .solar-check": {
            display: "flex", gap: "8px", alignItems: "center", fontSize: "13px", mt: "2px", cursor: "pointer",
            "& input": { width: "auto", accentColor: NAR },
        },
    },

    /* ── context menu ── */
    "& .solar-menu": {
        position: "fixed", zIndex: 70, minWidth: 200, maxHeight: "70vh", overflow: "auto", p: "6px", borderRadius: "6px",
        background: UI_COLORS.backgroundSecondary, color: "#fff", border: `1px solid ${UI_COLORS.border}`,
        boxShadow: "0 16px 40px rgba(0, 0, 0, .55)",
        ...CYBER_SCROLL_STYLE,
        "&[hidden]": { display: "none" },
        "& button": {
            display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", color: "#fff", background: "transparent", border: 0, borderRadius: "4px",
            p: "7px 10px", fontFamily: TYPO.body, fontSize: "13.5px", cursor: "pointer",
            "&:hover, &:focus-visible": { background: `${UI_COLORS.accent}14`, outline: "none" },
            "&.on": { background: `${UI_COLORS.accent}22`, boxShadow: `inset 2px 0 0 ${UI_COLORS.accent}` },
            "&:disabled": { opacity: 0.35, cursor: "default", "&:hover": { background: "transparent" } },
            "&.danger": {
                color: "#ffb3c0",
                "& .ico": { width: 15, height: 15, display: "block", flex: "none" },
                "&:hover, &:focus-visible": { background: `${UI_COLORS.danger}28`, color: "#ffe4ea" },
            },
        },
        "& .sep": { height: "1px", m: "4px 8px", background: UI_COLORS.border },
    },
    "& .solar-wire": {
        position: "fixed", zIndex: 80, display: "flex", gap: "6px",
        "&[hidden]": { display: "none" },
        "& button": {
            color: "#fff", background: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.border}`,
            borderRadius: "4px", p: "6px 10px", fontFamily: TYPO.body, fontSize: "13px", cursor: "pointer",
            "&.on": { borderColor: NAR, boxShadow: `0 0 10px ${NAR}55` },
            "&:disabled": { opacity: 0.35, cursor: "default" },
        },
    },

    /* ── calendar ── */
    "& .tl-cal": { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
    "& .tl-bar": {
        flex: "none", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", p: "8px 16px",
        borderBottom: `1px solid ${ARCHIVE_BORDER}`,
        "& .tbg": ARCHIVE_TBG_SX,
        "& .btn": btnSx,
        "& .mono": { fontFamily: TYPO.mono, fontSize: "13px", color: "#fff", minWidth: 120, textAlign: "center" },
        "& .help": { fontSize: "12px", color: MUTED, maxWidth: 520 },
    },
    "& .cal-scroll": { flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE },
    "& .hint-line": { color: MUTED, fontSize: "12px", m: "8px 16px 0" },
    "& .empty-note": { color: MUTED, fontSize: "13px", m: "10px 16px 0" },
    "& .cal-grid": { display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "4px", p: "8px 12px 16px" },
    "& .cal-day": {
        position: "relative", minHeight: 78, textAlign: "left", p: "4px", boxSizing: "border-box", cursor: "pointer",
        border: `1px solid ${UI_COLORS.border}`, background: CARD_BG, color: "#fff", borderRadius: "6px",
        "&:hover": { borderColor: `${NAR}88` },
        "&:focus-visible": { outline: `2px solid ${CYAN}`, outlineOffset: "1px" },
        "&.ro": { cursor: "default", "&:hover": { borderColor: UI_COLORS.border } },
        "& .n": { fontFamily: TYPO.mono, fontSize: "12px", color: "#fff", display: "block" },
        "& .tl-card": {
            position: "relative", display: "block", width: "100%", boxSizing: "border-box", mt: "4px", p: "3px 6px", textAlign: "left",
            background: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.border}`, borderLeft: `2px solid ${UI_COLORS.loot}`,
            borderRadius: "4px", color: "#fff", cursor: "pointer", fontFamily: TYPO.body,
            "&:hover": { borderColor: "rgba(255, 255, 255, .45)", borderLeftColor: UI_COLORS.loot },
            "& .t": { display: "block", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
            "&.rng-r": { width: "calc(100% + 8px)", mr: "-8px", zIndex: 1, borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0 },
            "&.rng-l": { borderLeftWidth: "1px", borderLeftColor: UI_COLORS.border, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, "& .t": { color: "transparent" } },
        },
        "& .tl-mark": {
            display: "inline-flex", alignItems: "center", mt: "4px", mr: "4px", p: "0 6px", cursor: "pointer",
            fontFamily: TYPO.mono, fontSize: "11px", color: "#fff", background: "transparent",
            border: `1px dashed ${UI_COLORS.loot}`, borderRadius: "10px",
            "&:hover": { background: `${UI_COLORS.loot}18` },
            "&:focus-visible": { outline: `2px solid ${CYAN}`, outlineOffset: "1px" },
        },
    },
    "& .cal-day.era": { background: `color-mix(in srgb, ${CODEX_TYPES.era.color} 16%, ${CARD_BG})` },

    /* ── confirm + toast ── */
    "& .confirm-back": { position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(0, 0, 0, .6)", backdropFilter: "blur(2px)" },
    "& .confirm": {
        width: "min(420px, calc(100% - 32px))", p: "16px 18px", borderRadius: "8px", boxSizing: "border-box",
        background: UI_COLORS.backgroundSecondary, border: `1px solid ${NAR}66`, color: "#fff",
        boxShadow: `0 0 30px rgba(0, 0, 0, .6), 0 0 18px ${NAR}22`,
        "& .confirm-h": { ...headSx, fontSize: "10px", color: UI_COLORS.danger, mb: "10px" },
        "& p": { mb: "14px" },
        "& .acts": { display: "flex", justifyContent: "flex-end", gap: "8px" },
        "& .btn": btnSx,
    },
    "& .toast": {
        position: "fixed", left: "50%", bottom: 22, transform: "translate(-50%, 20px)", zIndex: 90, opacity: 0, pointerEvents: "none",
        background: UI_COLORS.backgroundSecondary, border: `1px solid ${CYAN}`, color: "#fff", p: "8px 14px", borderRadius: "5px", fontSize: "12.5px",
        transition: "opacity .2s, transform .2s", boxShadow: "0 10px 28px rgba(0, 0, 0, .55)",
        "&.on": { opacity: 1, transform: "translate(-50%, 0)" },
    },

    /* The mock has no narrow layout; below 900px the graph list goes under the stage. */
    "@media (max-width: 900px)": {
        "& .solar, & .solar.is-shut": { gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "auto minmax(0, 1fr) minmax(0, 38%)" },
        "& .solar-panel": { borderLeft: "none", borderTop: `1px solid ${ARCHIVE_BORDER}` },
        "& .solar-fold": { display: "none" },
        "& .solar.is-shut .solar-body": { display: "block" },
        "& .cal-grid": { gap: "2px", p: "6px" },
        "& .cal-day": { minHeight: 56, p: "2px" },
        "& .cal-day .n": { fontSize: "10px" },
    },
};
