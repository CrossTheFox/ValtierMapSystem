import { Box, Chip, Divider } from "@mui/material";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { getEntityMeta } from "../../utils/wikiCustomFields";
import { formatTimelineDateLabel } from "../../utils/wikiTimeline";
import {
    DIET_LABELS,
    SIZE_CATEGORY_LABELS,
    POPULATION_SCALE_LABELS,
    CHARACTER_KIND_LABELS,
    LOCATION_KIND_LABELS,
    POPULATION_ORDER_LABELS,
    ORGANIZATION_KIND_LABELS,
    ORGANIZATION_SIZE_LABELS,
    RELIC_KIND_LABELS,
    RELIC_POWER_TIER_LABELS,
    IDEOLOGY_KIND_LABELS,
    IDEOLOGY_SPREAD_LABELS,
    MEMBERSHIP_STATUS,
    MEMBER_REF_KIND,
    REACTION_ARCHETYPE_LABELS,
    REACTION_ARCHETYPE_TOOLTIPS,
    NARRATIVE_STATE_LABELS,
    STRESS_RESPONSE_LABELS,
    COLLECTIVE_ARCHETYPE_LABELS,
} from "../../constants/wiki/entityFieldSchemas";

const labelChipSx = {
    height: 22,
    bgcolor: `${UI_COLORS.accent}14`,
    border: `1px solid ${UI_COLORS.accent}44`,
    color: UI_COLORS.accent,
    "& .MuiChip-label": { px: 0.9 },
};

function Field({ label, value }) {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
    return (
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline" }}>
            <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1, minWidth: 96 }}>
                {label}
            </CyberText>
            <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.textPrimary }}>{value}</CyberText>
        </Box>
    );
}

function RefField({ label, id, entities, onEntityClick }) {
    if (!id) return null;
    const title = entities.find((e) => e.id === id)?.title || id;
    return (
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline" }}>
            <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1, minWidth: 96 }}>
                {label}
            </CyberText>
            <CyberText
                onClick={() => onEntityClick?.(id)}
                sx={{ fontSize: "0.82rem", color: UI_COLORS.accent, cursor: "pointer", "&:hover": { textDecoration: "underline", color: UI_COLORS.accentStrong } }}
            >
                {title}
            </CyberText>
        </Box>
    );
}

function MultiRefField({ label, ids = [], entities, onEntityClick }) {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    return (
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline", flexWrap: "wrap" }}>
            <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1, minWidth: 96 }}>
                {label}
            </CyberText>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {ids.map((id) => (
                    <Chip
                        key={id}
                        size="small"
                        onClick={() => onEntityClick?.(id)}
                        label={<CyberText sx={{ fontSize: "0.62rem" }}>{entities.find((e) => e.id === id)?.title || id}</CyberText>}
                        sx={{ ...labelChipSx, height: 18, cursor: "pointer" }}
                    />
                ))}
            </Box>
        </Box>
    );
}

function TagRow({ label, tags = [], color }) {
    if (!Array.isArray(tags) || tags.length === 0) return null;
    return (
        <Box sx={{ display: "flex", gap: 0.75, alignItems: "baseline", flexWrap: "wrap" }}>
            <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1, minWidth: 96 }}>
                {label}
            </CyberText>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {tags.map((t) => (
                    <Chip
                        key={t}
                        size="small"
                        label={<CyberText sx={{ fontSize: "0.62rem" }}>{t}</CyberText>}
                        sx={{ height: 18, bgcolor: `${color || UI_COLORS.anomaly}14`, border: `1px solid ${color || UI_COLORS.anomaly}44`, color: color || UI_COLORS.anomaly }}
                    />
                ))}
            </Box>
        </Box>
    );
}

function statusLabel(status) {
    return status === MEMBERSHIP_STATUS.SOSPECHADO ? "sospechado" : "confirmado";
}

function statusColor(status) {
    return status === MEMBERSHIP_STATUS.SOSPECHADO ? UI_COLORS.accentStrong : UI_COLORS.textSecondary;
}

function Section({ children }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.55,
                mb: 1,
                p: 1,
                bgcolor: UI_COLORS.backgroundPrimary,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
            }}
        >
            {children}
        </Box>
    );
}

/**
 * Read-only structured-fields view rendered in WikiEntityDetail, under the title
 * chips and before the summary.
 */
