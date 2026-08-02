/** Redux keys for per-dialog minimize state in ui.minimizedDialogs */
export const DIALOG_IDS = {
    LOCATION: "location",
    LORE: "lore",
    WIKI: "wiki",
    CHARACTERS: "characters",
    SHEET: "sheet",
    SETTINGS: "settings",
    LORE_BROWSER: "loreBrowser",
    INITIATIVE: "initiative",
};

export const INITIAL_MINIMIZED_DIALOGS = {
    [DIALOG_IDS.LOCATION]: false,
    [DIALOG_IDS.LORE]: false,
    [DIALOG_IDS.WIKI]: false,
    [DIALOG_IDS.CHARACTERS]: false,
    [DIALOG_IDS.SHEET]: false,
    [DIALOG_IDS.SETTINGS]: false,
    [DIALOG_IDS.LORE_BROWSER]: false,
    [DIALOG_IDS.INITIATIVE]: false,
};
