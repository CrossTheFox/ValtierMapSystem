import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";

/**
 * DOM pan/zoom stage. Camera is applied via CSS transform on a ref so pan/zoom
 * does not re-render the briefcase world (1728+ cells used to hitch).
 */
export default function PanZoomBoard({
    children,
    panOnEmpty = true,
    minK = 0.35,
    maxK = 1.55,
    initialK = 0.78,
}) {
    const wrapRef = useRef(null);
    const stageRef = useRef(null);
    const cam = useRef({ x: 18, y: 18, k: initialK });
    const drag = useRef(null);

    const applyCam = () => {
        const el = stageRef.current;
        const c = cam.current;
        if (!el) return;
        el.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.k})`;
    };

    useEffect(() => {
        applyCam();
        const el = wrapRef.current;
        if (!el) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const c = cam.current;
            const nextK = Math.min(maxK, Math.max(minK, c.k * (e.deltaY > 0 ? 0.91 : 1.1)));
            const wx = (mx - c.x) / c.k;
            const wy = (my - c.y) / c.k;
            cam.current = { k: nextK, x: mx - wx * nextK, y: my - wy * nextK };
            applyCam();
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [minK, maxK]);

    const beginPan = (e) => {
        const c = cam.current;
        drag.current = { x: e.clientX, y: e.clientY, ox: c.x, oy: c.y };
    };

    return (
        <Box
            ref={wrapRef}
            sx={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                minHeight: 280,
                overflow: "hidden",
                border: `1px solid ${UI_COLORS.border}`,
                bgcolor: "#07070c",
                cursor: "grab",
                "&:active": { cursor: "grabbing" },
            }}
            onPointerDown={(e) => {
                const middle = e.button === 1;
                const alt = e.button === 0 && e.altKey;
                const onItem = Boolean(e.target?.closest?.("[data-item-cell]"));
                const empty = panOnEmpty && e.button === 0 && !alt && !onItem;
                if (!middle && !alt && !empty) return;
                e.preventDefault();
                beginPan(e);
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
                if (!drag.current) return;
                const d = drag.current;
                cam.current = {
                    ...cam.current,
                    x: d.ox + (e.clientX - d.x),
                    y: d.oy + (e.clientY - d.y),
                };
                applyCam();
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
        >
            <Box
                ref={stageRef}
                sx={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transformOrigin: "0 0",
                    willChange: "transform",
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
