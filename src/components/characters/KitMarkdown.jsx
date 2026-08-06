import ReactMarkdown from "react-markdown";
import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";

const MD_COMPONENTS = {
    p: ({ children }) => (
        <Box
            component="p"
            sx={{
                m: 0,
                mb: 1.1,
                fontFamily: "'Fira Sans', sans-serif",
                fontSize: "0.92rem",
                lineHeight: 1.65,
                color: UI_COLORS.textPrimary,
                "&:last-child": { mb: 0 },
            }}
        >
            {children}
        </Box>
    ),
    strong: ({ children }) => (
        <Box component="strong" sx={{ color: UI_COLORS.accent, fontWeight: 700 }}>
            {children}
        </Box>
    ),
    em: ({ children }) => (
        <Box component="em" sx={{ color: UI_COLORS.anomaly, fontStyle: "italic" }}>
            {children}
        </Box>
    ),
    h1: ({ children }) => (
        <Box
            component="h3"
            sx={{
                m: 0,
                mb: 0.85,
                mt: 1.25,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.95rem",
                letterSpacing: "0.06em",
                color: UI_COLORS.accent,
                "&:first-of-type": { mt: 0 },
            }}
        >
            {children}
        </Box>
    ),
    h2: ({ children }) => (
        <Box
            component="h4"
            sx={{
                m: 0,
                mb: 0.75,
                mt: 1.1,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.85rem",
                letterSpacing: "0.06em",
                color: UI_COLORS.accent,
                "&:first-of-type": { mt: 0 },
            }}
        >
            {children}
        </Box>
    ),
    h3: ({ children }) => (
        <Box
            component="h5"
            sx={{
                m: 0,
                mb: 0.6,
                mt: 1,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.78rem",
                letterSpacing: "0.05em",
                color: UI_COLORS.anomaly,
                "&:first-of-type": { mt: 0 },
            }}
        >
            {children}
        </Box>
    ),
    ul: ({ children }) => (
        <Box
            component="ul"
            sx={{
                m: 0,
                mb: 1.1,
                pl: 2.25,
                color: UI_COLORS.textPrimary,
                "&:last-child": { mb: 0 },
            }}
        >
            {children}
        </Box>
    ),
    ol: ({ children }) => (
        <Box
            component="ol"
            sx={{
                m: 0,
                mb: 1.1,
                pl: 2.25,
                color: UI_COLORS.textPrimary,
                "&:last-child": { mb: 0 },
            }}
        >
            {children}
        </Box>
    ),
    li: ({ children }) => (
        <Box
            component="li"
            sx={{
                mb: 0.45,
                fontFamily: "'Fira Sans', sans-serif",
                fontSize: "0.92rem",
                lineHeight: 1.6,
                color: UI_COLORS.textPrimary,
            }}
        >
            {children}
        </Box>
    ),
    code: ({ children }) => (
        <Box
            component="code"
            sx={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "0.82em",
                color: UI_COLORS.anomaly,
                bgcolor: "rgba(0,242,234,0.08)",
                px: 0.45,
                py: 0.1,
                borderRadius: 0.5,
            }}
        >
            {children}
        </Box>
    ),
    a: ({ href, children }) => (
        <Box
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: UI_COLORS.anomaly, textDecoration: "underline" }}
        >
            {children}
        </Box>
    ),
};

/**
 * Cyber-styled Markdown for Kit dossier read view (Job, Special Mechanic, traits, LB).
 */
export default function KitMarkdown({ content, emptyLabel = "Sin descripción.", sx = {} }) {
    const raw = String(content || "").trim();
    if (!raw) {
        return (
            <Box
                sx={{
                    fontFamily: "'Fira Sans', sans-serif",
                    fontSize: "0.88rem",
                    color: UI_COLORS.textSecondary,
                    opacity: 0.75,
                    ...sx,
                }}
            >
                {emptyLabel}
            </Box>
        );
    }

    return (
        <Box
            sx={{
                fontFamily: "'Fira Sans', sans-serif",
                color: UI_COLORS.textPrimary,
                minWidth: 0,
                ...sx,
            }}
        >
            <ReactMarkdown components={MD_COMPONENTS}>{raw}</ReactMarkdown>
        </Box>
    );
}
