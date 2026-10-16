import { useSelector } from "react-redux";
import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";
import {
    getRelationDisplayLabel,
    isAffinityRelation,
} from "../../constants/wikiRelationTypes";
import { mentionExcerpt } from "../../utils/wikiSlug";
import SyncMeterReadout from "./SyncMeterReadout";

/**
 * Read-only relation ledger for an Archive article.
 * Structural facts have no sync bar. Affinity shows −10…+10.
 * The other entity's name opens that ficha.
 */
export function ArchiveRelationLedger({ entity, entities = [], onEntityClick }) {
    const relations = useSelector((s) => s.wiki.relations ?? []);
    const byId = new Map(entities.map((e) => [e.id, e]));
    const rows = !entity?.id
        ? []
        : relations
            .filter((rel) => rel.fromEntityId === entity.id || rel.toEntityId === entity.id)
            .map((rel) => {
                const outgoing = rel.fromEntityId === entity.id;
                const otherId = outgoing ? rel.toEntityId : rel.fromEntityId;
                const other = byId.get(otherId);
                const fromType = byId.get(rel.fromEntityId)?.entityType ?? null;
                const toType = byId.get(rel.toEntityId)?.entityType ?? null;
                return {
                    id: rel.id,
                    otherId,
                    otherTitle: other?.title || "Ficha sin título",
                    otherType: other?.entityType,
                    label: getRelationDisplayLabel(rel.relationType, outgoing),
                    note: rel.label || "",
                    strength: Number.isFinite(rel.strength) ? rel.strength : 0,
                    affinity: isAffinityRelation({
                        relationType: rel.relationType,
                        fromEntityType: fromType,
                        toEntityType: toType,
                    }),
                };
            });

    const facts = rows.filter((r) => !r.affinity);
    const affinity = rows.filter((r) => r.affinity);
    if (!rows.length) return null;

    return (
        <Box sx={{ mt: 2.25 }}>
            {facts.length > 0 && (
                <LedgerGroup title="HECHOS" rows={facts} onEntityClick={onEntityClick} />
            )}
            {affinity.length > 0 && (
                <LedgerGroup title="AFINIDAD" rows={affinity} onEntityClick={onEntityClick} showSync />
            )}
        </Box>
    );
}

function LedgerGroup({ title, rows, onEntityClick, showSync = false }) {
    return (
        <Box sx={{ mb: 1.5 }}>
            <CyberText
                sx={{
                    fontSize: "0.55rem",
                    color: UI_COLORS.textSecondary,
                    letterSpacing: "0.14em",
                    display: "block",
                    mb: 0.6,
                }}
            >
                {title}
            </CyberText>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                {rows.map((row) => (
                    <Box
                        key={row.id}
                        sx={{
                            px: 1,
                            py: 0.75,
                            borderRadius: "4px",
                            border: `1px solid ${UI_COLORS.border}`,
                            bgcolor: "rgba(8,8,14,0.55)",
                        }}
                    >
                        <CyberText sx={{ fontSize: "0.58rem", letterSpacing: "0.08em", color: UI_COLORS.anomaly }}>
                            {row.label}
                        </CyberText>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => onEntityClick?.(row.otherId)}
                            sx={{
                                display: "block",
                                mt: 0.2,
                                p: 0,
                                border: 0,
                                bgcolor: "transparent",
                                cursor: onEntityClick ? "pointer" : "default",
                                textAlign: "left",
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.84rem",
                                fontWeight: 600,
                                "&:hover": onEntityClick ? { color: UI_COLORS.accent } : {},
                            }}
                        >
                            {row.otherTitle}
                        </Box>
                        {row.otherType && (
                            <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary }}>
                                {WIKI_ENTITY_TYPE_LABELS[row.otherType] || row.otherType}
                            </CyberText>
                        )}
                        {row.note && (
                            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mt: 0.35, fontStyle: "italic" }}>
                                {row.note}
                            </CyberText>
                        )}
                        {showSync && <SyncMeterReadout strength={row.strength} />}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

/**
 * Backlink cards: type, title, excerpt of the sentence that @-mentions this article.
 * Click opens that article and asks the detail view to scroll to the mention.
 */
export function ArchiveMentionedIn({ entity, entities = [], onEntityClick }) {
    const cards = !entity?.id
        ? []
        : entities
            .filter((e) => e.id !== entity.id && e.body)
            .map((e) => {
                const excerpt = mentionExcerpt(e.body, entity.id);
                if (!excerpt) return null;
                return {
                    id: e.id,
                    title: e.title || "Sin título",
                    typeLabel: WIKI_ENTITY_TYPE_LABELS[e.entityType] || e.entityType || "",
                    excerpt,
                };
            })
            .filter(Boolean);

    if (!cards.length) return null;

    return (
        <Box sx={{ mt: 2 }}>
            <CyberText
                sx={{
                    fontSize: "0.55rem",
                    color: UI_COLORS.textSecondary,
                    letterSpacing: "0.12em",
                    display: "block",
                    mb: 0.6,
                }}
            >
                MENCIONADO EN
            </CyberText>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                {cards.map((card) => (
                    <Box
                        key={card.id}
                        component="button"
                        type="button"
                        onClick={() => onEntityClick?.(card.id, { highlightMentionOf: entity.id })}
                        sx={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            p: 1,
                            borderRadius: "4px",
                            border: `1px solid ${UI_COLORS.accent}40`,
                            bgcolor: `${UI_COLORS.accent}10`,
                            cursor: onEntityClick ? "pointer" : "default",
                            color: UI_COLORS.textPrimary,
                            "&:hover": onEntityClick ? { borderColor: UI_COLORS.accent, bgcolor: `${UI_COLORS.accent}18` } : {},
                        }}
                    >
                        <CyberText sx={{ fontSize: "0.55rem", letterSpacing: "0.1em", color: UI_COLORS.anomaly }}>
                            {card.typeLabel}
                        </CyberText>
                        <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.textPrimary, fontWeight: 600, mt: 0.15 }}>
                            {card.title}
                        </CyberText>
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mt: 0.35, fontStyle: "italic", lineHeight: 1.45 }}>
                            {card.excerpt}
                        </CyberText>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
