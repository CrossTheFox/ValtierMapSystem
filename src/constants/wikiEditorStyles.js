import { UI_COLORS } from "./uiColors";
import { RENDER_LAYERS } from "./renderLayers";
import { CYBER_SCROLL_STYLE } from "./cyberScrollStyle";

/** Menús de Select/Autocomplete por encima del overlay wiki (1500). */
export const WIKI_EDITOR_MENU_Z = RENDER_LAYERS.WIKI_OVERLAY + 50;

export const wikiEditorInputSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.85rem",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.accent}88` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent },
    },
    "& .MuiInputLabel-root": {
        color: UI_COLORS.textSecondary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.8rem",
    },
    "& .MuiInputLabel-root.Mui-focused": { color: UI_COLORS.accent },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
};

export const wikiEditorSelectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.82rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiSelect-select": { color: UI_COLORS.textPrimary },
    "& .MuiOutlinedInput-input": { color: UI_COLORS.textPrimary },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

export const wikiEditorLabelSx = {
    color: UI_COLORS.textSecondary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.78rem",
    "&.Mui-focused": { color: UI_COLORS.accent },
};

export const wikiEditorMenuItemSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.82rem",
    "&:hover": { bgcolor: `${UI_COLORS.accent}10` },
    "&.Mui-selected": {
        bgcolor: `${UI_COLORS.accent}18`,
        color: UI_COLORS.accent,
    },
    "&.Mui-selected:hover": { bgcolor: `${UI_COLORS.accent}22` },
};

const menuPaperSx = {
    bgcolor: UI_COLORS.backgroundSecondary,
    color: UI_COLORS.textPrimary,
    maxHeight: 320,
    overflowY: "auto",
    zIndex: WIKI_EDITOR_MENU_Z,
    ...CYBER_SCROLL_STYLE,
    "& .MuiMenuItem-root": wikiEditorMenuItemSx,
};

export const wikiEditorPanelShellSx = {
    p: 1.5,
    bgcolor: UI_COLORS.backgroundSecondary,
    border: `1px solid ${UI_COLORS.border}`,
    borderLeft: `3px solid ${UI_COLORS.accent}`,
    borderRadius: 1,
    display: "flex",
    flexDirection: "column",
    gap: 1.5,
};

export const wikiEditorSubsectionSx = {
    display: "flex",
    flexDirection: "column",
    gap: 1.25,
    pt: 1.25,
    mt: 0.25,
    borderTop: `1px solid ${UI_COLORS.border}`,
};

export const wikiEditorSubsectionTitleSx = {
    color: UI_COLORS.textSecondary,
    fontSize: "0.62rem",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: 600,
};

export const wikiEditorListRowSx = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    px: 1.25,
    py: 0.75,
    bgcolor: UI_COLORS.backgroundPrimary,
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: 1,
    transition: "border-color 0.15s",
    "&:hover": { borderColor: `${UI_COLORS.accent}44` },
};

export const wikiEditorIdentityCardSx = {
    p: 1.5,
    bgcolor: UI_COLORS.backgroundSecondary,
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: 1,
    display: "flex",
    flexDirection: "column",
    gap: 1.25,
};

export const wikiEditorOptionalSectionSx = {
    p: 1.25,
    bgcolor: `${UI_COLORS.anomaly}06`,
    border: `1px solid ${UI_COLORS.border}`,
    borderRadius: 1,
    display: "flex",
    flexDirection: "column",
    gap: 1,
};

export const wikiEditorMenuProps = {
    disableScrollLock: true,
    PaperProps: { sx: menuPaperSx },
    MenuListProps: { sx: { bgcolor: UI_COLORS.backgroundSecondary, py: 0.5 } },
    slotProps: {
        paper: { sx: menuPaperSx },
        root: { sx: { zIndex: WIKI_EDITOR_MENU_Z } },
    },
    sx: { zIndex: WIKI_EDITOR_MENU_Z },
};

export const wikiEditorScrollbarSx = CYBER_SCROLL_STYLE;
