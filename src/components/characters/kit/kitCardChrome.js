import { UI_COLORS } from "../../../constants/uiColors";

export const KIT_ATK = "#ff8a3d";
export const KIT_LB = "#ffcc33";
export const KIT_DANGER = "#ff3355";
export const KIT_GOLD = UI_COLORS.loot;

export function abilityTone(ability) {
    const src = String(ability?.source || "").toLowerCase();
    if (src === "zarkenity" || src === "zar") return "zar";
    if (ability?.hasAttack) return "atk";
    return "std";
}

export function toneAccent(tone) {
    if (tone === "atk") return KIT_ATK;
    if (tone === "zar") return UI_COLORS.accent;
    if (tone === "lb") return KIT_LB;
    return UI_COLORS.anomaly;
}

export function toneBorder(tone, inactive = false) {
    if (inactive) return "rgba(255,255,255,0.18)";
    if (tone === "atk") return "rgba(255,138,61,0.42)";
    if (tone === "zar") return "rgba(255,102,255,0.42)";
    if (tone === "lb") return "rgba(255,204,51,0.45)";
    return "rgba(0,242,234,0.32)";
}

export const CHEVRON_SX = {
    fontFamily: "'Fira Code', monospace",
    fontSize: "0.6rem",
    color: UI_COLORS.textSecondary,
    cursor: "pointer",
    width: 14,
    textAlign: "center",
    flexShrink: 0,
    userSelect: "none",
    transition: "transform 0.15s, color 0.15s",
    "&:hover": { color: UI_COLORS.anomaly },
};

/** Magenta column divider in card header tools — mockup `.hd-div`. */
export const HD_DIV_SX = {
    width: "1px",
    alignSelf: "stretch",
    minHeight: 22,
    background: "rgba(255,102,255,0.45)",
    margin: "2px 2px 2px 0",
    flexShrink: 0,
};

/** Header icon button — mockup `.hd-tools .ico-btn` (22×22). */
export const ICO_BTN_SX = {
    width: 22,
    height: 22,
    minWidth: 22,
    minHeight: 22,
    p: 0,
    display: "inline-grid",
    placeItems: "center",
    borderRadius: "2px",
    border: "1px solid rgba(255,255,255,0.22)",
    bgcolor: "rgba(0,0,0,0.45)",
    cursor: "pointer",
    flexShrink: 0,
    color: UI_COLORS.textPrimary,
    "&:hover": {
        borderColor: UI_COLORS.anomaly,
        bgcolor: "rgba(0,242,234,0.08)",
    },
};

export const CARD_HD_GRID_SX = {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    columnGap: "3px",
    alignItems: "center",
    minHeight: 48,
    px: "8px",
    py: "6px",
};

export const VPACK_SX = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
    minWidth: 0,
};

export const CARD_BASE_SX = {
    borderRadius: "4px",
    background: "rgba(0,0,0,0.32)",
    overflow: "visible",
    flexShrink: 0,
};
