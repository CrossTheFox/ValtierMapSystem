import { Box, Dialog, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import CharactersSubTab from "../tabs/subtabs/CharactersSubTab";

/** Above BaseTabbedDialog (1300); below snackbar (2100). */
const EDITOR_Z = 1800;

/**
 * Modal Create/Edit de personaje sobre VTT Configs.
 */
export default function CharacterEditorDialog({
    open,
    onClose,
    campaignId,
    locations = [],
    initialCharacterId = null,
    autoCreate = false,
}) {
    const isCreate = Boolean(autoCreate) || !initialCharacterId;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth={false}
            sx={{
                zIndex: EDITOR_Z,
                "& .MuiDialog-container": { alignItems: "center" },
            }}
            slotProps={{
                backdrop: {
                    sx: { backgroundColor: "rgba(0,0,0,0.62)", zIndex: EDITOR_Z - 1 },
                },
            }}
            PaperProps={{
                sx: {
                    zIndex: EDITOR_Z,
                    width: "min(1100px, 96vw)",
                    height: "min(900px, 92vh)",
                    maxWidth: "96vw",
                    m: 1,
                    bgcolor: "#12121a",
                    color: UI_COLORS.textPrimary,
                    border: `1px solid ${UI_COLORS.border}`,
                    boxShadow: "0 0 48px rgba(255,102,255,0.18)",
                    borderRadius: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                },
            }}
        >
            <Box
                sx={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 2,
                    py: 1.25,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    bgcolor: UI_COLORS.backgroundSecondary,
                }}
            >
                <Box>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.accent, letterSpacing: "0.12em" }}>
                        {isCreate ? "CREAR PERSONAJE" : "EDITAR PERSONAJE"}
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace" }}>
                        // VTT + Archive · {campaignId ? campaignId.slice(0, 8) : "—"}
                    </CyberText>
                </Box>
                <IconButton
                    onClick={onClose}
                    size="small"
                    aria-label="Cerrar"
                    sx={{
                        color: UI_COLORS.textSecondary,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                        "&:hover": { color: UI_COLORS.accent, borderColor: UI_COLORS.accent },
                    }}
                >
                    <CloseIcon sx={{ fontSize: "1.1rem" }} />
                </IconButton>
            </Box>

            <DialogContent
                sx={{
                    flex: 1,
                    minHeight: 0,
                    p: 2,
                    overflowY: "auto",
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {open && (
                    <CharactersSubTab
                        key={`${autoCreate ? "new" : initialCharacterId || "edit"}-${open}`}
                        currentCampaignId={campaignId}
                        locations={locations}
                        initialCharacterId={initialCharacterId}
                        autoCreate={autoCreate}
                        embedded
                        onSaved={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
