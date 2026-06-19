import { useState } from "react";
import {
    Box,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Switch,
    FormControlLabel,
    IconButton,
    Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import WikiDateInput from "./WikiDateInput";
import {
    DIET_OPTIONS,
    SIZE_CATEGORY_OPTIONS,
    POPULATION_SCALE_OPTIONS,
    CHARACTER_KIND_OPTIONS,
    LOCATION_KIND_OPTIONS,
    getPopulationOrderOptionsForLocationKind,
    POPULATION_MACRO_LOCATION_KINDS,
    ORGANIZATION_KIND_OPTIONS,
    ORGANIZATION_SIZE_OPTIONS,
    EVENT_KIND_OPTIONS,
    EVENT_CERTAINTY_OPTIONS,
    RELIC_KIND_OPTIONS,
    RELIC_POWER_TIER_OPTIONS,
    IDEOLOGY_KIND_OPTIONS,
    IDEOLOGY_SPREAD_OPTIONS,
    MEMBERSHIP_STATUS,
    MEMBERSHIP_STATUS_OPTIONS,
    MEMBER_REF_KIND,
    REACTION_ARCHETYPE_OPTIONS,
    REACTION_ARCHETYPE_TOOLTIPS,
    NARRATIVE_STATE_OPTIONS,
    STRESS_RESPONSE_OPTIONS,
    COLLECTIVE_ARCHETYPE_OPTIONS,
} from "../../constants/wiki/entityFieldSchemas";
import { filterParentLocationCandidates } from "../../constants/wiki/wikiEntityDependencies";

const inputSx = {
    "& .MuiOutlinedInput-root": {
        bgcolor: UI_COLORS.backgroundPrimary,
        color: UI_COLORS.textPrimary,
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: "0.85rem",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.accent}88` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.accent },
    },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary, fontFamily: "'Fira Sans', sans-serif", fontSize: "0.78rem" },
    "& .MuiInputLabel-root.Mui-focused": { color: UI_COLORS.accent },
};

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.82rem",
    bgcolor: UI_COLORS.backgroundPrimary,
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.accent}88` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

const menuProps = {
    PaperProps: { sx: { bgcolor: UI_COLORS.backgroundSecondary, color: UI_COLORS.textPrimary, maxHeight: 280 } },
};

function PanelShell({ title, children }) {
    return (
        <Box
            sx={{
                p: 1.5,
                bgcolor: `${UI_COLORS.accent}08`,
                border: `1px solid ${UI_COLORS.accent}33`,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
            }}
        >
            <CyberTitle variant="caption" sx={{ color: UI_COLORS.accent, letterSpacing: 2, fontSize: "0.65rem" }}>
                {title}
            </CyberTitle>
            {children}
        </Box>
    );
}

function Row({ children }) {
    return <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>{children}</Box>;
}

function EnumSelect({ label, value, options, onChange, minWidth = 160 }) {
    return (
        <FormControl size="small" sx={{ minWidth, flex: 1 }}>
            <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>{label}</InputLabel>
            <Select value={value || ""} onChange={(e) => onChange(e.target.value)} label={label} sx={selectSx} MenuProps={menuProps}>
                <MenuItem value="">
                    <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary }}>—</CyberText>
                </MenuItem>
                {options.map(({ value: v, label: l }) => (
                    <MenuItem key={v} value={v}>
                        <CyberText sx={{ fontSize: "0.8rem" }}>{l}</CyberText>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

function TextRow({ label, value, onChange, minWidth = 180, multiline = false }) {
    return (
        <TextField
            label={label}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            size="small"
            multiline={multiline}
            rows={multiline ? 2 : undefined}
            sx={{ ...inputSx, flex: 1, minWidth }}
        />
    );
}

function NumberRow({ label, value, onChange, width = 120 }) {
    return (
        <TextField
            label={label}
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            size="small"
            sx={{ ...inputSx, width }}
        />
    );
}

function BoolToggle({ label, checked, onChange }) {
    return (
        <FormControlLabel
            control={
                <Switch
                    checked={Boolean(checked)}
                    onChange={(e) => onChange(e.target.checked)}
                    sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: UI_COLORS.accent },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: UI_COLORS.accent },
                    }}
                />
            }
            label={<CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textSecondary }}>{label}</CyberText>}
        />
    );
}

