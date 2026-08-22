/**
 * HUD + dialog sizing tokens from docs/memoria/propuestas-ui-vtt/_vtt-shared.css
 * and propuesta-c-radial-hud.html. Primary target: 1920×1080 @ 100%.
 */

export const VTT_HUD = {
    inset: 16,
    mapControlsInset: 16,
    titleFontSize: "9px",
    titleLetterSpacing: "2px",
    chipFontSize: "8px",
    chipLetterSpacing: "1px",
    chipPadding: "4px 8px",
    previewMaxWidth: 300,
    previewNameFontSize: "14px",
    previewMetaFontSize: "11px",
    hudBtnSize: 32,
    mapControlBtnSize: 24,
    mapControlPanelMinWidth: 132,
    mapControlPanelPadding: "6px 8px",
    scaleFontSize: "10px",
    profilePadding: "6px",
    profileAvatarSize: 36,
    profilePillHeight: 40,
    /** Above right dock (chat/tokens @ 1250) so SYSTEM_SESSIONS is never covered. */
    profileZIndex: 1600,
    glassBg: "rgba(10, 10, 15, 0.88)",
    glassBorder: "rgba(255, 102, 255, 0.2)",
    borderRadius: 10,
};

/** Right-side VTT dock: fills space between profile pill and zoom controls. */
export const VTT_RIGHT_DOCK = {
    width: 340,
    gap: 8,
    /** top inset + profile height + gap */
    get top() {
        return VTT_HUD.inset + VTT_HUD.profilePillHeight + VTT_HUD.inset / 2;
    },
    /** mapControls inset + control row (~40) + gap */
    bottom: 64,
    tokenPanelMaxHeight: 220,
    /** DM character list — sits above tokens/chat in the dock column. */
    rosterPanelMaxHeight: 280,
};

export const VTT_DIALOG_SIZE = {
    /** Compact floating panels (initiative, etc.). */
    md: {
        width: "min(440px, 92vw)",
        height: "min(560px, 82vh)",
        borderRadius: 2,
    },
    /** Near full-bleed on 1080p / 1440p / ultrawide (no hard 1100–1280 caps). */
    lg: {
        width: "min(97vw, 100%)",
        height: "min(94vh, 100%)",
        borderRadius: 3,
    },
    xl: {
        width: "min(98vw, 100%)",
        height: "min(96vh, 100%)",
        borderRadius: 2,
    },
    fullscreen: {
        width: "100vw",
        height: "100vh",
        borderRadius: 0,
        m: 0,
        maxWidth: "100vw",
        maxHeight: "100vh",
    },
};

/** Shared dialog header bar — compact to maximize content area. */
export const VTT_DIALOG_HEADER = {
    px: 1.25,
    py: 0.5,
    titleFontSize: "clamp(0.62rem, 0.9vw, 0.85rem)",
    titleLetterSpacing: "0.12em",
    subtitleFontSize: "7px",
    subtitleLetterSpacing: "0.06em",
    minimizedTitleFontSize: "0.75rem",
};
