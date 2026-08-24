import { IconButton } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { UI_COLORS } from "../../../constants/uiColors";
import CyberTooltip from "../../customs/CyberTooltip";

/** Small "send to chat" icon button shared across KIT cards/folds. */
export default function CallChatBtn({ onClick, disabled = false }) {
    return (
        <CyberTooltip title="Llamar al chat" placement="top">
            <IconButton
                size="small"
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.(e);
                }}
                aria-label="Llamar al chat"
                sx={{
                    width: 26,
                    height: 26,
                    color: UI_COLORS.anomaly,
                    border: `1px solid ${UI_COLORS.anomaly}55`,
                    bgcolor: "rgba(0,0,0,0.35)",
                    "&:hover": {
                        borderColor: UI_COLORS.anomaly,
                        bgcolor: `${UI_COLORS.anomaly}18`,
                    },
                    "&.Mui-disabled": { opacity: 0.35 },
                }}
            >
                <ChatBubbleOutlineIcon sx={{ fontSize: "0.9rem" }} />
            </IconButton>
        </CyberTooltip>
    );
}
