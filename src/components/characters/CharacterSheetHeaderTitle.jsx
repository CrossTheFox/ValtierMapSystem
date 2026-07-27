import { CyberTitle } from "../customs/CustomTexts";
import { getVttDialogTitleSx } from "../VttDialogHeader";

/** Minimized / fallback title for the character sheet dialog. */
export default function CharacterSheetHeaderTitle({ character, isMinimized = false }) {
    const name = character?.name?.toUpperCase() || "DOSSIER";

    if (isMinimized) {
        return (
            <CyberTitle sx={getVttDialogTitleSx({ isMinimized: true })}>
                {`CHAR — ${name} (MIN)`}
            </CyberTitle>
        );
    }

    return (
        <CyberTitle
            sx={{
                ...getVttDialogTitleSx(),
                fontSize: "clamp(0.62rem, 0.9vw, 0.78rem)",
                opacity: 0.55,
            }}
        >
            CHAR
        </CyberTitle>
    );
}
