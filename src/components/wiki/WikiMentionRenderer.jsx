import { useMemo } from "react";
import { Box, Tooltip } from "@mui/material";
import ReactMarkdown from "react-markdown";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { MENTION_REGEX } from "../../utils/wikiSlug";
import { getMentionNavigationHint } from "../../utils/wikiNavigation";

/**
 * Renders wiki entity body text (Markdown) with @[Title](entityId) tokens
 * as clickable neon links. Mentions are split out before Markdown so
 * [Title](id) is not parsed as a standard markdown link.
 */
export default function WikiMentionRenderer({
    body = "",
    onEntityClick,
    entities = [],
    locations = {},
}) {
    const segments = useMemo(() => splitBodyByMentions(body), [body]);

    if (!body) return null;

    return (
        <>
            {segments.map((seg, i) =>
                seg.type === "mention" ? (
                    <MentionLink
                        key={`m-${seg.entityId}-${i}`}
                        title={seg.title}
                        entityId={seg.entityId}
                        onEntityClick={onEntityClick}
                        entities={entities}
                        locations={locations}
                    />
                ) : (
                    <MarkdownBlock key={`md-${i}`} content={seg.content} />
                )
            )}
        </>
    );
}

function splitBodyByMentions(body) {
    if (!body) return [];

    const segments = [];
    const regex = new RegExp(MENTION_REGEX.source, "g");
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(body)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", content: body.slice(lastIndex, match.index) });
        }
        segments.push({ type: "mention", title: match[1], entityId: match[2] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < body.length) {
        segments.push({ type: "text", content: body.slice(lastIndex) });
    }

    if (segments.length === 0) {
        segments.push({ type: "text", content: body });
    }

    return segments;
}

function MarkdownBlock({ content }) {
    if (!content?.trim()) return null;

    return (
        <ReactMarkdown
            components={{
                p: ({ children }) => (
                    <Box component="p" sx={{ mb: 1.5, lineHeight: 1.7, color: UI_COLORS.textPrimary }}>
                        {children}
                    </Box>
                ),
                h1: ({ children }) => (
                    <CyberText component="h1" sx={{ fontSize: "1.3rem", color: UI_COLORS.accent, mb: 1, mt: 2, fontWeight: 700 }}>
                        {children}
                    </CyberText>
                ),
                h2: ({ children }) => (
                    <CyberText component="h2" sx={{ fontSize: "1.1rem", color: UI_COLORS.accent, mb: 0.75, mt: 1.5, fontWeight: 600 }}>
                        {children}
                    </CyberText>
                ),
                h3: ({ children }) => (
                    <CyberText component="h3" sx={{ fontSize: "0.95rem", color: UI_COLORS.anomaly, mb: 0.5, mt: 1, fontWeight: 600 }}>
                        {children}
                    </CyberText>
                ),
                li: ({ children }) => (
                    <Box component="li" sx={{ mb: 0.5, color: UI_COLORS.textPrimary }}>
                        {children}
                    </Box>
                ),
                strong: ({ children }) => (
                    <Box component="strong" sx={{ color: UI_COLORS.accent, fontWeight: 700, display: "inline" }}>
                        {children}
                    </Box>
                ),
                em: ({ children }) => (
                    <Box component="em" sx={{ color: UI_COLORS.anomaly, fontStyle: "italic", display: "inline" }}>
                        {children}
                    </Box>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

function MentionLink({ title, entityId, onEntityClick, entities, locations }) {
    const hint = useMemo(
        () => getMentionNavigationHint(entityId, { entities, locations }),
        [entityId, entities, locations]
    );
    const isVtt = entityId?.startsWith?.("vtt-");
    const linkColor = isVtt ? UI_COLORS.anomaly : UI_COLORS.accent;

    const link = (
        <Box
            component="span"
            onClick={() => onEntityClick?.(entityId)}
            sx={{
                color: linkColor,
                cursor: onEntityClick ? "pointer" : "default",
                borderBottom: `1px solid ${linkColor}66`,
                transition: "color 0.15s, border-bottom-color 0.15s",
                "&:hover": onEntityClick
                    ? {
                          color: isVtt ? UI_COLORS.anomaly : UI_COLORS.accentStrong,
                          borderBottomColor: linkColor,
                          textShadow: isVtt ? `0 0 8px ${UI_COLORS.anomaly}88` : `0 0 8px ${UI_COLORS.accentGlow}`,
                      }
                    : {},
            }}
        >
            {title}
        </Box>
    );

    if (!onEntityClick) return link;

    return (
        <Tooltip title={hint} arrow placement="top">
            <span style={{ display: "inline" }}>{link}</span>
        </Tooltip>
    );
}
