/**
 * Unified design tokens for pixi-map (VTT HUD + Archive + sheets).
 *
 * Artistic source of truth (2026 HUD generation — NOT legacy BaseTabbedDialog):
 * - Floating glass over the map (`VTT_HUD.glassBg` / `glassBorder`)
 * - Thin 1px frames, soft neon glow only when active
 * - Magenta = interaction · Cyan = data · Danger red = peril · Boon green = fortune
 * - Orbitron titles · Fira Code tech labels · Fira Sans body
 * - Prefer Popover / glass chips over heavy modal Dialogs for combat actions
 *
 * Source palette: UI_COLORS. Typography via CyberTitle / CyberText.
 */
import { UI_COLORS } from "./uiColors";
import { VTT_HUD, VTT_DIALOG_HEADER } from "./vttHudTokens";
import { WIKI_OVERLAY_DENSITY } from "./wikiOverlayTokens";

export const TYPO = {
    title: "'Orbitron', sans-serif",
    body: "'Fira Sans', sans-serif",
    mono: "'Fira Code', monospace",
};

export const ACTION_LABELS = {
    primary: "GUARDAR",
    secondary: "CANCELAR",
    back: "VOLVER",
    backToList: "VOLVER AL LISTADO",
    confirm: "CONFIRMAR",
    delete: "ELIMINAR",
    annex: "ANEXAR",
    unlink: "DESANEXAR",
};

export const SIZE = {
    chipFont: VTT_HUD.chipFontSize,
    chipLetterSpacing: VTT_HUD.chipLetterSpacing,
    hudTitle: VTT_HUD.titleFontSize,
    dialogTitle: VTT_DIALOG_HEADER.titleFontSize,
    bodySm: "0.75rem",
    bodyMd: "0.85rem",
    btnSm: "0.75rem",
    btnMd: "0.8rem",
};

/** Opaque legacy panel (menus, archive). Prefer HUD_SURFACE for map overlays. */
export const PANEL = {
    glassBg: VTT_HUD.glassBg,
    glassBorder: VTT_HUD.glassBorder,
    borderRadius: VTT_HUD.borderRadius,
    backgroundSecondary: UI_COLORS.backgroundSecondary,
    border: UI_COLORS.border,
};

/**
 * Canonical floating HUD surface — combat card, stat popover, pin chips.
 * Matches CharacterCombatHud / BurdenMark generation.
 */
export const HUD_SURFACE = {
    bgcolor: VTT_HUD.glassBg,
    border: `1px solid ${VTT_HUD.glassBorder}`,
    borderRadius: `${VTT_HUD.borderRadius}px`,
    backdropFilter: "blur(14px)",
    boxShadow: "0 0 18px rgba(255,102,255,0.08)",
    color: UI_COLORS.textPrimary,
    backgroundImage: "none",
};

/** MUI Popover / Menu paper that sits on the battle map. */
export const hudPopoverPaperSx = {
    ...HUD_SURFACE,
    overflow: "visible",
};

export const WIKI_DENSITY = WIKI_OVERLAY_DENSITY;

/** Z-index stack — keep overlays predictable across Pixi canvas + MUI portals */
export const Z_INDEX = {
    wikiOverlay: 1500,
    /** Nested modals inside Archive / LAB_IA (must sit above wikiOverlay) */
    wikiDialog: 1600,
    wikiLabMenu: 1700,
    /** Full-screen dice Decrypt / Swarm / Multi reveal */
    diceReveal: 2050,
    snackbar: 2100,
};

/** Secondary / ghost button used in editors and forms */
export const secondaryButtonSx = {
    px: 2,
    py: 0.75,
    bgcolor: "transparent",
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: 1,
    color: UI_COLORS.textSecondary,
    cursor: "pointer",
    fontFamily: TYPO.body,
    fontSize: SIZE.btnMd,
    transition: "border-color 0.15s, color 0.15s",
    "&:hover": {
        borderColor: UI_COLORS.textSecondary,
        color: UI_COLORS.textPrimary,
    },
};

/** Primary action button */
export const primaryButtonSx = {
    flex: 1,
    px: 2,
    py: 0.75,
    bgcolor: `${UI_COLORS.accent}18`,
    border: `1px solid ${UI_COLORS.accent}`,
    borderRadius: 1,
    color: UI_COLORS.accent,
    cursor: "pointer",
    fontFamily: TYPO.body,
    fontSize: SIZE.btnMd,
    letterSpacing: 1,
    transition: "background-color 0.15s",
    "&:hover:not(:disabled)": { bgcolor: `${UI_COLORS.accent}28` },
    "&:disabled": { opacity: 0.5 },
};

/** Technical label (HUD chips, section markers) — mono, small caps feel */
export const techLabelSx = {
    fontFamily: TYPO.mono,
    fontSize: VTT_HUD.titleFontSize,
    letterSpacing: VTT_HUD.titleLetterSpacing,
    color: UI_COLORS.anomaly,
    textTransform: "uppercase",
};

/**
 * Dark Menu / Select paper — always pair with cyberMenuItemSx.
 * Prevents MUI default black text on dark HUD surfaces.
 */
export const cyberMenuPaperSx = {
    bgcolor: UI_COLORS.backgroundSecondary,
    border: `1px solid ${UI_COLORS.border}`,
    color: UI_COLORS.textPrimary,
    backgroundImage: "none",
    "& .MuiMenuItem-root": {
        color: UI_COLORS.textPrimary,
    },
};

/** MenuItem / option row on dark menus — high-contrast white text */
export const cyberMenuItemSx = {
    color: `${UI_COLORS.textPrimary} !important`,
    fontFamily: TYPO.mono,
    "&.Mui-selected": {
        bgcolor: `${UI_COLORS.accent}18`,
        color: `${UI_COLORS.textPrimary} !important`,
    },
    "&.Mui-selected:hover": {
        bgcolor: `${UI_COLORS.accent}28`,
    },
    "&:hover": {
        bgcolor: `${UI_COLORS.accent}12`,
    },
};

export { UI_COLORS };
