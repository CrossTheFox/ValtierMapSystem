import { UI_COLORS } from "./uiColors";
import { TYPO } from "./designSystem";
import { CYBER_SCROLL_STYLE } from "./cyberScrollStyle";
import { ARCHIVE_BORDER, ARCHIVE_FLASH_SX, ARCHIVE_ID_GLITCH_SX } from "./archiveChrome";

const EASE = "cubic-bezier(.22, .61, .36, 1)";
const MUTED = UI_COLORS.textSecondary;
const NAR = UI_COLORS.accentStrong;
const FIELD_BG = "rgba(8, 8, 14, .55)";
const CARD_BG = "rgba(10, 10, 16, .72)";

/**
 * Codex layout and motion from the Archive mock (`.codex`, `.cx-*`, `.art-*`, `.ent-ed`, `.confirm`, `.toast`),
 * skinned like the VTT Dossier (NAR) and the Neural Lab: Orbitron heads, bordered cards, pill chips, dark fields.
 */
export const ARCHIVE_CODEX_SX = {
    "--cx-index": "300px",
    "--cx-dossier": "320px",
    display: "grid",
    gridTemplateColumns: "var(--cx-index) minmax(0, 1fr) var(--cx-dossier)",
    transition: `grid-template-columns 200ms ${EASE}`,
    position: "relative",
    flex: 1,
    width: "100%",
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    color: UI_COLORS.textPrimary,
    fontFamily: TYPO.body,
    fontSize: "13.5px",
    lineHeight: 1.5,
    background: UI_COLORS.backgroundSecondary,
    "&.is-shut": { "--cx-index": "40px" },
    /* `.cx-host` wraps host components (MUI, Dossier); the codex resets must not reach them. */
    "& button:where(:not(.cx-host button))": { font: "inherit", color: "inherit", background: "none", border: "none", textAlign: "inherit", cursor: "pointer", p: 0 },
    "& :where(input, select, textarea):where(:not(.cx-host *))": { font: "inherit" },
    "& .cx-host": { fontSize: "initial", lineHeight: "normal" },
    "& .rail-host": { display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 },
    "& mark": { background: `${NAR}44`, color: "#fff", borderRadius: "2px" },
    "& .scroll": CYBER_SCROLL_STYLE,
    "& .grow": { flex: 1, minWidth: 0 },
    "& .muted": { color: MUTED },
    "& .mono": { fontFamily: TYPO.mono },
    "& .svg": { display: "inline-grid" },
    "& .svg svg": { width: 15, height: 15, stroke: "currentColor", fill: "none", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" },

    "& .icon-btn": {
        width: 28, height: 28, borderRadius: "4px", color: MUTED, display: "inline-grid", placeItems: "center",
        border: `1px solid ${UI_COLORS.border}`, background: FIELD_BG,
        "&:hover": { color: UI_COLORS.textPrimary, borderColor: `${NAR}88` },
        "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
        "&.plus": { color: NAR, "&:hover": { background: `${NAR}18`, borderColor: NAR } },
    },
    "& .pencil[aria-pressed='true']": { color: UI_COLORS.textPrimary, borderColor: NAR, background: `${NAR}22` },
    "& .help-dot": {
        display: "inline-grid", placeItems: "center", width: 15, height: 15, borderRadius: "50%", ml: "6px",
        border: `1px solid ${UI_COLORS.border}`, color: MUTED, fontSize: "9.5px", fontFamily: TYPO.mono,
        cursor: "help", verticalAlign: "middle", lineHeight: 1, letterSpacing: 0,
        "&:hover, &:focus": { color: "#fff", borderColor: UI_COLORS.anomaly, outline: "none" },
    },
    "& .link": {
        color: UI_COLORS.anomaly, fontSize: "12px", whiteSpace: "nowrap",
        "&:hover": { textDecoration: "underline" },
    },
    "& .empty-note": { color: MUTED, fontSize: "12.5px", py: "8px" },
    "& .cx-void": {
        width: "min(440px, 100%)", boxSizing: "border-box", m: "28px auto", p: "26px 22px",
        textAlign: "center", borderRadius: "8px", background: CARD_BG,
        border: `1px solid color-mix(in srgb, ${NAR} 45%, ${UI_COLORS.border})`,
        boxShadow: `0 0 28px ${NAR}14`,
        "& .kicker": { display: "block", color: NAR, mb: "8px" },
        "& h2": {
            m: "0 0 8px", fontFamily: TYPO.title, fontSize: "16px", fontWeight: 600,
            letterSpacing: ".08em", textTransform: "uppercase", color: "#ffffff",
        },
        "& .lead": { m: "0 0 16px", color: "#dddddd", fontSize: "14px", lineHeight: 1.6 },
        "& .btn": { mt: "2px" },
        "&.is-slim": { m: "16px 8px", p: "16px 14px", boxShadow: "none" },
        "&.is-slim .lead": { m: 0 },
    },
    "&.is-empty": {
        display: "grid", gridTemplateColumns: "minmax(0, 1fr)",
        "& .cx-index, & .cx-rail": { display: "none" },
        "& .cx-article": { display: "grid", placeItems: "center", overflow: "auto" },
        "& .art-inner": { width: "min(440px, calc(100% - 48px))", maxWidth: "none", m: 0, p: 0 },
        "& .cx-void": { m: 0 },
    },
    "& .hint-line": { color: MUTED, fontSize: "12px", m: "0 0 8px" },
    "& .notice": {
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", m: "14px 0 0", p: "8px 12px",
        border: `1px solid ${UI_COLORS.loot}33`, borderLeft: `3px solid ${UI_COLORS.loot}`, borderRadius: "4px",
        background: `${UI_COLORS.loot}0a`, color: "#eee", fontSize: "12.5px",
    },
    "& .sec-h": {
        display: "flex", alignItems: "center", gap: "8px", m: "26px 0 10px",
        fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".14em", color: UI_COLORS.anomaly, textTransform: "uppercase",
        "& .n": { fontFamily: TYPO.body, fontSize: "11px", letterSpacing: 0, color: MUTED, textTransform: "none" },
        "&::after": { content: '""', flex: 1, height: "1px", background: `linear-gradient(90deg, ${UI_COLORS.anomaly}55, transparent)` },
    },
    "& .kicker": { fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".16em", textTransform: "uppercase" },
    "& .input, & .select": {
        width: "100%", background: FIELD_BG, border: `1px solid ${UI_COLORS.border}`, borderRadius: "4px",
        color: "#fff", p: "8px 11px", outline: "none", colorScheme: "dark", boxSizing: "border-box",
        "&::placeholder": { color: "#888" },
        "&:hover": { borderColor: `${NAR}66` },
        "&:focus": { borderColor: NAR },
    },
    "& .select": { fontFamily: TYPO.mono, fontSize: "12px" },
    "& .select option": { background: UI_COLORS.backgroundSecondary, color: "#fff" },
    "& .input.search": {
        pl: "32px",
        background: `${FIELD_BG} no-repeat 11px 50% / 13px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='5' fill='none' stroke='%23aaa' stroke-width='1.6'/%3E%3Cpath d='M11 11l4 4' stroke='%23aaa' stroke-width='1.6'/%3E%3C/svg%3E")`,
    },
    "& .ticon": {
        width: 36, height: 36, flex: "none", display: "inline-grid", placeItems: "center", borderRadius: "6px",
        background: FIELD_BG, border: "1px solid color-mix(in srgb, var(--c) 55%, transparent)",
        color: "var(--c)", fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".06em",
        "&.sm": { width: 24, height: 24, fontSize: "7px", borderRadius: "4px" },
        "&.xl": { width: 72, height: 72, fontSize: "15px", borderRadius: "8px", boxShadow: "0 0 18px color-mix(in srgb, var(--c) 25%, transparent)" },
    },
    "& .avatar": {
        width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flex: "none",
        border: `1px solid ${UI_COLORS.border}`, background: "#14141c",
        display: "inline-grid", placeItems: "center", fontFamily: TYPO.title, fontSize: "10px", color: UI_COLORS.accent,
        "&.sm": { width: 24, height: 24, fontSize: "8px" },
        "&.xl": { width: 72, height: 72, borderColor: UI_COLORS.accent, fontSize: "18px", boxShadow: `0 0 18px ${UI_COLORS.accentGlow}` },
    },
    "& .tag": {
        display: "inline-flex", alignItems: "center", p: "1px 5px", borderRadius: "3px", lineHeight: 1.3,
        fontFamily: TYPO.title, fontSize: "7.5px", letterSpacing: ".12em", border: "1px solid currentColor", background: "rgba(8, 8, 14, .85)",
        "&.pj": { color: UI_COLORS.accent },
        "&.npc": { color: "#cccccc" },
        "&.tok": { color: UI_COLORS.anomaly },
        "&.vtt": { color: UI_COLORS.anomaly },
        "&.pin": { color: "#ffaa00" },
        "&.dm": { color: UI_COLORS.danger },
    },
    "& .chips": { display: "flex", flexWrap: "wrap", gap: "4px" },
    "& .chip": {
        border: `1px solid ${UI_COLORS.border}`, color: MUTED, borderRadius: "4px", p: "3px 8px",
        fontFamily: TYPO.title, fontSize: "8px", letterSpacing: ".1em", textTransform: "uppercase", lineHeight: 1.4,
        "&:hover": { borderColor: "var(--c, #ff66ff)", color: "var(--c, #ff66ff)" },
        "&[aria-pressed='true']": {
            borderColor: "var(--c, #ff66ff)", color: "var(--c, #ff66ff)",
            background: "color-mix(in srgb, var(--c, #ff66ff) 14%, transparent)",
        },
        "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
        "&.ico": {
            width: 28, height: 28, p: 0, display: "inline-grid", placeItems: "center",
            "& .svg svg": { width: 14, height: 14 },
        },
    },
    "& .mn": {
        color: "#fff", textDecoration: "none", cursor: "pointer", fontWeight: 500,
        borderBottom: "1px solid color-mix(in srgb, var(--c, #aaa) 70%, transparent)",
        background: "color-mix(in srgb, var(--c, #aaa) 10%, transparent)", p: "0 2px", borderRadius: "2px",
        "&:hover": { background: "color-mix(in srgb, var(--c, #aaa) 24%, transparent)" },
        "&.br": { borderBottom: `1px dashed ${UI_COLORS.danger}`, background: "none", color: "#ffb0bc", cursor: "help" },
        "&.id-glitch": { textDecoration: "none", borderBottomColor: "transparent", background: "transparent" },
    },
    "& .flash": ARCHIVE_FLASH_SX,
    "& .id-glitch": {
        ...ARCHIVE_ID_GLITCH_SX,
        /* Titles and summaries wrap: the glitch layers must wrap with the hidden text, not run past it. */
        "&[data-label]::before, &[data-label]::after": {
            ...ARCHIVE_ID_GLITCH_SX["&[data-label]::before, &[data-label]::after"],
            whiteSpace: "normal",
            right: 0,
        },
    },
    "& .veil-img img": { filter: "blur(8px)", transform: "scale(1.06)" },

    /* index */
    "& .cx-index": {
        minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column",
        borderRight: `1px solid ${UI_COLORS.border}`, background: UI_COLORS.backgroundPrimary,
    },
    "& .rail-tab": {
        width: "100%", height: 72, display: "grid", placeItems: "center", color: MUTED,
        "&:hover": { color: UI_COLORS.textPrimary },
    },
    "& .idx-tools": { display: "flex", alignItems: "center", gap: "6px", p: "10px 12px 0" },
    "& .idx-title": { fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".14em", color: NAR, textTransform: "uppercase" },
    "& .cx-search": { p: "10px 12px 10px", display: "flex", flexDirection: "column", gap: "8px", borderBottom: `1px solid ${UI_COLORS.border}` },
    "& .cx-items": { flex: 1, overflow: "auto", p: "0 8px 16px" },
    "& .cx-group": { mt: "10px" },
    "& .group-h": {
        display: "flex", alignItems: "center", gap: "7px", p: "6px", width: "100%",
        fontFamily: TYPO.title, fontSize: "9.5px", letterSpacing: ".12em", textTransform: "uppercase", color: "#ddd",
        "& .dot": { width: 7, height: 7, borderRadius: "50%", boxShadow: "0 0 6px currentColor" },
        "& .n": { fontFamily: TYPO.mono, fontSize: "10.5px", color: MUTED, letterSpacing: 0 },
        "& .chev": { display: "inline-grid", color: MUTED, transition: "transform 180ms ease" },
        "&:hover": { color: "#fff" },
    },
    "& .cx-group .g-body": { display: "grid", gridTemplateRows: "1fr", transition: "grid-template-rows 180ms ease" },
    "& .cx-group.is-shut .g-body": { gridTemplateRows: "0fr" },
    "& .cx-group.is-shut .group-h .chev": { transform: "rotate(-90deg)" },
    "& .g-clip": { overflow: "hidden", minHeight: 0 },
    "& .pc-grid": { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: "8px", p: "2px 4px" },
    "& .pc-card": {
        display: "flex", flexDirection: "column", gap: "5px", alignItems: "stretch", borderRadius: "6px", p: "3px",
        "& .ph": {
            position: "relative", display: "grid", placeItems: "center", aspectRatio: "1", borderRadius: "6px", overflow: "hidden",
            border: `1px solid ${UI_COLORS.border}`, background: "#14141c",
            fontFamily: TYPO.title, fontSize: "15px", color: UI_COLORS.accent, letterSpacing: ".06em",
            transition: "border-color 150ms, box-shadow 150ms",
        },
        "& .ph img": { width: "100%", height: "100%", objectFit: "cover", display: "block" },
        "& .corner": { position: "absolute", bottom: 4, display: "flex", gap: "3px" },
        "& .corner.bl": { left: 4 },
        "& .nm": {
            fontSize: "12px", color: "#fff", textAlign: "center", lineHeight: 1.25, overflow: "hidden",
            textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        },
        "&:hover .ph": { borderColor: `${UI_COLORS.accent}88` },
        "&.on .ph": { borderColor: UI_COLORS.accent, boxShadow: `0 0 14px ${UI_COLORS.accentGlow}` },
    },
    "& .cx-row": {
        display: "flex", alignItems: "center", gap: "9px", width: "100%", p: "6px 7px", borderRadius: "4px",
        borderLeft: "2px solid transparent",
        "&:hover": { background: "rgba(255, 255, 255, .04)" },
        "&.on": { background: `${NAR}18`, borderLeftColor: NAR },
        "& .tx": { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
        "& .t": { fontSize: "13px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        "& .s": { fontSize: "11.5px", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    },

    /* article */
    "& .cx-article": { overflow: "auto", minWidth: 0 },
    "& .art-inner": { position: "relative", maxWidth: 760, m: "0 auto", p: "24px 30px 60px" },
    "& .art-inner.edit-full": { maxWidth: "none", p: 0, height: "100%" },
    "& .edit-tools": { display: "flex", alignItems: "center", gap: "6px", zIndex: 4 },
    "& .art-view > .edit-tools": {
        position: "sticky", top: 0, height: 0, justifyContent: "flex-end", alignItems: "flex-start", overflow: "visible",
    },
    "& .art-view:has(> .edit-tools) .art-head": { pr: "76px" },
    "& .link.back": { display: "inline-block", mb: "14px" },
    "& .art-head": {
        display: "flex", gap: "18px", alignItems: "flex-start", pb: "16px", borderBottom: `1px solid ${UI_COLORS.border}`,
        "& h1": {
            fontFamily: TYPO.title, fontSize: "21px", fontWeight: 600, lineHeight: 1.25, letterSpacing: ".06em",
            textTransform: "uppercase", m: "6px 0 8px", color: "#fff",
        },
        "& .tags": { display: "flex", flexWrap: "wrap", gap: "4px", mt: "8px" },
    },
    "& .art-aside": { flex: "none" },
    "& .summary": { color: "#ddd", fontSize: "14px", m: 0 },
    "& .art-body": {
        mt: "20px", fontSize: "14.5px", lineHeight: 1.75, color: "#eee",
        "& .cx-void": { m: "4px 0 0", width: "100%", textAlign: "left" },
        "& p": { m: "0 0 12px" },
        "& h4": { fontFamily: TYPO.title, fontSize: "11px", letterSpacing: ".14em", textTransform: "uppercase", m: "22px 0 8px", color: NAR },
        "& ul": { m: "0 0 12px 20px", p: 0 },
    },
    "& .cx-tabs": {
        display: "flex", gap: "4px", mt: "16px", borderBottom: `1px solid ${UI_COLORS.border}`,
    },
    "& .cx-tabs button": {
        mb: "-1px", px: "12px", py: "8px", border: 0, borderBottom: "2px solid transparent",
        background: "none", cursor: "pointer", color: MUTED,
        fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase",
        "&:hover": { color: "#ffffff" },
        "&[aria-selected='true']": { color: "#ffffff", borderBottomColor: UI_COLORS.accent },
        "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "2px" },
    },
    "& .cx-tabs + .art-body": { mt: "16px" },
    "& .cx-person-tab": { mt: "16px" },
    "& .art-extra": { mt: "8px" },
    "& .lab-extra-card": {
        p: "12px 14px", mb: "14px", borderRadius: "6px",
        border: `1px solid ${UI_COLORS.border}`, background: CARD_BG,
    },
    "& .back-item": {
        display: "flex", gap: "10px", p: "9px 10px", mb: "6px", alignItems: "flex-start",
        border: `1px solid ${UI_COLORS.border}`, borderRadius: "6px", background: CARD_BG,
        "& .t": { fontSize: "13px", color: "#fff" },
        "& .q": { fontSize: "12.5px", color: "#bbb" },
        "& .q em": { fontStyle: "normal", color: "#fff", background: `${NAR}2a`, p: "0 2px", borderRadius: "2px" },
    },

    /* editor (library) */
    "& .ent-ed": { position: "relative", pr: "8px" },
    "& .ent-ed > .edit-tools": { position: "absolute", top: 0, right: 0 },
    "& .ent-ed-h": { fontFamily: TYPO.title, fontSize: "11px", letterSpacing: ".14em", color: NAR, textTransform: "uppercase", m: "4px 0 6px" },
    "& .fld": { display: "flex", flexDirection: "column", gap: "6px", mt: "12px", fontSize: "12px", color: MUTED },
    "& .fl-t": { fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".14em", textTransform: "uppercase" },
    "& .fl-l": {
        display: "flex", alignItems: "center", m: "14px 0 6px", fontFamily: TYPO.title, fontSize: "9px",
        letterSpacing: ".14em", color: MUTED, textTransform: "uppercase",
    },
    "& .ent-ed .input.title": { fontFamily: TYPO.title, fontSize: "15px", letterSpacing: ".06em" },
    "& .save-st": {
        fontFamily: TYPO.title, fontSize: "8.5px", letterSpacing: ".14em", textTransform: "uppercase", color: NAR,
        "&.ok": { color: UI_COLORS.boon },
    },
    "& .cn-status": { mt: "8px", fontSize: "12px", color: MUTED, "& .bad": { color: "#ff8095" } },
    "& .ix-dates": { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
    "& .ix-list": { display: "flex", flexWrap: "wrap", gap: "6px" },
    "& .ix-chip": {
        display: "inline-flex", alignItems: "center", p: "3px 8px", borderRadius: "999px",
        color: "#ffffff", background: "transparent", border: `1px solid ${UI_COLORS.border}`,
        fontFamily: TYPO.body, fontSize: "12px", cursor: "pointer",
        "&.is-place": { borderColor: `${UI_COLORS.anomaly}88` },
        "&.is-inherited": { color: MUTED, borderStyle: "dashed", cursor: "default" },
    },
    "& .ix-read": { mt: "14px" },
    "& .ix-fact": {
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px",
        width: "100%", p: "7px 0", m: 0, border: 0, borderBottom: `1px solid ${UI_COLORS.border}`,
        background: "transparent", color: "#ffffff", cursor: "pointer", textAlign: "left",
        "&:last-child": { borderBottom: 0 },
        "&:hover": { color: "var(--c, #f5c542)" },
        "& .verb": { fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".1em", textTransform: "uppercase", color: MUTED },
        "& .who": { fontSize: "13px", color: "var(--c, #ffffff)" },
    },

    /* rail (Dossier) */
    "& .cx-rail": {
        overflow: "auto", borderLeft: `1px solid ${UI_COLORS.border}`, p: "12px 12px 30px",
        display: "flex", flexDirection: "column", gap: "10px", background: UI_COLORS.backgroundPrimary,
    },
    "& .rail-head": {
        display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 28,
        fontFamily: TYPO.title, fontSize: "11px", letterSpacing: ".14em", color: NAR, textTransform: "uppercase",
    },
    "& .ds-card": {
        border: `1px solid ${UI_COLORS.border}`, borderRadius: "8px", background: CARD_BG, overflow: "hidden",
        "&.sync": { borderColor: `${NAR}66`, background: `linear-gradient(180deg, ${CARD_BG}, ${NAR}12)` },
    },
    "& .ds-h": {
        display: "flex", alignItems: "center", gap: "8px", p: "9px 12px", borderBottom: `1px solid ${UI_COLORS.border}`,
        fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".14em", textTransform: "uppercase", color: UI_COLORS.anomaly,
        "& .n": { fontFamily: TYPO.body, fontSize: "10.5px", letterSpacing: 0, color: MUTED, textTransform: "none" },
        "&.sync": { color: NAR, borderBottomColor: `${NAR}33` },
    },
    "& .ds-b": { p: "8px 12px 10px", "& .empty-note": { py: "4px" } },
    "& .rel-row": { "& + &": { mt: "2px" }, "& .ix-fact": { borderBottom: 0, pb: "2px" } },
    "& .rel-meter": { px: "2px", pb: "6px", borderBottom: `1px solid ${UI_COLORS.border}` },
    "& .btn": {
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", p: "7px 14px", borderRadius: "4px",
        border: `1px solid ${UI_COLORS.border}`, color: "#fff", background: FIELD_BG,
        fontFamily: TYPO.title, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap",
        "&:hover": { borderColor: NAR, background: `${NAR}18` },
        "&.pri": { borderColor: NAR, background: `${NAR}22`, "&:hover": { background: `${NAR}38` } },
        "&.lab": { borderColor: `${UI_COLORS.anomaly}88`, color: UI_COLORS.anomaly, "&:hover": { borderColor: UI_COLORS.anomaly, background: `${UI_COLORS.anomaly}14` } },
        "&.ghost": { borderColor: "transparent", background: "transparent", color: MUTED, "&:hover": { color: "#fff", borderColor: UI_COLORS.border } },
        "&.wide": { width: "100%" },
        "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
    },

    /* confirm + toast */
    "& .confirm-back": { position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(0, 0, 0, .6)", backdropFilter: "blur(2px)" },
    "& .confirm": {
        width: "min(420px, calc(100% - 32px))", p: "16px 18px", borderRadius: "8px",
        background: UI_COLORS.backgroundSecondary, border: `1px solid ${NAR}66`, color: UI_COLORS.textPrimary,
        boxShadow: `0 0 30px rgba(0, 0, 0, .6), 0 0 18px ${NAR}22`,
        "& .confirm-h": { fontFamily: TYPO.title, fontSize: "10px", letterSpacing: ".14em", color: UI_COLORS.danger, textTransform: "uppercase", mb: "10px" },
        "& p": { m: "0 0 14px" },
        "& .acts": { display: "flex", justifyContent: "flex-end", gap: "8px" },
    },
    "& .toast": {
        position: "fixed", left: "50%", bottom: 22, transform: "translate(-50%, 20px)", zIndex: 70, opacity: 0, pointerEvents: "none",
        background: UI_COLORS.backgroundSecondary, border: `1px solid ${UI_COLORS.anomaly}`, color: "#fff", p: "8px 14px", borderRadius: "5px", fontSize: "12.5px",
        transition: "opacity .2s, transform .2s", boxShadow: "0 10px 28px rgba(0, 0, 0, .55)",
        "&.on": { opacity: 1, transform: "translate(-50%, 0)" },
    },

    /* The mock has no narrow layout; below 900px the three columns stack. */
    "@media (max-width: 900px)": {
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "auto auto auto",
        overflow: "auto",
        ...CYBER_SCROLL_STYLE,
        "& .cx-index": { height: "42vh", borderRight: "none", borderBottom: `1px solid ${ARCHIVE_BORDER}` },
        "&.is-shut .cx-index": { height: 40 },
        "&.is-shut .rail-tab": { height: 40 },
        "& .cx-article": { overflow: "visible" },
        "& .art-inner": { p: "18px 16px 30px" },
        "& .cx-rail": { overflow: "visible", borderLeft: "none", borderTop: `1px solid ${ARCHIVE_BORDER}` },
    },
};
