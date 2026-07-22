import { Box } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { UI_COLORS } from "../../constants/uiColors";
import { avatarBorderSx } from "./characterBadges";
import { tokenCropCss } from "../../utils/tokenImageFit";

export default function CharAvatar({ imagePath, name, size = 48, status = "alive", crop = null }) {
    const url = useAssetUrl(imagePath);

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
                    decoding="sync"
                    loading="eager"
                    sx={{ width: "100%", height: "100%", ...tokenCropCss(crop) }}
                />
            ) : (
                <PersonIcon sx={{ fontSize: size * 0.45, color: UI_COLORS.textSecondary }} />
            )}
        </Box>
    );
}
