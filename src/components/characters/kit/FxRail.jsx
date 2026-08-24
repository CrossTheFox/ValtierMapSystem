import { Box } from "@mui/material";

/**
 * Shared "effect provenance" primitives — ported from the mockup's `.fx-rail`
 * (upgrade-sourced badge) and `.cc-rail` (trigger-lane color bar), used by
 * both `KitCardBodyB2.jsx` (dossier body, EFFECTS rows) and `AbilityC2Card.jsx`
 * (chat card) so the two never drift (`DOSSIER-REACT-MAP.md` / Slice 6 plan §6.4).
 */

export const FX_LANE_COLOR = { hit: "#ff8a3d", mech: "#a78bfa", plain: "rgba(255,255,255,0.55)" };
export const FX_LANE_LABEL = { hit: "ON HIT", mech: "MECH", plain: "NONE" };

/** "From T1/T2/M" badge — cyan for talents, gold for mastery (mockup `.fx-rail`/`.fx-rail.m`). */
export function FxRail({ badge, dense = false }) {
    if (!badge) return null;
    const isM = badge === "M";
    return (
        <Box
            title={`From ${badge}`}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                minWidth: dense ? 18 : 22,
                py: "2px",
                px: dense ? "3px" : "4px",
                borderRadius: "3px",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontSize: dense ? "0.36rem" : "0.42rem",
                color: isM ? "#f5c542" : "#00f2ea",
                bgcolor: isM ? "rgba(245,197,66,0.12)" : "rgba(0,242,234,0.12)",
                border: `1px solid ${isM ? "rgba(245,197,66,0.38)" : "rgba(0,242,234,0.28)"}`,
            }}
        >
            {badge}
        </Box>
    );
}

/** Vertical trigger-lane color bar shown instead of `FxRail` when the effect has no upgrade origin. */
export function FxLaneRail({ lane }) {
    return (
        <Box
            sx={{
                width: "3px",
                flexShrink: 0,
                alignSelf: "stretch",
                borderRadius: "1px",
                mt: "2px",
                bgcolor: FX_LANE_COLOR[lane] || FX_LANE_COLOR.plain,
            }}
        />
    );
}
