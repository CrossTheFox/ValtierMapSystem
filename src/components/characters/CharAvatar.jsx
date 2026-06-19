import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import { UI_COLORS } from "../../constants/uiColors";
import { avatarBorderSx } from "./characterBadges";

async function resolveImageUrl(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return loadFirebaseAsset(path);
}

export default function CharAvatar({ imagePath, name, size = 48, status = "alive" }) {
    const [url, setUrl] = useState(() => getCachedUrl(imagePath) || null);

    useEffect(() => {
        if (!imagePath) {
            setUrl(null);
            return;
        }
        const cached = getCachedUrl(imagePath);
        if (cached) {
            setUrl(cached);
            return;
        }
        let cancelled = false;
        resolveImageUrl(imagePath)
            .then((resolved) => { if (!cancelled) setUrl(resolved); })
            .catch(() => { if (!cancelled) setUrl(null); });
        return () => { cancelled = true; };
    }, [imagePath]);

    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: "50%",
                bgcolor: "#050508",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                ...avatarBorderSx(status),
            }}
        >
            {url ? (
                <Box
                    component="img"
                    src={url}
                    alt={name}
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
            ) : (
                <PersonIcon sx={{ fontSize: size * 0.45, color: UI_COLORS.textSecondary }} />
            )}
        </Box>
    );
}
