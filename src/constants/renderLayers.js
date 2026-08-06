// Capas de render (ordenadas por profundidad)
export const RENDER_LAYERS = {
    MAP: 0,
    GRID: 10,
    PARTY: 15,
    /** Pins below tokens so PCs near a location remain draggable. */
    LOCATIONS: 18,
    TOKENS: 22,
    ROUTES: 30,
    LABELS: 40,
    UI: 100,
    MAP_CONTROLS: 1250,
    DIALOG: 1300,
    /** Wiki archive overlay — above VTT/MUI dialogs (they portal to body at DIALOG) */
    WIKI_OVERLAY: 1500,
    /** Siempre por encima de modales, menús contextuales y overlays anidados */
    SNACKBAR: 2100,
};
