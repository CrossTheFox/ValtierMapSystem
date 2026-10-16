/**
 * Review card pinned beside a reacting ficha on the map. Same rows and buttons as
 * the side panel, so a decision taken here shows there at once.
 */

import { useEffect, useRef, useState } from "react";
import { Box, Collapse } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { reviewCounts } from "../../../utils/labImpactReview";
import {
    ArchetypePill,
    GroupActions,
    ProgressBar,
    ReviewItemRow,
    SealPill,
    SealReasons,
    TypeBadge,
    WavePill,
} from "./LabReviewParts";
import { SANS, TITLE } from "./labReviewTokens";

export default function LabReviewCard({ group, decisions, onDecide, onAcceptGroup, onRejectGroup, canWrite, pin, onClose }) {
    const ref = useRef(null);
    const [whyOpen, setWhyOpen] = useState(false);
    const counts = reviewCounts(group.items, decisions);

    useEffect(() => {
        if (!ref.current || !group.entityId) return undefined;
        return pin?.(ref.current, group.entityId);
    }, [pin, group.entityId]);

    return (
        <Box
            ref={ref}
            role="dialog"
            aria-label={`Revisión de ${group.entityTitle}`}
            data-testid="lab-review-card"
            onPointerDown={(event) => event.stopPropagation()}
            sx={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 7,
                width: 310,
                maxHeight: "min(56vh, 520px)",
                overflow: "auto",
                visibility: "hidden",
                color: "#ffffff",
                borderRadius: "8px",
                border: `1px solid ${group.seal.color}88`,
                borderTop: `3px solid ${group.seal.color}`,
                background: "rgba(8,8,14,0.97)",
                backdropFilter: "blur(10px)",
                boxShadow: `0 18px 42px rgba(0,0,0,0.6), 0 0 22px ${group.seal.color}2e`,
                willChange: "transform",
                "@keyframes labCardIn": {
                    from: { opacity: 0, clipPath: "inset(0 0 100% 0)" },
                    to: { opacity: 1, clipPath: "inset(0 0 0 0)" },
                },
                animation: "labCardIn .28s cubic-bezier(.16,1,.3,1) both",
                ...CYBER_SCROLL_STYLE,
            }}
        >
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", p: "10px 10px 6px", position: "sticky", top: 0, background: "rgba(8,8,14,0.98)", zIndex: 1 }}>
                <TypeBadge type={group.entityType} size={34} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontFamily: TITLE, fontSize: "11px", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {group.entityTitle}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.4 }}>
                        <SealPill seal={group.seal} />
                        <WavePill wave={group.wave} />
                        <ArchetypePill archetype={group.archetype} collective={group.collective} />
                    </Box>
                </Box>
                <Box
                    component="button"
                    type="button"
                    aria-label="Cerrar revisión"
                    onClick={onClose}
                    sx={{ p: 0.25, border: 0, background: "none", color: UI_COLORS.textSecondary, cursor: "pointer", display: "grid", "&:hover": { color: "#ffffff" } }}
                >
                    <CloseIcon sx={{ fontSize: 16 }} />
                </Box>
            </Box>
            <Box sx={{ px: 1.25, pb: 1.25 }}>
                <ProgressBar counts={counts} />
                <Box
                    component="button"
                    type="button"
                    aria-expanded={whyOpen}
                    onClick={() => setWhyOpen((v) => !v)}
                    sx={{
                        mt: 0.75,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                        p: 0,
                        border: 0,
                        background: "none",
                        color: group.seal.color,
                        cursor: "pointer",
                        fontFamily: SANS,
                        fontSize: "11.5px",
                        textDecoration: "underline dotted",
                        textUnderlineOffset: "3px",
                    }}
                >
                    ¿Por qué {group.seal.label}?
                    <ExpandMoreIcon sx={{ fontSize: 14, transition: "transform .2s", transform: whyOpen ? "rotate(180deg)" : "none" }} />
                </Box>
                <Collapse in={whyOpen} timeout={160}>
                    <SealReasons seal={group.seal} dense />
                </Collapse>
                <Box sx={{ mt: 0.75 }}>
                    {group.items.map((item, index) => (
                        <ReviewItemRow
                            key={item.key}
                            item={item}
                            index={index}
                            decisions={decisions}
                            onDecide={onDecide}
                            canWrite={canWrite}
                            dense
                        />
                    ))}
                </Box>
                <Box sx={{ mt: 0.85 }}>
                    <GroupActions counts={counts} canWrite={canWrite} onAccept={() => onAcceptGroup(group.key)} onReject={() => onRejectGroup(group.key)} />
                </Box>
            </Box>
        </Box>
    );
}
