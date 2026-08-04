import { Tooltip, tooltipClasses } from "@mui/material";
import { styled } from "@mui/material/styles";
import { UI_COLORS } from "../../constants/uiColors";

const StyledTooltip = styled(({ className, ...props }) => (
    <Tooltip {...props} classes={{ popper: className }} />
))(() => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: UI_COLORS.backgroundSecondary,
        border: `1px solid ${UI_COLORS.accent}55`,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Code', monospace",
        fontSize: "0.62rem",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        lineHeight: 1.35,
        boxShadow: `0 0 14px ${UI_COLORS.accentGlow}`,
        padding: "5px 9px",
        maxWidth: 220,
        userSelect: "none",
        pointerEvents: "none",
    },
    [`& .${tooltipClasses.arrow}`]: {
        color: UI_COLORS.backgroundSecondary,
        pointerEvents: "none",
        "&::before": {
            border: `1px solid ${UI_COLORS.accent}44`,
        },
    },
}));

/**
 * Cyberpunk-styled tooltip — uppercase mono label, neon border/glow.
 * Non-interactive by default so hover does not trap the cursor over small HUD buttons.
 * Pass `title` as string or React node (e.g. label + hint stack).
 */
export default function CyberTooltip({
    children,
    title,
    placement = "bottom",
    disableInteractive = true,
    ...rest
}) {
    if (!title) return children;

    return (
        <StyledTooltip
            title={title}
            placement={placement}
            arrow
            enterDelay={280}
            leaveDelay={0}
            disableInteractive={disableInteractive}
            {...rest}
        >
            {children}
        </StyledTooltip>
    );
}
