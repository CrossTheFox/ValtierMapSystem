export const UI_COLORS = {
    /** Near-black shell behind the map (rarely used as opaque fill on HUD). */
    backgroundPrimary: "#0a0a0f",
    /** Elevated opaque panels (legacy dialogs / menus). Prefer HUD glass for VTT overlays. */
    backgroundSecondary: "#12121a",
    border: "rgba(255, 255, 255, 0.12)",

    textPrimary: "#ffffff",
    textSecondary: "#aaaaaa",

    /** Interactive / focus (magenta). */
    accent: "#ff66ff",
    accentStrong: "#ff1493",
    accentGlow: "rgba(255, 102, 255, 0.45)",

    /** Data / system / HP-safe (cyan). */
    anomaly: "#00f2ea",

    /** Peril — burdens, curse, vit/break accents. */
    danger: "#ff3355",
    dangerGlow: "rgba(255, 51, 85, 0.45)",

    /** Boon / positive dice mod. */
    boon: "#3dd68c",
    boonGlow: "rgba(61, 214, 140, 0.4)",

    /** Inventory / object macros. */
    loot: "#f5c542",
    lootGlow: "rgba(245, 197, 66, 0.4)",
};