export default function WikiCustomFieldsView({ entity, entities = [], vttCharacters = [], onEntityClick }) {
    if (!entity) return null;
    const T = WIKI_ENTITY_TYPES;
    const type = entity.entityType;
    const meta = getEntityMeta(entity, type);

    const memberName = (m) => {
        if (m.kind === MEMBER_REF_KIND.VTT) return vttCharacters.find((c) => c.id === m.id)?.name || m.id;
        return entities.find((e) => e.id === m.id)?.title || m.id;
    };

    if (type === T.ESPECIE) {
        const hasAny =
            meta.diet || meta.sizeCategory || meta.populationScale || meta.lifespanTypical ||
            meta.maturityAge != null || meta.lifespanMax != null || meta.homeworldEntityId ||
            (meta.languageEntityIds?.length) || (meta.traitTags?.length) || (meta.iconClassAffinity?.length) || meta.reproductionNotes;
        if (!hasAny) return null;
        return (
            <Section>
                <Field label="Dieta" value={DIET_LABELS[meta.diet]} />
                <Field label="Tamaño" value={SIZE_CATEGORY_LABELS[meta.sizeCategory]} />
                <Field label="Población" value={POPULATION_SCALE_LABELS[meta.populationScale]} />
                <Field label="Longevidad" value={meta.lifespanTypical} />
                <Field label="Madurez" value={meta.maturityAge != null ? `${meta.maturityAge} años` : null} />
                <Field label="Long. máx" value={meta.lifespanMax != null ? `${meta.lifespanMax} años` : null} />
                <RefField label="Origen" id={meta.homeworldEntityId} entities={entities} onEntityClick={onEntityClick} />
                <MultiRefField label="Idiomas" ids={meta.languageEntityIds} entities={entities} onEntityClick={onEntityClick} />
                <TagRow label="Rasgos" tags={meta.traitTags} color={UI_COLORS.accent} />
                <TagRow label="Clases ICON" tags={meta.iconClassAffinity} />
                <Field label="Reproducción" value={meta.reproductionNotes} />
            </Section>
        );
    }

    if (type === T.PERSONAJE) {
        const vtt = entity.linkedVttCharacterId ? vttCharacters.find((c) => c.id === entity.linkedVttCharacterId) : null;
        const orgs = Array.isArray(meta.organizations) ? meta.organizations : [];
        const traits = Array.isArray(meta.narrativeTraits) ? meta.narrativeTraits : [];
        const hasAny =
            meta.characterKind || meta.speciesEntityId || meta.birthDate || meta.deathDate ||
            meta.activeEraLabel || meta.occupation || meta.genderPresentation || (meta.titles?.length) || meta.isDeity ||
            orgs.length || vtt || meta.reactionArchetype ||
            meta.narrativeState || meta.stressResponse || traits.length || meta.bondNotes;
        if (!hasAny) return null;
        return (
            <Section>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.55 }}>
                        <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.accent, letterSpacing: 1.2, textTransform: "uppercase", mb: 0.25 }}>
                            Identidad
                        </CyberText>
                        <Field label="Tipo" value={CHARACTER_KIND_LABELS[meta.characterKind]} />
                        <RefField label="Especie" id={meta.speciesEntityId} entities={entities} onEntityClick={onEntityClick} />
                        <Field label="Era" value={meta.activeEraLabel} />
                        <Field label="Ocupación" value={meta.occupation} />
                        <Field label="Género" value={meta.genderPresentation} />
                        {meta.isDeity && <Field label="Naturaleza" value="Deidad" />}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.55 }}>
                        <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.accent, letterSpacing: 1.2, textTransform: "uppercase", mb: 0.25 }}>
                            Cronología
                        </CyberText>
                        <Field label="Nacimiento" value={meta.birthDate ? formatTimelineDateLabel(meta.birthDate) : null} />
                        <Field label="Muerte" value={meta.deathDate ? formatTimelineDateLabel(meta.deathDate) : null} />
                        {vtt?.age != null && vtt.age !== "" && (
                            <Field label="Edad (token)" value={`${vtt.age}`} />
                        )}
                        <RefField label="Nació en" id={meta.birthPlaceEntityId} entities={entities} onEntityClick={onEntityClick} />
                        <RefField label="Murió en" id={meta.deathPlaceEntityId} entities={entities} onEntityClick={onEntityClick} />
                    </Box>
                </Box>
                {(meta.titles?.length > 0) && (
                    <Box sx={{ mt: 0.5 }}>
                        <TagRow label="Títulos" tags={meta.titles} color={UI_COLORS.accent} />
                    </Box>
                )}
                {orgs.length > 0 && (
                    <Box sx={{ mt: 0.5 }}>
                        <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1, mb: 0.35 }}>
                            Organizaciones
                        </CyberText>
                        {orgs.map((m) => (
                            <Box key={m.organizationEntityId} sx={{ display: "flex", gap: 0.75, alignItems: "baseline", mb: 0.25 }}>
                                <CyberText
                                    onClick={() => onEntityClick?.(m.organizationEntityId)}
                                    sx={{ fontSize: "0.8rem", color: UI_COLORS.accent, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                                >
                                    {entities.find((e) => e.id === m.organizationEntityId)?.title || m.organizationEntityId}
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.64rem", color: statusColor(m.status) }}>
                                    {statusLabel(m.status)}{m.role ? ` · ${m.role}` : ""}
                                </CyberText>
                            </Box>
                        ))}
                    </Box>
                )}
                {meta.reactionArchetype && REACTION_ARCHETYPE_LABELS[meta.reactionArchetype] && (
                    <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                        <CyberText sx={{ fontSize: "0.64rem", color: UI_COLORS.textSecondary }}>
                            Arquetipo IA:
                        </CyberText>
                        <Chip
                            label={REACTION_ARCHETYPE_LABELS[meta.reactionArchetype]}
                            size="small"
                            title={REACTION_ARCHETYPE_TOOLTIPS[meta.reactionArchetype] ?? ""}
                            sx={{
                                height: 18,
                                fontSize: "0.6rem",
                                bgcolor: `${UI_COLORS.anomaly}18`,
                                color: UI_COLORS.anomaly,
                                border: `1px solid ${UI_COLORS.anomaly}44`,
                                "& .MuiChip-label": { px: 0.75 },
                            }}
                        />
                    </Box>
                )}
                {(meta.narrativeState || meta.stressResponse || traits.length > 0 || meta.bondNotes) && (
                    <Box sx={{ mt: 0.75, pt: 0.75, borderTop: `1px solid ${UI_COLORS.border}` }}>
                        <CyberText sx={{ fontSize: "0.64rem", color: UI_COLORS.anomaly, textTransform: "uppercase", letterSpacing: 1, mb: 0.35 }}>
                            Memoria de personalidad
                        </CyberText>
                        <Field label="Estado" value={NARRATIVE_STATE_LABELS[meta.narrativeState]} />
                        <Field label="Estrés" value={STRESS_RESPONSE_LABELS[meta.stressResponse]} />
                        {traits.length > 0 && <TagRow label="Rasgos" tags={traits} color={UI_COLORS.accent} />}
                        <Field label="Anclas" value={meta.bondNotes} />
                    </Box>
                )}
            </Section>
        );
    }

    if (type === T.LOCACION) {
        const hasAny =
            meta.locationKind || meta.populationOrder || meta.parentLocationEntityId || meta.climate ||
            meta.foundingDate || meta.destroyedDate || meta.dominantLanguageEntityId || meta.dominantSpeciesEntityId ||
            meta.dominantIdeologyEntityId || meta.isSettlement || meta.collectiveArchetype || meta.collectiveMood;
        if (!hasAny) return null;
        return (
            <Section>
                <Field label="Tipo" value={LOCATION_KIND_LABELS[meta.locationKind]} />
                <Field label="Población" value={POPULATION_ORDER_LABELS[meta.populationOrder]} />
                <RefField label="Parte de" id={meta.parentLocationEntityId} entities={entities} onEntityClick={onEntityClick} />
                <Field label="Clima" value={meta.climate} />
                <Field label="Fundación" value={meta.foundingDate ? formatTimelineDateLabel(meta.foundingDate) : null} />
                <Field label="Destrucción" value={meta.destroyedDate ? formatTimelineDateLabel(meta.destroyedDate) : null} />
                <RefField label="Idioma pred." id={meta.dominantLanguageEntityId} entities={entities} onEntityClick={onEntityClick} />
                <RefField label="Ideología dom." id={meta.dominantIdeologyEntityId} entities={entities} onEntityClick={onEntityClick} />
                <RefField label="Especie dom." id={meta.dominantSpeciesEntityId} entities={entities} onEntityClick={onEntityClick} />
                {meta.isSettlement && <Field label="" value="Asentamiento habitable" />}
                {(meta.collectiveArchetype || meta.collectiveMood) && (
                    <>
                        <Divider sx={{ bgcolor: UI_COLORS.border, my: 0.5 }} />
                        <Field label="Temperamento" value={COLLECTIVE_ARCHETYPE_LABELS[meta.collectiveArchetype]} />
                        <Field label="Estado" value={meta.collectiveMood} />
                    </>
                )}
            </Section>
        );
    }

    if (type === T.ORGANIZACION) {
        const members = Array.isArray(meta.members) ? meta.members : [];
        const hasAny =
            meta.organizationKind || meta.size || meta.headquartersEntityId || meta.motto ||
            meta.foundedDate || meta.dissolvedDate || meta.publicFace || (meta.symbology?.length) || members.length ||
            meta.collectiveArchetype || meta.collectiveMood;
        if (!hasAny) return null;
        return (
            <Section>
                <Field label="Tipo" value={ORGANIZATION_KIND_LABELS[meta.organizationKind]} />
                <Field label="Alcance" value={ORGANIZATION_SIZE_LABELS[meta.size]} />
                <RefField label="Sede" id={meta.headquartersEntityId} entities={entities} onEntityClick={onEntityClick} />
                <Field label="Lema" value={meta.motto} />
                <Field label="Fundación" value={meta.foundedDate ? formatTimelineDateLabel(meta.foundedDate) : null} />
                <Field label="Disolución" value={meta.dissolvedDate ? formatTimelineDateLabel(meta.dissolvedDate) : null} />
                <Field label="Cara pública" value={meta.publicFace} />
                <TagRow label="Simbología" tags={meta.symbology} color={UI_COLORS.accent} />
                {members.length > 0 && (
                    <>
                        <Divider sx={{ bgcolor: UI_COLORS.border, my: 0.5 }} />
                        <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>
                            Integrantes
                        </CyberText>
                        {members.map((m) => (
                            <Box key={`${m.kind}:${m.id}`} sx={{ display: "flex", gap: 0.75, alignItems: "baseline" }}>
                                <Chip size="small" label={<CyberText sx={{ fontSize: "0.52rem" }}>{m.kind === MEMBER_REF_KIND.VTT ? "VTT" : "WIKI"}</CyberText>} sx={{ height: 15, bgcolor: `${UI_COLORS.anomaly}18`, color: UI_COLORS.anomaly }} />
                                <CyberText
                                    onClick={() => m.kind === MEMBER_REF_KIND.WIKI && onEntityClick?.(m.id)}
                                    sx={{ fontSize: "0.8rem", color: m.kind === MEMBER_REF_KIND.WIKI ? UI_COLORS.accent : UI_COLORS.textPrimary, cursor: m.kind === MEMBER_REF_KIND.WIKI ? "pointer" : "default" }}
                                >
                                    {memberName(m)}
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.64rem", color: statusColor(m.status) }}>
                                    {statusLabel(m.status)}{m.role ? ` · ${m.role}` : ""}
                                </CyberText>
                            </Box>
                        ))}
                    </>
                )}
                {(meta.collectiveArchetype || meta.collectiveMood) && (
                    <>
                        <Divider sx={{ bgcolor: UI_COLORS.border, my: 0.5 }} />
                        <Field label="Temperamento" value={COLLECTIVE_ARCHETYPE_LABELS[meta.collectiveArchetype]} />
                        <Field label="Estado" value={meta.collectiveMood} />
                    </>
                )}
            </Section>
        );
    }

    if (type === T.RELIQUIA) {
        const hasAny =
            meta.relicKind || meta.powerTier || meta.creatorEntityId || meta.currentHolderEntityId ||
            meta.originLocationEntityId || meta.creationDate || meta.activationCondition || meta.isUnique;
        if (!hasAny) return null;
        return (
            <Section>
                <Field label="Tipo" value={RELIC_KIND_LABELS[meta.relicKind]} />
                <Field label="Poder" value={RELIC_POWER_TIER_LABELS[meta.powerTier]} />
                {meta.isUnique && <Field label="" value="Única en el mundo" />}
                <RefField label="Creador" id={meta.creatorEntityId} entities={entities} onEntityClick={onEntityClick} />
                <RefField label="Portador" id={meta.currentHolderEntityId} entities={entities} onEntityClick={onEntityClick} />
                <RefField label="Origen" id={meta.originLocationEntityId} entities={entities} onEntityClick={onEntityClick} />
                <Field label="Creación" value={meta.creationDate ? formatTimelineDateLabel(meta.creationDate) : null} />
                <Field label="Activación" value={meta.activationCondition} />
            </Section>
        );
    }

    if (type === T.IDEOLOGIA) {
        const hasAny =
            meta.ideologyKind || meta.spread || meta.alignmentTone || meta.primaryDeityFigureEntityId ||
            meta.holyLanguageEntityId || (meta.tabooTags?.length) || (meta.practiceTags?.length);
        if (!hasAny) return null;
        return (
            <Section>
                <Field label="Tipo" value={IDEOLOGY_KIND_LABELS[meta.ideologyKind]} />
                <Field label="Difusión" value={IDEOLOGY_SPREAD_LABELS[meta.spread]} />
                <Field label="Talante" value={meta.alignmentTone} />
                <RefField label="Figura" id={meta.primaryDeityFigureEntityId} entities={entities} onEntityClick={onEntityClick} />
                <RefField label="Idioma litúrg." id={meta.holyLanguageEntityId} entities={entities} onEntityClick={onEntityClick} />
                <TagRow label="Tabúes" tags={meta.tabooTags} color={UI_COLORS.accentStrong} />
                <TagRow label="Prácticas" tags={meta.practiceTags} />
            </Section>
        );
    }

    return null;
}
