import { UI_COLORS } from "../constants/uiColors.js";

/** Named ranks from strength (−10…+10). */
export function syncRankFromStrength(strength) {
    const s = Number.isFinite(strength) ? strength : 0;
    if (s <= -7) {
        return { id: "hostile", label: "HOSTIL", color: UI_COLORS.danger };
    }
    if (s <= -3) {
        return { id: "rival", label: "RIVAL", color: UI_COLORS.loot };
    }
    if (s <= 2) {
        return { id: "neutral", label: "NEUTRAL", color: UI_COLORS.textSecondary };
    }
    if (s <= 7) {
        return { id: "allied", label: "ALIADO", color: UI_COLORS.anomaly };
    }
    return { id: "bonded", label: "VÍNCULO", color: UI_COLORS.boon };
}

/** Trace visual class for circuit SVG from strength. */
export function traceClassFromStrength(strength) {
    const s = Number.isFinite(strength) ? strength : 0;
    if (s >= 3) return "ok";
    if (s <= -7) return "hot";
    if (s <= -3) return "warn";
    return "idle";
}

/** Meter thumb % (0…100) for sync −10…+10. */
export function syncMeterPct(strength) {
    const n = Number(strength);
    if (!Number.isFinite(n)) return 50;
    return ((n + 10) / 20) * 100;
}
