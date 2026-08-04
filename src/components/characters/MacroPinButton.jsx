import { useState } from "react";
import { IconButton } from "@mui/material";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import MacroPinPicker from "../vtt/MacroPinPicker";

/**
 * Pin an ability / trait / LB / shortcut into the character macro bar.
 * Available outside edit mode.
 *
 * @param {{
 *   character: object|null,
 *   entry: { type: string, id: string, label: string, blurb?: string },
 *   size?: "small"|"tiny",
 * }} props
 */
export default function MacroPinButton({ character, entry, size = "small" }) {
    const [open, setOpen] = useState(false);
    if (!character?.id || !entry?.id) return null;

    const dim = size === "tiny" ? 24 : 28;
    const icon = size === "tiny" ? "0.8rem" : "0.95rem";

    return (
        <>
            <CyberTooltip title="Añadir a macros" placement="top">
                <IconButton
                    size="small"
                    aria-label="Añadir a macros"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(true);
                    }}
                    sx={{
                        color: "#ffffff",
                        border: `1px solid ${UI_COLORS.border}`,
                        width: dim,
                        height: dim,
                        "&:hover": {
                            borderColor: UI_COLORS.anomaly,
                            bgcolor: `${UI_COLORS.anomaly}18`,
                            color: UI_COLORS.anomaly,
                        },
                    }}
                >
                    <PushPinOutlinedIcon sx={{ fontSize: icon }} />
                </IconButton>
            </CyberTooltip>
            <MacroPinPicker
                open={open}
                onClose={() => setOpen(false)}
                character={character}
                entry={entry}
            />
        </>
    );
}
