/** Density tokens for NarrativeWikiOverlay dialog vs pop-out tab. */
export const WIKI_OVERLAY_DENSITY = {
    compact: {
        panelLeft: 196,
        panelRight: 208,
        panelDetail: 232,
        panelLab: 460,
        headerPx: 1,
        headerPy: 0.375,
        headerGap: 0.5,
        titleFontSize: "0.62rem",
        titleLetterSpacing: "0.14em",
        iconBtnSx: { p: 0.35, "& .MuiSvgIcon-root": { fontSize: "0.95rem" } },
        emptyStatePy: 1.5,
        emptyStateFontSize: "0.75rem",
    },
    comfortable: {
        panelLeft: 260,
        panelRight: 260,
        panelDetail: 300,
        panelLab: 520,
        headerPx: 2.5,
        headerPy: 1.5,
        headerGap: 2,
        titleFontSize: "clamp(0.75rem, 1vw, 1rem)",
        titleLetterSpacing: "0.12em",
        iconBtnSx: {},
        emptyStatePy: 3,
        emptyStateFontSize: "0.85rem",
    },
};

export function getWikiOverlayDensity(compact) {
    return compact ? WIKI_OVERLAY_DENSITY.compact : WIKI_OVERLAY_DENSITY.comfortable;
}