function EntityRefSelect({ label, value, onChange, entities, entityType, minWidth = 180 }) {
    const candidates = entities.filter((e) => e.entityType === entityType);
    return (
        <FormControl size="small" sx={{ minWidth, flex: 1 }}>
            <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>{label}</InputLabel>
            <Select value={value || ""} onChange={(e) => onChange(e.target.value || null)} label={label} sx={selectSx} MenuProps={menuProps}>
                <MenuItem value="">
                    <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary }}>— Ninguna —</CyberText>
                </MenuItem>
                {candidates.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                        <CyberText sx={{ fontSize: "0.8rem" }}>{e.title}</CyberText>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

function EntityRefMultiSelect({ label, value = [], onChange, entities, entityType, minWidth = 200 }) {
    const candidates = entities.filter((e) => e.entityType === entityType);
    const titleOf = (id) => entities.find((e) => e.id === id)?.title || id;
    return (
        <FormControl size="small" sx={{ minWidth, flex: 1 }}>
            <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>{label}</InputLabel>
            <Select
                multiple
                value={Array.isArray(value) ? value : []}
                onChange={(e) => onChange(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
                label={label}
                sx={selectSx}
                MenuProps={menuProps}
                renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((id) => (
                            <Chip key={id} size="small" label={<CyberText sx={{ fontSize: "0.6rem" }}>{titleOf(id)}</CyberText>} sx={{ height: 18, bgcolor: `${UI_COLORS.accent}18` }} />
                        ))}
                    </Box>
                )}
            >
                {candidates.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                        <CyberText sx={{ fontSize: "0.8rem" }}>{e.title}</CyberText>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

function TagArray({ label, value = [], onChange, placeholder }) {
    const [input, setInput] = useState("");
    const tags = Array.isArray(value) ? value : [];
    const add = () => {
        const t = input.trim();
        if (t && !tags.includes(t)) onChange([...tags, t]);
        setInput("");
    };
    return (
        <Box sx={{ width: "100%" }}>
            <Box sx={{ display: "flex", gap: 1, mb: 0.75 }}>
                <TextField
                    label={label}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                    size="small"
                    placeholder={placeholder}
                    sx={{ ...inputSx, flex: 1 }}
                />
                <Box
                    component="button"
                    type="button"
                    onClick={add}
                    sx={{
                        px: 1.5, bgcolor: `${UI_COLORS.accent}11`, border: `1px solid ${UI_COLORS.accent}55`,
                        borderRadius: 1, color: UI_COLORS.accent, cursor: "pointer", fontFamily: "'Fira Sans', sans-serif", fontSize: "0.75rem",
                    }}
                >
                    +
                </Box>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {tags.map((tag) => (
                    <Chip
                        key={tag}
                        label={<CyberText sx={{ fontSize: "0.62rem" }}>{tag}</CyberText>}
                        onDelete={() => onChange(tags.filter((t) => t !== tag))}
                        size="small"
                        sx={{ height: 20, bgcolor: UI_COLORS.backgroundPrimary, border: `1px solid ${UI_COLORS.border}`, "& .MuiChip-deleteIcon": { color: UI_COLORS.textSecondary, fontSize: "0.8rem" } }}
                    />
                ))}
            </Box>
        </Box>
    );
}

/* ---- Organization members editor (VTT characters + wiki personajes) ---- */

function MembersEditor({ members = [], onChange, entities, vttCharacters }) {
    const [refType, setRefType] = useState(MEMBER_REF_KIND.WIKI);
    const [refId, setRefId] = useState("");
    const [status, setStatus] = useState(MEMBERSHIP_STATUS.CONFIRMADO);
    const [role, setRole] = useState("");

    const personajes = entities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.PERSONAJE);
    const list = Array.isArray(members) ? members : [];

    const nameOf = (m) => {
        if (m.kind === MEMBER_REF_KIND.VTT) return vttCharacters.find((c) => c.id === m.id)?.name || m.id;
        return entities.find((e) => e.id === m.id)?.title || m.id;
    };

    const add = () => {
        if (!refId) return;
        const filtered = list.filter((m) => !(m.kind === refType && m.id === refId));
        onChange([...filtered, { kind: refType, id: refId, status, role: role.trim() }]);
        setRefId("");
        setRole("");
    };

    const candidates = refType === MEMBER_REF_KIND.VTT ? vttCharacters : personajes;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary }}>
                Integrantes (personajes narrativos o personajes jugables del VTT)
            </CyberText>

            {list.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {list.map((m) => (
                        <Box
                            key={`${m.kind}:${m.id}`}
                            sx={{
                                display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5,
                                bgcolor: UI_COLORS.backgroundPrimary, border: `1px solid ${UI_COLORS.border}`, borderRadius: 1,
                            }}
                        >
                            <Chip
                                size="small"
                                label={<CyberText sx={{ fontSize: "0.55rem" }}>{m.kind === MEMBER_REF_KIND.VTT ? "VTT" : "WIKI"}</CyberText>}
                                sx={{ height: 16, bgcolor: `${UI_COLORS.anomaly}18`, color: UI_COLORS.anomaly }}
                            />
                            <CyberText sx={{ fontSize: "0.78rem", flex: 1 }}>{nameOf(m)}</CyberText>
                            <CyberText sx={{ fontSize: "0.62rem", color: m.status === MEMBERSHIP_STATUS.SOSPECHADO ? UI_COLORS.accentStrong : UI_COLORS.textSecondary }}>
                                {m.status === MEMBERSHIP_STATUS.SOSPECHADO ? "sospechado" : "confirmado"}
                                {m.role ? ` · ${m.role}` : ""}
                            </CyberText>
                            <Tooltip title="Quitar">
                                <IconButton size="small" onClick={() => onChange(list.filter((x) => !(x.kind === m.kind && x.id === m.id)))} sx={{ color: UI_COLORS.textSecondary }}>
                                    <DeleteIcon sx={{ fontSize: "0.85rem" }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                </Box>
            )}

            <Row>
                <FormControl size="small" sx={{ minWidth: 110 }}>
                    <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>Tipo</InputLabel>
                    <Select value={refType} onChange={(e) => { setRefType(e.target.value); setRefId(""); }} label="Tipo" sx={selectSx} MenuProps={menuProps}>
                        <MenuItem value={MEMBER_REF_KIND.WIKI}><CyberText sx={{ fontSize: "0.8rem" }}>Ficha wiki</CyberText></MenuItem>
                        <MenuItem value={MEMBER_REF_KIND.VTT}><CyberText sx={{ fontSize: "0.8rem" }}>Personaje VTT</CyberText></MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160, flex: 1 }}>
                    <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>Integrante</InputLabel>
                    <Select value={refId} onChange={(e) => setRefId(e.target.value)} label="Integrante" sx={selectSx} MenuProps={menuProps}>
                        {candidates.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                                <CyberText sx={{ fontSize: "0.8rem" }}>{c.title || c.name}</CyberText>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Row>
            <Row>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>Estado</InputLabel>
                    <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Estado" sx={selectSx} MenuProps={menuProps}>
                        {MEMBERSHIP_STATUS_OPTIONS.map(({ value: v, label: l }) => (
                            <MenuItem key={v} value={v}><CyberText sx={{ fontSize: "0.8rem" }}>{l}</CyberText></MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField label="Rol (opcional)" value={role} onChange={(e) => setRole(e.target.value)} size="small" sx={{ ...inputSx, flex: 1, minWidth: 120 }} />
                <Box
                    component="button"
                    type="button"
                    onClick={add}
                    sx={{
                        display: "flex", alignItems: "center", gap: 0.5, px: 1.5, bgcolor: `${UI_COLORS.accent}11`,
                        border: `1px solid ${UI_COLORS.accent}55`, borderRadius: 1, color: UI_COLORS.accent, cursor: "pointer",
                        fontFamily: "'Fira Sans', sans-serif", fontSize: "0.75rem",
                    }}
                >
                    <AddIcon sx={{ fontSize: "0.9rem" }} /> Añadir
                </Box>
            </Row>
        </Box>
    );
}

/* ---- Personaje organizations editor (which orgs they belong to) ---- */

function OrganizationsEditor({ organizations = [], onChange, entities }) {
    const [orgId, setOrgId] = useState("");
    const [status, setStatus] = useState(MEMBERSHIP_STATUS.CONFIRMADO);
    const [role, setRole] = useState("");
    const orgs = entities.filter((e) => e.entityType === WIKI_ENTITY_TYPES.ORGANIZACION);
    const list = Array.isArray(organizations) ? organizations : [];
    const titleOf = (id) => entities.find((e) => e.id === id)?.title || id;

    const add = () => {
        if (!orgId) return;
        const filtered = list.filter((m) => m.organizationEntityId !== orgId);
        onChange([...filtered, { organizationEntityId: orgId, status, role: role.trim() }]);
        setOrgId("");
        setRole("");
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary }}>
                Organizaciones a las que pertenece
            </CyberText>
            {list.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {list.map((m) => (
                        <Box
                            key={m.organizationEntityId}
                            sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, bgcolor: UI_COLORS.backgroundPrimary, border: `1px solid ${UI_COLORS.border}`, borderRadius: 1 }}
                        >
                            <CyberText sx={{ fontSize: "0.78rem", flex: 1 }}>{titleOf(m.organizationEntityId)}</CyberText>
                            <CyberText sx={{ fontSize: "0.62rem", color: m.status === MEMBERSHIP_STATUS.SOSPECHADO ? UI_COLORS.accentStrong : UI_COLORS.textSecondary }}>
                                {m.status === MEMBERSHIP_STATUS.SOSPECHADO ? "sospechado" : "confirmado"}
                                {m.role ? ` · ${m.role}` : ""}
                            </CyberText>
                            <Tooltip title="Quitar">
                                <IconButton size="small" onClick={() => onChange(list.filter((x) => x.organizationEntityId !== m.organizationEntityId))} sx={{ color: UI_COLORS.textSecondary }}>
                                    <DeleteIcon sx={{ fontSize: "0.85rem" }} />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                </Box>
            )}
            <Row>
                <FormControl size="small" sx={{ minWidth: 160, flex: 1 }}>
                    <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>Organización</InputLabel>
                    <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} label="Organización" sx={selectSx} MenuProps={menuProps}>
                        {orgs.map((o) => (
                            <MenuItem key={o.id} value={o.id}><CyberText sx={{ fontSize: "0.8rem" }}>{o.title}</CyberText></MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}>Estado</InputLabel>
                    <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Estado" sx={selectSx} MenuProps={menuProps}>
                        {MEMBERSHIP_STATUS_OPTIONS.map(({ value: v, label: l }) => (
                            <MenuItem key={v} value={v}><CyberText sx={{ fontSize: "0.8rem" }}>{l}</CyberText></MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField label="Rol (opcional)" value={role} onChange={(e) => setRole(e.target.value)} size="small" sx={{ ...inputSx, flex: 1, minWidth: 120 }} />
                <Box
                    component="button"
                    type="button"
                    onClick={add}
                    sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.5, bgcolor: `${UI_COLORS.accent}11`, border: `1px solid ${UI_COLORS.accent}55`, borderRadius: 1, color: UI_COLORS.accent, cursor: "pointer", fontFamily: "'Fira Sans', sans-serif", fontSize: "0.75rem" }}
                >
                    <AddIcon sx={{ fontSize: "0.9rem" }} /> Añadir
                </Box>
            </Row>
        </Box>
    );
}

/**
 * Conditional structured-fields panel rendered per entityType in the wiki editor.
 * `meta` is the namespace object (customFields[namespace]); `onField(field, value)`
 * merges a single field into that namespace.
 */
export default function WikiCustomFieldsPanel({
    entityType,
    meta = {},
    onField,
    entities = [],
    vttCharacters = [],
    editingEntityId = null,
}) {
    const T = WIKI_ENTITY_TYPES;

    if (entityType === T.ESPECIE) {
        return (
            <PanelShell title="ESPECIE — DATOS">
                <Row>
                    <EnumSelect label="Dieta" value={meta.diet} options={DIET_OPTIONS} onChange={(v) => onField("diet", v)} />
                    <EnumSelect label="Tamaño" value={meta.sizeCategory} options={SIZE_CATEGORY_OPTIONS} onChange={(v) => onField("sizeCategory", v)} />
                    <EnumSelect label="Población" value={meta.populationScale} options={POPULATION_SCALE_OPTIONS} onChange={(v) => onField("populationScale", v)} />
                </Row>
                <Row>
                    <TextRow label="Longevidad típica" value={meta.lifespanTypical} onChange={(v) => onField("lifespanTypical", v)} placeholder="ej. 180–250 años" />
                    <NumberRow label="Madurez (años)" value={meta.maturityAge} onChange={(v) => onField("maturityAge", v)} />
                    <NumberRow label="Long. máx" value={meta.lifespanMax} onChange={(v) => onField("lifespanMax", v)} />
                </Row>
                <Row>
                    <EntityRefSelect label="Mundo/origen" value={meta.homeworldEntityId} onChange={(v) => onField("homeworldEntityId", v)} entities={entities} entityType={T.LOCACION} />
                    <EntityRefMultiSelect label="Idiomas nativos" value={meta.languageEntityIds} onChange={(v) => onField("languageEntityIds", v)} entities={entities} entityType={T.IDIOMA} />
                </Row>
                <TagArray label="Rasgos narrativos (chips)" value={meta.traitTags} onChange={(v) => onField("traitTags", v)} placeholder="visión nocturna, anfibio..." />
                <TagArray label="Afinidad de clase ICON" value={meta.iconClassAffinity} onChange={(v) => onField("iconClassAffinity", v)} placeholder="Wright, Stalwart..." />
                <TextRow label="Notas de reproducción" value={meta.reproductionNotes} onChange={(v) => onField("reproductionNotes", v)} multiline />
            </PanelShell>
        );
    }

    if (entityType === T.PERSONAJE) {
        return (
            <PanelShell title="PERSONAJE — DATOS NARRATIVOS">
                <Row>
                    <EnumSelect label="Tipo de personaje" value={meta.characterKind} options={CHARACTER_KIND_OPTIONS} onChange={(v) => onField("characterKind", v)} />
                    <EntityRefSelect label="Especie" value={meta.speciesEntityId} onChange={(v) => onField("speciesEntityId", v)} entities={entities} entityType={T.ESPECIE} />
                </Row>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Nacimiento</CyberText>
                        <WikiDateInput value={meta.birthDate} onChange={(v) => onField("birthDate", v)} />
                    </Box>
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Muerte (vacío = vivo/desconocido)</CyberText>
                        <WikiDateInput value={meta.deathDate} onChange={(v) => onField("deathDate", v)} />
                    </Box>
                </Box>
                <Row>
                    <EntityRefSelect label="Lugar de nacimiento" value={meta.birthPlaceEntityId} onChange={(v) => onField("birthPlaceEntityId", v)} entities={entities} entityType={T.LOCACION} />
                    <EntityRefSelect label="Lugar de muerte" value={meta.deathPlaceEntityId} onChange={(v) => onField("deathPlaceEntityId", v)} entities={entities} entityType={T.LOCACION} />
                </Row>
                <Row>
                    <TextRow label="Era activa" value={meta.activeEraLabel} onChange={(v) => onField("activeEraLabel", v)} placeholder="Era de Cenizas" />
                    <TextRow label="Ocupación" value={meta.occupation} onChange={(v) => onField("occupation", v)} />
                    <TextRow label="Presentación de género" value={meta.genderPresentation} onChange={(v) => onField("genderPresentation", v)} minWidth={140} />
                </Row>
                <TagArray label="Títulos / epítetos" value={meta.titles} onChange={(v) => onField("titles", v)} placeholder="Reina de..., El Sin Nombre" />
                <BoolToggle label="Es una deidad" checked={meta.isDeity} onChange={(v) => onField("isDeity", v)} />
                <OrganizationsEditor organizations={meta.organizations} onChange={(v) => onField("organizations", v)} entities={entities} />
                {/* Reaction archetype for AI cascade mode (PANGeA) */}
                <Box sx={{ mt: 0.5 }}>
                    <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5 }}>
                        Arquetipo de reacción
                        <Tooltip
                            title="Guía cómo la IA genera reacciones de este personaje en el modo Evento narrativo (PANGeA). Opcional."
                            placement="right"
                            slotProps={{ tooltip: { sx: { maxWidth: 260, fontSize: "0.7rem", fontFamily: "'Fira Sans', sans-serif", bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, border: `1px solid ${UI_COLORS.border}` } } }}
                        >
                            <span style={{ marginLeft: 6, cursor: "help", color: UI_COLORS.textSecondary, fontSize: "0.72rem" }}>ⓘ</span>
                        </Tooltip>
                    </CyberText>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel sx={{ color: UI_COLORS.textSecondary, fontSize: "0.75rem" }}>Arquetipo</InputLabel>
                        <Select
                            value={meta.reactionArchetype ?? ""}
                            onChange={(e) => onField("reactionArchetype", e.target.value || undefined)}
                            label="Arquetipo"
                            sx={selectSx}
                        >
                            <MenuItem value="" sx={{ fontSize: "0.8rem" }}>Sin arquetipo definido</MenuItem>
                            {REACTION_ARCHETYPE_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: "0.8rem" }}>
                                    <Tooltip
                                        title={REACTION_ARCHETYPE_TOOLTIPS[opt.value] ?? ""}
                                        placement="right"
                                        slotProps={{ tooltip: { sx: { maxWidth: 240, fontSize: "0.7rem", fontFamily: "'Fira Sans', sans-serif", bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, border: `1px solid ${UI_COLORS.border}` } } }}
                                    >
                                        <Box component="span" sx={{ display: "block", width: "100%" }}>{opt.label}</Box>
                                    </Tooltip>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                {/* Narrative personality fields for AI event mode */}
                <Box sx={{ mt: 1 }}>
                    <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        Memoria de personalidad
                        <Tooltip
                            title="Campos usados por el modo Evento narrativo para generar reacciones coherentes con la personalidad del personaje."
                            placement="right"
                            slotProps={{ tooltip: { sx: { maxWidth: 280, fontSize: "0.7rem", fontFamily: "'Fira Sans', sans-serif", bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, border: `1px solid ${UI_COLORS.border}` } } }}
                        >
                            <span style={{ marginLeft: 6, cursor: "help", color: UI_COLORS.textSecondary, fontSize: "0.72rem" }}>ⓘ</span>
                        </Tooltip>
                    </CyberText>
                    <Row>
                        <EnumSelect label="Estado actual" value={meta.narrativeState} options={NARRATIVE_STATE_OPTIONS} onChange={(v) => onField("narrativeState", v)} />
                        <EnumSelect label="Patrón de estrés" value={meta.stressResponse} options={STRESS_RESPONSE_OPTIONS} onChange={(v) => onField("stressResponse", v)} />
                    </Row>
                    <TagArray
                        label="Rasgos narrativos (máx. 5)"
                        value={meta.narrativeTraits}
                        onChange={(v) => onField("narrativeTraits", Array.isArray(v) ? v.slice(0, 5) : [])}
                        placeholder="lealtad filial extrema, impulsividad..."
                    />
                    <TextRow
                        label="Anclas emocionales (bondNotes)"
                        value={meta.bondNotes}
                        onChange={(v) => onField("bondNotes", v)}
                        placeholder="Zorgun es su único pilar; sin él no hay propósito..."
                        multiline
                    />
                </Box>
            </PanelShell>
        );
    }

    if (entityType === T.LOCACION) {
        const populationOptions = getPopulationOrderOptionsForLocationKind(meta.locationKind);
        const populationLabel = POPULATION_MACRO_LOCATION_KINDS.has(meta.locationKind)
            ? "Población (escala territorial)"
            : "Población (asentamiento)";
        const parentCandidates = filterParentLocationCandidates(
            entities,
            meta.locationKind,
            editingEntityId
        );

        return (
            <PanelShell title="LOCACIÓN — DATOS NARRATIVOS">
                <Row>
                    <EnumSelect label="Tipo (amplio → concreto)" value={meta.locationKind} options={LOCATION_KIND_OPTIONS} onChange={(v) => onField("locationKind", v)} />
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                        <EnumSelect
                            label={populationLabel}
                            value={meta.populationOrder}
                            options={populationOptions}
                            onChange={(v) => onField("populationOrder", v)}
                        />
                        <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mt: 0.5, lineHeight: 1.35 }}>
                            {POPULATION_MACRO_LOCATION_KINDS.has(meta.locationKind)
                                ? "País/región: usa nación o imperio si abarca muchas ciudades. Metrópoli = una sola gran urbe."
                                : "Ciudad o lugar puntual: hasta metrópoli. Para un país entero, cambia el tipo a País o Región."}
                        </CyberText>
                    </Box>
                </Row>
                <Row>
                    <EntityRefSelect
                        label="Locación padre"
                        value={meta.parentLocationEntityId}
                        onChange={(v) => onField("parentLocationEntityId", v)}
                        entities={parentCandidates}
                        entityType={T.LOCACION}
                        minWidth={200}
                    />
                    <TextRow label="Clima" value={meta.climate} onChange={(v) => onField("climate", v)} minWidth={140} />
                </Row>
                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, lineHeight: 1.35 }}>
                    Cultura predominante (crear antes: idioma → ideología → locación macro → especie; luego rellenar dominantes).
                </CyberText>
                <Row>
                    <EntityRefSelect
                        label="Idioma predominante"
                        value={meta.dominantLanguageEntityId}
                        onChange={(v) => onField("dominantLanguageEntityId", v)}
                        entities={entities}
                        entityType={T.IDIOMA}
                    />
                    <EntityRefSelect
                        label="Ideología dominante"
                        value={meta.dominantIdeologyEntityId}
                        onChange={(v) => onField("dominantIdeologyEntityId", v)}
                        entities={entities}
                        entityType={T.IDEOLOGIA}
                    />
                    <EntityRefSelect
                        label="Especie dominante"
                        value={meta.dominantSpeciesEntityId}
                        onChange={(v) => onField("dominantSpeciesEntityId", v)}
                        entities={entities}
                        entityType={T.ESPECIE}
                    />
                </Row>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Fundación</CyberText>
                        <WikiDateInput value={meta.foundingDate} onChange={(v) => onField("foundingDate", v)} />
                    </Box>
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Destrucción (si aplica)</CyberText>
                        <WikiDateInput value={meta.destroyedDate} onChange={(v) => onField("destroyedDate", v)} />
                    </Box>
                </Box>
                <BoolToggle label="Es un asentamiento habitable" checked={meta.isSettlement} onChange={(v) => onField("isSettlement", v)} />
                {/* Collective AI personality for narrative event mode */}
                <Box sx={{ mt: 1 }}>
                    <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        Temperamento colectivo (IA)
                        <Tooltip
                            title="Define cómo reacciona esta locación como colectivo ante eventos narrativos importantes."
                            placement="right"
                            slotProps={{ tooltip: { sx: { maxWidth: 280, fontSize: "0.7rem", fontFamily: "'Fira Sans', sans-serif", bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, border: `1px solid ${UI_COLORS.border}` } } }}
                        >
                            <span style={{ marginLeft: 6, cursor: "help", color: UI_COLORS.textSecondary, fontSize: "0.72rem" }}>ⓘ</span>
                        </Tooltip>
                    </CyberText>
                    <EnumSelect label="Arquetipo colectivo" value={meta.collectiveArchetype} options={COLLECTIVE_ARCHETYPE_OPTIONS} onChange={(v) => onField("collectiveArchetype", v)} />
                    <TextRow
                        label="Estado colectivo actual"
                        value={meta.collectiveMood}
                        onChange={(v) => onField("collectiveMood", v)}
                        placeholder="Tensión por impuestos militares; lealtad al trono intacta..."
                        multiline
                    />
                </Box>
            </PanelShell>
        );
    }

    if (entityType === T.ORGANIZACION) {
        return (
            <PanelShell title="ORGANIZACIÓN — DATOS">
                <Row>
                    <EnumSelect label="Tipo" value={meta.organizationKind} options={ORGANIZATION_KIND_OPTIONS} onChange={(v) => onField("organizationKind", v)} />
                    <EnumSelect label="Alcance" value={meta.size} options={ORGANIZATION_SIZE_OPTIONS} onChange={(v) => onField("size", v)} />
                </Row>
                <Row>
                    <EntityRefSelect label="Sede principal" value={meta.headquartersEntityId} onChange={(v) => onField("headquartersEntityId", v)} entities={entities} entityType={T.LOCACION} />
                    <TextRow label="Lema" value={meta.motto} onChange={(v) => onField("motto", v)} />
                </Row>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Fundación</CyberText>
                        <WikiDateInput value={meta.foundedDate} onChange={(v) => onField("foundedDate", v)} />
                    </Box>
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Disolución (si aplica)</CyberText>
                        <WikiDateInput value={meta.dissolvedDate} onChange={(v) => onField("dissolvedDate", v)} />
                    </Box>
                </Box>
                <TextRow label="Cara pública" value={meta.publicFace} onChange={(v) => onField("publicFace", v)} multiline />
                <TagArray label="Simbología" value={meta.symbology} onChange={(v) => onField("symbology", v)} placeholder="estandarte negro, marea, daga..." />
                <MembersEditor members={meta.members} onChange={(v) => onField("members", v)} entities={entities} vttCharacters={vttCharacters} />
                {/* Collective AI personality for narrative event mode */}
                <Box sx={{ mt: 1 }}>
                    <CyberText sx={{ fontSize: "0.66rem", color: UI_COLORS.textSecondary, mb: 0.5, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        Temperamento colectivo (IA)
                        <Tooltip
                            title="Define cómo reacciona esta organización como colectivo ante eventos narrativos importantes."
                            placement="right"
                            slotProps={{ tooltip: { sx: { maxWidth: 280, fontSize: "0.7rem", fontFamily: "'Fira Sans', sans-serif", bgcolor: UI_COLORS.backgroundPrimary, color: UI_COLORS.textPrimary, border: `1px solid ${UI_COLORS.border}` } } }}
                        >
                            <span style={{ marginLeft: 6, cursor: "help", color: UI_COLORS.textSecondary, fontSize: "0.72rem" }}>ⓘ</span>
                        </Tooltip>
                    </CyberText>
                    <EnumSelect label="Arquetipo colectivo" value={meta.collectiveArchetype} options={COLLECTIVE_ARCHETYPE_OPTIONS} onChange={(v) => onField("collectiveArchetype", v)} />
                    <TextRow
                        label="Estado colectivo actual"
                        value={meta.collectiveMood}
                        onChange={(v) => onField("collectiveMood", v)}
                        placeholder="Fragmentada tras la muerte del fundador; facciones compiten..."
                        multiline
                    />
                </Box>
            </PanelShell>
        );
    }

    if (entityType === T.RELIQUIA) {
        return (
            <PanelShell title="RELIQUIA — DATOS">
                <Row>
                    <EnumSelect label="Tipo" value={meta.relicKind} options={RELIC_KIND_OPTIONS} onChange={(v) => onField("relicKind", v)} />
                    <EnumSelect label="Nivel de poder" value={meta.powerTier} options={RELIC_POWER_TIER_OPTIONS} onChange={(v) => onField("powerTier", v)} />
                </Row>
                <Row>
                    <EntityRefSelect label="Creador" value={meta.creatorEntityId} onChange={(v) => onField("creatorEntityId", v)} entities={entities} entityType={T.PERSONAJE} />
                    <EntityRefSelect label="Portador actual" value={meta.currentHolderEntityId} onChange={(v) => onField("currentHolderEntityId", v)} entities={entities} entityType={T.PERSONAJE} />
                </Row>
                <Row>
                    <EntityRefSelect label="Origen (locación)" value={meta.originLocationEntityId} onChange={(v) => onField("originLocationEntityId", v)} entities={entities} entityType={T.LOCACION} />
                    <Box>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.25 }}>Creación</CyberText>
                        <WikiDateInput value={meta.creationDate} onChange={(v) => onField("creationDate", v)} />
                    </Box>
                </Row>
                <TextRow label="Condición de activación" value={meta.activationCondition} onChange={(v) => onField("activationCondition", v)} placeholder="solo bajo luna roja" multiline />
                <BoolToggle label="Es única (una sola en el mundo)" checked={meta.isUnique} onChange={(v) => onField("isUnique", v)} />
            </PanelShell>
        );
    }

    if (entityType === T.IDEOLOGIA) {
        return (
            <PanelShell title="IDEOLOGÍA — DATOS">
                <Row>
                    <EnumSelect label="Tipo" value={meta.ideologyKind} options={IDEOLOGY_KIND_OPTIONS} onChange={(v) => onField("ideologyKind", v)} />
                    <EnumSelect label="Difusión" value={meta.spread} options={IDEOLOGY_SPREAD_OPTIONS} onChange={(v) => onField("spread", v)} />
                </Row>
                <Row>
                    <TextRow label="Tono / talante" value={meta.alignmentTone} onChange={(v) => onField("alignmentTone", v)} placeholder="fatalista, militante..." />
                    <EntityRefSelect label="Figura/deidad principal" value={meta.primaryDeityFigureEntityId} onChange={(v) => onField("primaryDeityFigureEntityId", v)} entities={entities} entityType={T.PERSONAJE} />
                </Row>
                <EntityRefSelect label="Idioma litúrgico" value={meta.holyLanguageEntityId} onChange={(v) => onField("holyLanguageEntityId", v)} entities={entities} entityType={T.IDIOMA} />
                <TagArray label="Tabúes" value={meta.tabooTags} onChange={(v) => onField("tabooTags", v)} placeholder="no tocar muertos..." />
                <TagArray label="Prácticas" value={meta.practiceTags} onChange={(v) => onField("practiceTags", v)} placeholder="peregrinaje, sacrificio floral..." />
            </PanelShell>
        );
    }

    return null;
}
