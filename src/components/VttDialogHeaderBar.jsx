import { Box } from "@mui/material";
import { getVttDialogHeaderSx } from "./VttDialogHeader";

/**
 * Standard VTT dialog header grid: left slot | centered title | right controls.
 * Optional `bottom` row for search/filters (archive, etc.).
 */
export default function VttDialogHeaderBar({
    left = null,
    center,
    right,
    bottom = null,
    isFullscreen = false,
    className = "dialog-drag-handle",
}) {
    return (
        <Box
            className={className}
            sx={getVttDialogHeaderSx({ isFullscreen })}
        >
            <Box sx={{ display: "flex", flexDirection: "column", gap: bottom ? 0.375 : 0, flex: 1, minWidth: 0, width: "100%" }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        gap: 0.75,
                        minHeight: 30,
                        width: "100%",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 0.35,
                            minWidth: 0,
                        }}
                    >
                        {left}
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            px: 0.5,
                        }}
                    >
                        {center}
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 0.25,
                            minWidth: 0,
                        }}
                    >
                        {right}
                    </Box>
                </Box>
                {bottom}
            </Box>
        </Box>
    );
}
