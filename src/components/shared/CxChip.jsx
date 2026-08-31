import { Box } from "@mui/material";

/** Skewed condition/status chip — mockup `.seam-full .cond-zone .cx`. */
export function CxChip({ code, color, registerRef, title }) {
    return (
        <Box
            ref={registerRef}
            title={title || code}
            sx={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                px: "10px",
                py: "4px",
                minWidth: "2.75em",
                transform: "skewX(-12deg)",
                border: `1px solid ${color}eb`,
                background: `linear-gradient(180deg, ${color}61 0%, rgba(4,4,10,0.96) 100%)`,
                boxShadow: `inset 0 1px 0 ${color}8c, 0 0 7px ${color}6b`,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                color,
            }}
        >
            <Box
                component="span"
                sx={{
                    display: "block",
                    transform: "skewX(12deg)",
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.58rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    textShadow: `0 0 6px ${color}8c`,
                }}
            >
                {code}
            </Box>
        </Box>
    );
}

/** `+N` overflow chip — mockup `.cx.more`. */
export function CxMoreChip({ n, onClick, registerRef, title }) {
    return (
        <Box
            ref={registerRef}
            component="button"
            type="button"
            onClick={onClick}
            title={title || `${n} más`}
            sx={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                px: "10px",
                py: "4px",
                minWidth: "2.75em",
                cursor: "pointer",
                transform: "skewX(-12deg)",
                border: "1px solid rgba(255,255,255,0.4)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(8,8,14,0.95))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(0,0,0,0.92)",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                color: "rgba(255,255,255,0.7)",
            }}
        >
            <Box
                component="span"
                sx={{
                    display: "block",
                    transform: "skewX(12deg)",
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.58rem",
                    letterSpacing: "0.06em",
                }}
            >
                +{n}
            </Box>
        </Box>
    );
}
