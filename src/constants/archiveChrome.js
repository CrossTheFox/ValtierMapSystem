import { keyframes } from "@emotion/react";
import { UI_COLORS } from "./uiColors";
import { TYPO } from "./designSystem";
import { CYBER_SCROLL_STYLE } from "./cyberScrollStyle";

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

/** Mock `.spin`: .8s linear infinite. Archive animations ignore prefers-reduced-motion (Christian, alto 2). */
export const ARCHIVE_SPIN_SX = {
    display: "inline-block",
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    border: "2px solid rgba(0, 242, 234, .25)",
    borderTopColor: UI_COLORS.anomaly,
    animation: `${spin} .8s linear infinite`,
    verticalAlign: "-1px",
    mr: "6px",
};

export const archiveFlash = keyframes`
    0%, 100% { box-shadow: none; }
    25% { box-shadow: 0 0 0 3px rgba(0, 242, 234, .6); }
`;

const idGlitch = keyframes`
    0% { transform: translate(0, 0); clip-path: inset(0 0 70% 0); }
    25% { transform: translate(-1px, 0); clip-path: inset(28% 0 38% 0); }
    50% { transform: translate(1px, 0); clip-path: inset(60% 0 8% 0); }
    75% { transform: translate(-1px, 1px); clip-path: inset(8% 0 52% 0); }
    100% { transform: translate(0, 0); clip-path: inset(0 0 70% 0); }
`;

/** Mock `.flash`: 1.4s ease, on the mention a backlink jumps to. */
export const ARCHIVE_FLASH_SX = { animation: `${archiveFlash} 1.4s ease` };

/**
 * Mock `.id-glitch`: the name goes transparent and two clipped copies of `data-label` jitter
 * (1.15s and .85s reverse, steps(2, end)). A portrait inside is blurred. The id is never painted.
 */
export const ARCHIVE_ID_GLITCH_SX = {
    "&[data-label]": {
        position: "relative",
        display: "inline-block",
        color: "transparent !important",
        userSelect: "none",
        verticalAlign: "baseline",
    },
    "&[data-label]::before, &[data-label]::after": {
        content: "attr(data-label)",
        position: "absolute",
        left: 0,
        top: 0,
        color: UI_COLORS.textPrimary,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        animation: `${idGlitch} 1.15s steps(2, end) infinite`,
    },
    "&[data-label]::after": {
        color: UI_COLORS.accent,
        animationDuration: ".85s",
        animationDirection: "reverse",
        clipPath: "inset(42% 0 18% 0)",
        opacity: 0.9,
    },
    "& img": { filter: "blur(8px)", transform: "scale(1.06)" },
};

/** Archive chrome tokens (mock `memoria-archive-en-app.html`: .topnav, .btn, .btn.pri). */
export const ARCHIVE_NAV_H = 42;
export const ARCHIVE_BORDER = "rgba(255, 255, 255, .1)";
export const ARCHIVE_BORDER_2 = "rgba(255, 255, 255, .2)";

export const ARCHIVE_TOPNAV_SX = {
    height: ARCHIVE_NAV_H,
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    px: "14px",
    background: "rgba(8, 8, 14, .96)",
    borderBottom: `1px solid ${ARCHIVE_BORDER}`,
    position: "relative",
    zIndex: 30,
    overflowX: "auto",
    overflowY: "hidden",
    ...CYBER_SCROLL_STYLE,
    "& > *": { flexShrink: 0 },
};

export const ARCHIVE_BTN_SX = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 14px",
    borderRadius: "4px",
    border: `1px solid ${ARCHIVE_BORDER_2}`,
    color: UI_COLORS.textPrimary,
    background: "rgba(255, 255, 255, .03)",
    fontFamily: TYPO.title,
    fontSize: "8.5px",
    letterSpacing: ".14em",
    whiteSpace: "nowrap",
    cursor: "pointer",
    "&:hover": { borderColor: UI_COLORS.accent },
    "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
    "&:disabled": { opacity: 0.5, cursor: "default" },
};

/** Mock `.tbg`: segmented toggle (DM / Jugador). */
export const ARCHIVE_TBG_SX = {
    display: "inline-flex",
    border: `1px solid ${ARCHIVE_BORDER}`,
    borderRadius: "4px",
    overflow: "hidden",
    "& button": {
        padding: "5px 10px",
        color: UI_COLORS.textSecondary,
        border: 0,
        borderRight: `1px solid ${ARCHIVE_BORDER}`,
        fontSize: "12px",
        fontFamily: TYPO.body,
        background: "transparent",
        cursor: "pointer",
        whiteSpace: "nowrap",
    },
    "& button:last-of-type": { borderRight: "none" },
    "& button:hover": { color: UI_COLORS.textPrimary },
    "& button[aria-pressed='true']": { color: UI_COLORS.textPrimary, background: "rgba(255, 102, 255, .16)" },
    "& button:focus-visible": { outline: "none", boxShadow: `inset 0 0 0 2px ${UI_COLORS.anomaly}` },
};

export const ARCHIVE_BTN_PRI_SX = {
    ...ARCHIVE_BTN_SX,
    borderColor: UI_COLORS.accentStrong,
    background: "rgba(255, 20, 147, .18)",
    "&:hover:not(:disabled)": { background: "rgba(255, 20, 147, .32)" },
};
