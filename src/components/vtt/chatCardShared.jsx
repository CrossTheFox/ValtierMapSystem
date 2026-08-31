import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { useAssetUrl } from "../../hooks/useAssetUrl";

/**
 * Small primitives shared by every chat card (`DiceChatCard`, legacy
 * `AbilityChatCard`, `AbilityC2Card`, `ItemChatCard`) — split out of
 * `VttChatPanel.jsx` so `AbilityC2Card.jsx` can import them without a
 * circular `VttChatPanel` <-> `AbilityC2Card` dependency.
 */

/** Format Firestore Timestamp / Date / ms → HH:mm */
function formatChatTime(createdAt) {
    if (!createdAt) return null;
    let d = null;
    if (typeof createdAt?.toDate === "function") d = createdAt.toDate();
    else if (createdAt instanceof Date) d = createdAt;
    else if (typeof createdAt === "number") d = new Date(createdAt);
    else if (typeof createdAt?.seconds === "number") d = new Date(createdAt.seconds * 1000);
    if (!d || Number.isNaN(d.getTime())) return null;
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

export function ChatTime({ createdAt }) {
    const t = formatChatTime(createdAt);
    if (!t) return null;
    return (
        <Box
            component="span"
            sx={{
                fontFamily: "monospace",
                fontSize: "0.52rem",
                color: UI_COLORS.textSecondary,
                ml: 0.75,
                flexShrink: 0,
            }}
        >
            {t}
        </Box>
    );
}

/** Resuelve Storage / local / https desde la caché global (precargada al iniciar). */
export function RawAvatar({ path, name, className = "dc-avatar" }) {
    const src = useAssetUrl(path || null);
    if (src) {
        return (
            <img
                className={className}
                src={src}
                alt={name}
                decoding="sync"
                loading="eager"
            />
        );
    }
    return <span className={className}>{(name || "?").slice(0, 1).toUpperCase()}</span>;
}

export function faceMode(value, sides) {
    const s = Math.max(2, Math.floor(Number(sides) || 20));
    const r = Math.floor(Number(value) || 0);
    if (r === 1) return "fail";
    if (r === s) return "crit";
    return "normal";
}
