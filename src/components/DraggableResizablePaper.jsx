import { useRef } from "react";
import Paper from "@mui/material/Paper";
import Draggable from "react-draggable";
import { useTheme, useMediaQuery } from "@mui/material";

/**
 * Drop-in PaperComponent for MUI Dialog that adds:
 *   • Drag  — grab any element with className "dialog-drag-handle"
 *   • Resize — native browser resize handle in the bottom-right corner
 *
 * On mobile (< sm breakpoint) drag and resize are disabled so the dialog
 * behaves like a standard sheet.
 *
 * Extra prop (consumed here, not forwarded to DOM):
 *   dragKey  — change this value to reset the drag position (e.g. on minimize/restore)
 */
export default function DraggableResizablePaper({ dragKey, ...props }) {
    const nodeRef = useRef(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    if (isMobile) {
        // On mobile: plain Paper – no drag, no resize handle
        return <Paper {...props} ref={nodeRef} />;
    }

    return (
        <Draggable
            key={dragKey}
            nodeRef={nodeRef}
            handle=".dialog-drag-handle"
            cancel=".dialog-no-drag, button, input, textarea, select, a, [role='button'], [role='listbox']"
        >
            <Paper
                {...props}
                ref={nodeRef}
                style={{
                    ...props.style,
                    resize: "both",
                    overflow: "hidden",
                    minWidth: 320,
                    minHeight: 120,
                }}
            />
        </Draggable>
    );
}
