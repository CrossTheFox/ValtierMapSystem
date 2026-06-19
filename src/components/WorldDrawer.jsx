import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Drawer, IconButton, Box, Divider } from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import BookIcon from "@mui/icons-material/Book";

import { CyberTitle } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import { DEFAULT_WIKI_AREA, WIKI_AREA_IDS } from "../constants/wiki";
import { openWikiOverlay } from "../store/uiSlice";

import WikiNav from "./wiki/WikiNav";

const DRAWER_WIDTH = 320;

const scrollbarSx = {
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-track": { background: UI_COLORS.backgroundPrimary },
    "&::-webkit-scrollbar-thumb": {
        backgroundColor: UI_COLORS.accent,
        borderRadius: "4px",
        opacity: 0.6,
    },
};

export default function WorldDrawer() {
    const dispatch = useDispatch();

    const [open, setOpen] = useState(false);
    const [yOffset, setYOffset] = useState(100);
    const [dragging, setDragging] = useState(false);

    const [activeWikiArea, setActiveWikiArea] = useState(DEFAULT_WIKI_AREA);

    const wikiOverlay = useSelector((s) => s.ui.wikiOverlay);

    useEffect(() => {
        if (wikiOverlay.open && wikiOverlay.areaFilter) {
            setActiveWikiArea(wikiOverlay.areaFilter);
        }
    }, [wikiOverlay.open, wikiOverlay.areaFilter]);

    // ── Drag handle vertical positioning ─────────────────────────────────
    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setDragging(true);

        const startY = e.clientY - yOffset;

        const onMove = (ev) => {
            const next = ev.clientY - startY;
            setYOffset(Math.max(20, Math.min(window.innerHeight - 140, next)));
        };
        const onUp = () => {
            setDragging(false);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    const toggleDrawer = () => {
        if (!dragging) setOpen((prev) => !prev);
    };

    // All areas open the NarrativeWikiOverlay filtered by area.
    const handleAreaChange = (areaId) => {
        setActiveWikiArea(areaId);
        dispatch(openWikiOverlay({ mode: "list", areaFilter: areaId }));
        setOpen(false);
    };

    return (
        <>
            {/* ── Drag tab / handle ── */}
            <Box
                onMouseDown={handleMouseDown}
                sx={{
                    pointerEvents: "auto",
                    position: "fixed",
                    top: yOffset,
                    left: open ? DRAWER_WIDTH : 0,
                    width: 44,
                    height: 120,
                    backgroundColor: UI_COLORS.backgroundSecondary,
                    borderRadius: "0 8px 8px 0",
                    zIndex: 1300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 15px ${UI_COLORS.accentGlow}`,
                    border: `1px solid ${UI_COLORS.accent}66`,
                    borderLeft: "none",
                    transition: "left 225ms cubic-bezier(0, 0, 0.2, 1)",
                    cursor: dragging ? "grabbing" : "grab",
                }}
            >
                <IconButton onClick={toggleDrawer} size="small" sx={{ pointerEvents: "auto" }}>
                    {open ? (
                        <MenuBookIcon sx={{ color: UI_COLORS.accent }} />
                    ) : (
                        <BookIcon sx={{ color: UI_COLORS.accent }} />
                    )}
                </IconButton>
            </Box>

            {/* ── Persistent drawer ── */}
            <Drawer
                anchor="left"
                open={open}
                variant="persistent"
                PaperProps={{
                    sx: {
                        width: DRAWER_WIDTH,
                        backgroundColor: UI_COLORS.backgroundPrimary,
                        color: UI_COLORS.textPrimary,
                        borderRight: `1px solid ${UI_COLORS.border}`,
                        overflowX: "hidden",
                        overflowY: "auto",
                        pointerEvents: "auto",
                        ...scrollbarSx,
                    },
                }}
            >
                <Box sx={{ p: 2, mt: 2 }}>
                    <CyberTitle
                        variant="h6"
                        sx={{ color: UI_COLORS.accent, mb: 1, letterSpacing: 2 }}
                    >
                        WORLD_ARCHIVE
                    </CyberTitle>

                    <Divider sx={{ bgcolor: UI_COLORS.border, mb: 2 }} />

                    <WikiNav
                        activeArea={activeWikiArea}
                        onAreaChange={handleAreaChange}
                    />
                </Box>
            </Drawer>
        </>
    );
}

