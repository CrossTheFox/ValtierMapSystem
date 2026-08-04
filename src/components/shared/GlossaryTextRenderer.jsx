import { Fragment, useMemo } from "react";
import { Tooltip, Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { buildGlossaryLookup, findGlossaryMatches } from "../../utils/glossaryLookup";

const tooltipSlotProps = {
    tooltip: {
        sx: {
            maxWidth: 320,
            fontSize: "0.75rem",
            fontFamily: "'Fira Sans', sans-serif",
            bgcolor: UI_COLORS.backgroundPrimary,
            color: UI_COLORS.textPrimary,
            border: `1px solid ${UI_COLORS.border}`,
        },
    },
};

/**
 * Renders plain text with glossary term hover tooltips.
 * @param {{ text: string, entities?: object[], sx?: object, component?: string }} props
 */
export default function GlossaryTextRenderer({ text = "", entities = [], sx = {}, component = "span" }) {
    const lookup = useMemo(() => buildGlossaryLookup(entities), [entities]);
    const matches = useMemo(() => findGlossaryMatches(text, lookup), [text, lookup]);

    const textSx = {
        color: UI_COLORS.textPrimary,
        ...sx,
    };

    if (!text) return null;
    if (!matches.length) {
        return (
            <CyberText component={component} sx={textSx}>
                {text}
            </CyberText>
        );
    }

    const parts = [];
    let cursor = 0;

    matches.forEach((m, idx) => {
        if (m.start > cursor) {
            parts.push(<Fragment key={`t-${idx}`}>{text.slice(cursor, m.start)}</Fragment>);
        }
        parts.push(
            <Tooltip
                key={`g-${idx}`}
                title={
                    <Box>
                        <Box sx={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.65rem", color: UI_COLORS.anomaly, mb: 0.5 }}>
                            {m.entry.term.toUpperCase()}
                        </Box>
                        {m.entry.definition}
                    </Box>
                }
                slotProps={tooltipSlotProps}
            >
                <Box
                    component="span"
                    sx={{
                        color: UI_COLORS.anomaly,
                        borderBottom: `1px dashed ${UI_COLORS.anomaly}66`,
                        cursor: "help",
                    }}
                >
                    {text.slice(m.start, m.end)}
                </Box>
            </Tooltip>
        );
        cursor = m.end;
    });

    if (cursor < text.length) {
        parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
    }

    return (
        <CyberText component={component} sx={textSx}>
            {parts}
        </CyberText>
    );
}
