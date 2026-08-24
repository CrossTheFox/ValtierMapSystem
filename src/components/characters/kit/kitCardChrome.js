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
    width: 16,
    textAlign: "center",
    flexShrink: 0,
    userSelect: "none",
    transition: "transform 0.15s",
    "&:hover": { color: UI_COLORS.anomaly },
};

export const CARD_BASE_SX = {
    borderRadius: "6px",
    background: "rgba(0,0,0,0.3)",
    overflow: "visible",
    flexShrink: 0,
};
