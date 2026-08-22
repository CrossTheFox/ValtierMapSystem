import { useMemo, useState } from "react";
import { IconButton } from "@mui/material";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { findMacroPin } from "../../constants/macroBar";
import MacroPinPicker from "../vtt/MacroPinPicker";

/**
 * Pin an ability / trait / LB / shortcut into the character macro bar.
 * Filled pin = already assigned (shows page·slot); click to move/reassign.
 *
 * @param {{
 *   character: object|null,
 *   entry: { type: string, id: string, label: string, blurb?: string },
 *   size?: "small"|"tiny",
 * }} props
 */
export default function MacroPinButton({ character, entry, size = "small" }) {
    const [open, setOpen] = useState(false);
    const pinLoc = useMemo(
        () => findMacroPin(character?.macroBar, entry?.id),
        [character?.macroBar, entry?.id],
    );
    const pinned = Boolean(pinLoc);

    if (!character?.id || !entry?.id) return null;

    const dim = size === "tiny" ? 24 : 28;
    const icon = size === "tiny" ? "0.8rem" : "0.95rem";
    const tip = pinned
        ? `En macros P${pinLoc.page + 1}·${pinLoc.slot + 1} · clic para mover`
        : "Añadir a macros";

    return (
        <>
            <CyberTooltip title={tip} placement="top">
                <IconButton
                    size="small"
                    aria-label={tip}
                    aria-pressed={pinned}
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(true);
                    }}
                    sx={{
                        color: pinned ? UI_COLORS.anomaly : "#ffffff",
                        border: `1px solid ${pinned ? UI_COLORS.anomaly : UI_COLORS.border}`,
                        bgcolor: pinned ? `${UI_COLORS.anomaly}18` : "transparent",
                        width: dim,
                        height: dim,
                        "&:hover": {
                            borderColor: UI_COLORS.anomaly,
                            bgcolor: `${UI_COLORS.anomaly}18`,
                            color: UI_COLORS.anomaly,
                        },
                    }}
                >
                    {pinned
                        ? <PushPinIcon sx={{ fontSize: icon }} />
                        : <PushPinOutlinedIcon sx={{ fontSize: icon }} />}
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
