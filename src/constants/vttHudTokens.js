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
    glassBg: "rgba(10, 10, 15, 0.88)",
    glassBorder: "rgba(255, 102, 255, 0.2)",
    borderRadius: 10,
};

export const VTT_DIALOG_SIZE = {
    lg: {
        width: "min(90%, 1100px)",
        height: "min(85vh, 820px)",
        borderRadius: 3,
    },
    xl: {
        width: "min(94%, 1280px)",
        height: "min(88vh, 900px)",
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
