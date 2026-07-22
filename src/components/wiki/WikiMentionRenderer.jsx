import { useMemo } from "react";
import { Box, Tooltip } from "@mui/material";
import ReactMarkdown from "react-markdown";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { ANY_MENTION_REGEX, resolveMentionToken } from "../../utils/wikiSlug";
import { getMentionNavigationHint, isVttMentionId } from "../../utils/wikiNavigation";
import GlossaryTextRenderer from "../shared/GlossaryTextRenderer";

const INLINE_MARKDOWN_COMPONENTS = {
    p: ({ children }) => <>{children}</>,
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
};

const BLOCK_MARKDOWN_COMPONENTS = {
    ...INLINE_MARKDOWN_COMPONENTS,
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
};

/**
 * Renders wiki entity body text (Markdown) with mention tokens as clickable
 * neon links. Supports @[Title](entityId) and legacy @[slug]. Mentions are
 * split out before Markdown so [Title](id) is not parsed as a markdown link.
 */
export default function WikiMentionRenderer({
    body = "",
    onEntityClick,
    entities = [],
    locations = {},
}) {
    const blocks = useMemo(() => splitIntoMarkdownBlocks(body), [body]);

    if (!body) return null;

    return (
        <>
            {blocks.map((block, i) => (
                <MentionBlock
                    key={`block-${i}`}
                    block={block}
                    onEntityClick={onEntityClick}
                    entities={entities}
                    locations={locations}
                />
            ))}
        </>
    );
}

function splitIntoMarkdownBlocks(body) {
    if (!body) return [];
    return body.split(/\n\n+/).filter((b) => b.length > 0);
}

function isBlockMarkdown(text) {
    const t = text.trim();
    return /^#{1,6}\s/m.test(t) || /^[-*+]\s/m.test(t) || /^\d+\.\s/m.test(t);
}

function splitBodyByMentions(body, entities = []) {
    if (!body) return [];

    const segments = [];
    const regex = new RegExp(ANY_MENTION_REGEX.source, "g");
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(body)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", content: body.slice(lastIndex, match.index) });
        }
        const { title, entityId, resolved } = resolveMentionToken(match[1], match[2], entities);
        segments.push({
            type: "mention",
            title,
            entityId,
            resolved: resolved || isVttMentionId(entityId),
        });
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

function MentionBlock({ block, onEntityClick, entities, locations }) {
    const hasMentions = ANY_MENTION_REGEX.test(block);
    ANY_MENTION_REGEX.lastIndex = 0;

    if (!hasMentions) {
        return <MarkdownBlock content={block} />;
    }

    if (!isBlockMarkdown(block)) {
        return (
            <InlineParagraph segments={splitBodyByMentions(block, entities)} onEntityClick={onEntityClick} entities={entities} locations={locations} />
        );
    }

    const lines = block.split("\n");
    return (
        <>
            {lines.map((line, i) => {
                const lineHasMention = ANY_MENTION_REGEX.test(line);
                ANY_MENTION_REGEX.lastIndex = 0;
                if (!lineHasMention || isBlockMarkdown(line)) {
                    return <MarkdownBlock key={`line-${i}`} content={line} />;
                }
                return (
                    <InlineParagraph
                        key={`line-${i}`}
                        segments={splitBodyByMentions(line, entities)}
                        onEntityClick={onEntityClick}
                        entities={entities}
                        locations={locations}
                    />
                );
            })}
        </>
    );
}

function InlineParagraph({ segments, onEntityClick, entities, locations }) {
    return (
        <Box component="p" sx={{ mb: 1.5, lineHeight: 1.7, color: UI_COLORS.textPrimary }}>
            {segments.map((seg, i) =>
                seg.type === "mention" ? (
                    <MentionLink
                        key={`m-${seg.entityId}-${i}`}
                        title={seg.title}
                        entityId={seg.entityId}
                        resolved={seg.resolved}
                        onEntityClick={onEntityClick}
                        entities={entities}
                        locations={locations}
                    />
                ) : (
                    <GlossaryTextRenderer
                        key={`t-${i}`}
                        text={seg.content}
                        entities={entities}
                        component="span"
                        sx={{ display: "inline" }}
                    />
                )
            )}
        </Box>
    );
}

function InlineMarkdown({ content }) {
    if (!content) return null;

    return (
        <ReactMarkdown components={INLINE_MARKDOWN_COMPONENTS}>
            {content}
        </ReactMarkdown>
    );
}

function MarkdownBlock({ content }) {
    if (!content?.trim()) return null;

    return (
        <ReactMarkdown components={BLOCK_MARKDOWN_COMPONENTS}>
            {content}
        </ReactMarkdown>
    );
}

function MentionLink({ title, entityId, resolved = true, onEntityClick, entities, locations }) {
    const hint = useMemo(
        () => (resolved ? getMentionNavigationHint(entityId, { entities, locations }) : "Entidad no encontrada"),
        [entityId, entities, locations, resolved]
    );
    const isVtt = isVttMentionId(entityId);
    const linkColor = resolved ? (isVtt ? UI_COLORS.anomaly : UI_COLORS.accent) : UI_COLORS.textSecondary;
    const bgColor = resolved ? (isVtt ? `${UI_COLORS.anomaly}22` : `${UI_COLORS.accent}22`) : `${UI_COLORS.textSecondary}15`;
    const borderColor = resolved ? (isVtt ? `${UI_COLORS.anomaly}77` : `${UI_COLORS.accent}77`) : `${UI_COLORS.textSecondary}44`;
    const clickable = Boolean(onEntityClick && resolved);

    const link = (
        <Box
            component="span"
            onClick={clickable ? () => onEntityClick(entityId) : undefined}
            sx={{
                display: "inline",
                color: linkColor,
                bgcolor: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: "4px",
                px: 0.55,
                py: 0.05,
                mx: 0.1,
                fontSize: "0.92em",
                fontWeight: 600,
                lineHeight: 1.4,
                verticalAlign: "baseline",
                whiteSpace: "nowrap",
                cursor: clickable ? "pointer" : "default",
                opacity: resolved ? 1 : 0.7,
                transition: "color 0.15s, background-color 0.15s, border-color 0.15s, box-shadow 0.15s",
                "&:hover": clickable
                    ? {
                          color: isVtt ? UI_COLORS.anomaly : UI_COLORS.accentStrong,
                          bgcolor: isVtt ? `${UI_COLORS.anomaly}33` : `${UI_COLORS.accent}33`,
                          borderColor: linkColor,
                          boxShadow: isVtt ? `0 0 8px ${UI_COLORS.anomaly}55` : `0 0 8px ${UI_COLORS.accentGlow}`,
                      }
                    : {},
            }}
        >
            <Box component="span" sx={{ opacity: 0.75, fontSize: "0.85em", fontWeight: 700 }}>@</Box>
            {title}
        </Box>
    );

    if (!clickable) return link;

    return (
        <Tooltip title={hint} arrow placement="top">
            <span style={{ display: "inline" }}>{link}</span>
        </Tooltip>
    );
}
