import { useDispatch, useSelector } from "react-redux";
import {
    Paper,
    Typography,
    IconButton,
    Box,
    Slider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Draggable from "react-draggable";
import { closeLocation } from "../store/uiSlice";
import { useRef, useState } from "react";

export default function LocationInfoCard() {
    const location = useSelector((s) => s.ui.selectedLocation);
    const dispatch = useDispatch();
    const [scale, setScale] = useState(1);

    const nodeRef = useRef(null); // 🔥 CLAVE

    if (!location) return null;

    return (
        <Draggable
            nodeRef={nodeRef}
            handle=".drag-handle"
        >
            <Paper
                ref={nodeRef} // 🔥 CLAVE
                elevation={12}
                sx={{
                    position: "fixed",
                    top: 160,
                    left: 380,
                    width: 420,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    backgroundColor: "#12121a",
                    color: "#fff",
                    zIndex: 100002,
                    pointerEvents: "auto",
                }}
            >
                {/* HEADER */}
                <Box
                    className="drag-handle"
                    sx={{
                        cursor: "grab",
                        px: 2,
                        py: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #2a2a3d",
                        backgroundColor: "#1a1a2a",
                    }}
                >
                    <Typography variant="subtitle1">
                        {location.name}
                    </Typography>

                    <IconButton
                        size="small"
                        onClick={() => dispatch(closeLocation())}
                    >
                        <CloseIcon sx={{ color: "#ff66ff" }} />
                    </IconButton>
                </Box>

                {/* CONTENT */}
                <Box sx={{ p: 2, maxHeight: 300, overflowY: "auto" }}>
                    <Typography
                        variant="body2"
                        sx={{ whiteSpace: "pre-wrap" }}
                    >
                        {location.history || "No history available."}
                    </Typography>
                </Box>

                {/* FOOTER */}
                <Box
                    sx={{
                        px: 2,
                        py: 1,
                        borderTop: "1px solid #2a2a3d",
                        backgroundColor: "#1a1a2a",
                    }}
                >
                    <Typography variant="caption">
                        UI Scale
                    </Typography>
                    <Slider
                        size="small"
                        min={0.8}
                        max={1.4}
                        step={0.05}
                        value={scale}
                        onChange={(_, v) => setScale(v)}
                    />
                </Box>
            </Paper>
        </Draggable>
    );
}
