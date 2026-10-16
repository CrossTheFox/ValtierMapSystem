/**
 * Ficha pinned beside a Neural Lab card. Biography and links stay on Ficha.
 * Accepted impacts live on their own tab so the review menu is not pushed off screen.
 */

import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import HubIcon from "@mui/icons-material/Hub";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { CODEX_TYPES } from "../../../constants/wiki/archiveCodex";
import { WIKI_ENTITY_TYPES } from "../../../constants/wikiEntityTypes";
import { WIKI_RELATION_TYPE_LABELS, isAffinityRelation } from "../../../constants/wikiRelationTypes";
import { withRemovedAiImpactBlock, withUpdatedAiImpactBlock } from "../../../utils/aiImpactBlocks";
import LorePersonalityPicker from "../LorePersonalityPicker";
import AiImpactBlockList from "../AiImpactBlockList";
import { TypeBadge } from "./LabReviewParts";

const TITLE = '"Orbitron", sans-serif';
const SANS = '"Fira Sans", sans-serif';
const MONO = '"Fira Code", monospace';

const CONDICION_OPTIONS = [
    ["intacto", "Intacto"],
    ["danado", "Dañado"],
    ["inhabitable", "Inhabitable"],
    ["destruido", "Destruido"],
    ["aislado", "Aislado"],
    ["ocupado", "Ocupado"],
    ["evacuado", "Evacuado"],
    ["otro", "Otro"],
];

function endOf(row, end) {
    if (end === "from") return row?.from_ficha_id || row?.fromEntityId || "";
    return row?.to_ficha_id || row?.toEntityId || "";
}

function fieldSx() {
    return {
        width: "100%",
        boxSizing: "border-box",
        color: "#ffffff",
        bgcolor: "rgba(8,8,14,0.92)",
        border: `1px solid ${UI_COLORS.border}`,
        borderRadius: "4px",
        fontFamily: SANS,
        fontSize: "12.5px",
        px: 1,
        py: 0.7,
        outline: "none",
        "&:focus": { borderColor: UI_COLORS.accent },
        "&::placeholder": { color: UI_COLORS.textSecondary },
        "& option": { color: "#ffffff", background: "#12121a" },
    };
}

function Label({ children }) {
    return <Box sx={{ mt: 1, mb: 0.4, fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.14em", color: UI_COLORS.textSecondary }}>{children}</Box>;
}

/**
 * @param {{
 *   entity: object,
 *   relations: object[],
 *   entityById: Map<string, object>,
 *   visible: boolean,
 *   showVisibility: boolean,
 *   onPatch: (patch: object) => Promise<void>|void,
 *   onVisibility: (next: string) => void,
 *   onBlocksChange?: (blocks: object[], blockId: string, block: object|null) => Promise<void>|void,
 *   pin?: (el: HTMLElement, id: string) => (() => void),
 * }} props
 */
export default function LabFichaEditor({ entity, relations, entityById, visible, showVisibility, onPatch, onVisibility, onBlocksChange, pin }) {
    const type = entity.entityType;
    const meta = CODEX_TYPES[type] || { label: type, color: "#ffffff" };
    const blocks = entity.aiImpactBlocks || [];
    const impactCount = blocks.length;
    const [tab, setTab] = useState("ficha");
    const sheetRef = useRef(null);
    const [draft, setDraft] = useState(() => ({ title: entity.title || "", summary: entity.summary || "", body: entity.body || "" }));
    const [saving, setSaving] = useState(false);
    const timer = useRef(null);
    const pending = useRef({});
    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => {
        if (!sheetRef.current || !entity?.id) return undefined;
        return pin?.(sheetRef.current, entity.id);
    }, [pin, entity?.id]);
    useEffect(() => { setTab("ficha"); }, [entity?.id]);
    const queue = (patch) => {
        pending.current = { ...pending.current, ...patch };
        setDraft((prev) => ({ ...prev, ...patch }));
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const next = pending.current;
            pending.current = {};
            onPatch(next);
        }, 420);
    };
    const links = (relations || []).filter((row) => endOf(row, "from") === entity.id || endOf(row, "to") === entity.id);
    const hasPersonality = type === WIKI_ENTITY_TYPES.PERSONAJE || type === WIKI_ENTITY_TYPES.LOCACION || type === WIKI_ENTITY_TYPES.ORGANIZACION;

    const writeBlocks = async (next, blockId) => {
        setSaving(true);
        try {
            if (onBlocksChange) await onBlocksChange(next, blockId, next.find((b) => b.id === blockId) || null);
            else await onPatch({ ai_impact_blocks: next });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box
            ref={sheetRef}
            data-testid="lab-ficha-editor"
            onPointerDown={(event) => event.stopPropagation()}
            sx={{
                position: "absolute",
                left: 0,
                top: 0,
                zIndex: 6,
                visibility: "hidden",
                width: 280,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                color: "#ffffff",
                borderRadius: "8px",
                border: `1px solid ${meta.color}55`,
                borderTop: `3px solid ${meta.color}`,
                bgcolor: "rgba(8,8,14,0.97)",
                backdropFilter: "blur(10px)",
                boxShadow: `0 18px 40px rgba(0,0,0,0.55), 0 0 20px ${meta.color}22`,
                willChange: "transform",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: "10px 12px 6px", flex: "none" }}>
                <TypeBadge type={type} size={34} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.16em", color: meta.color }}>{meta.label?.toUpperCase()}</Box>
                    <Box
                        component="input"
                        aria-label="Título"
                        value={draft.title}
                        onChange={(event) => queue({ title: event.target.value })}
                        sx={{
                            width: "100%",
                            p: 0,
                            border: 0,
                            outline: "none",
                            bgcolor: "transparent",
                            color: "#ffffff",
                            fontFamily: SANS,
                            fontWeight: 600,
                            fontSize: "14px",
                        }}
                    />
                </Box>
                {showVisibility && (
                    <Box
                        component="button"
                        type="button"
                        onClick={() => onVisibility(visible ? "dm_only" : "players")}
                        aria-label={visible ? "Ocultar a la mesa" : "Mostrar a la mesa"}
                        title={visible ? "Visible para la mesa · clic para ocultar" : "Oculta para la mesa · clic para publicar"}
                        sx={{ p: 0.5, border: `1px solid ${visible ? UI_COLORS.anomaly : UI_COLORS.border}`, borderRadius: "4px", background: "none", color: visible ? UI_COLORS.anomaly : UI_COLORS.textSecondary, cursor: "pointer", display: "grid" }}
                    >
                        {visible ? <VisibilityIcon sx={{ fontSize: 16 }} /> : <VisibilityOffIcon sx={{ fontSize: 16 }} />}
                    </Box>
                )}
            </Box>
            <Box role="tablist" aria-label="Ficha" sx={{ display: "flex", gap: 0.5, px: 1.25, flex: "none", borderBottom: `1px solid ${UI_COLORS.border}` }}>
                {[
                    ["ficha", "Ficha"],
                    ["impactos", `Impactos · ${impactCount}`],
                ].map(([id, label]) => (
                    <Box
                        key={id}
                        component="button"
                        type="button"
                        role="tab"
                        aria-selected={tab === id}
                        onClick={() => setTab(id)}
                        sx={{
                            mb: "-1px",
                            px: 0.75,
                            py: 0.7,
                            border: 0,
                            borderBottom: "2px solid",
                            borderBottomColor: tab === id ? meta.color : "transparent",
                            background: "none",
                            cursor: "pointer",
                            fontFamily: TITLE,
                            fontSize: "8.5px",
                            letterSpacing: "0.12em",
                            color: tab === id ? "#ffffff" : UI_COLORS.textSecondary,
                            "&:hover": { color: "#ffffff" },
                            "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
                        }}
                    >
                        {label}
                    </Box>
                ))}
            </Box>
            <Box sx={{ p: "0 12px 12px", overflow: "auto", maxHeight: "min(26vh, 240px)", ...CYBER_SCROLL_STYLE }}>
                {tab === "impactos" ? (
                    <Box sx={{ pt: 1 }}>
                        <AiImpactBlockList
                            blocks={blocks}
                            viewerIsDm
                            canManage
                            saving={saving}
                            title=""
                            hint=""
                            emptyText="Todavía no aceptas cambios del Neural Lab para esta ficha."
                            onSaveBody={(blockId, body) => writeBlocks(withUpdatedAiImpactBlock({ aiImpactBlocks: blocks }, blockId, body).aiImpactBlocks, blockId)}
                            onDelete={(blockId) => writeBlocks(withRemovedAiImpactBlock({ aiImpactBlocks: blocks }, blockId).aiImpactBlocks, blockId)}
                        />
                    </Box>
                ) : (
                    <>
                {hasPersonality && (
                    <Box sx={{ borderBottom: `1px solid ${UI_COLORS.border}` }}>
                        <LorePersonalityPicker row={entity} entityType={type} onPatch={onPatch} stack />
                    </Box>
                )}
                <Label>RESUMEN</Label>
                <Box component="input" aria-label="Resumen" placeholder="Una línea" value={draft.summary} onChange={(event) => queue({ summary: event.target.value })} sx={fieldSx()} />
                <Label>TEXTO</Label>
                <Box
                    component="textarea"
                    aria-label="Texto"
                    placeholder="Texto de la ficha"
                    value={draft.body}
                    onChange={(event) => queue({ body: event.target.value })}
                    sx={{ ...fieldSx(), minHeight: 56, resize: "vertical", lineHeight: 1.45 }}
                />
                        {type === WIKI_ENTITY_TYPES.LOCACION && (
                            <>
                                <Label>CONDICIÓN</Label>
                                <Box component="select" aria-label="Condición" value={entity.condicion || ""} onChange={(event) => onPatch({ condicion: event.target.value || null })} sx={fieldSx()}>
                                    <option value="">Sin condición</option>
                                    {CONDICION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </Box>
                                <Box component="input" aria-label="Nota de la condición" value={entity.condicion_nota || ""} placeholder="Nota de la condición" onChange={(event) => onPatch({ condicion_nota: event.target.value })} sx={{ ...fieldSx(), mt: 0.6 }} />
                            </>
                        )}
                        <Label>VÍNCULOS · {links.length}</Label>
                        {links.length === 0 && <Box sx={{ fontFamily: SANS, fontSize: "12px", color: UI_COLORS.textSecondary }}>Todavía no tiene relaciones.</Box>}
                        {links.map((row) => {
                            const outgoing = endOf(row, "from") === entity.id;
                            const otherId = outgoing ? endOf(row, "to") : endOf(row, "from");
                            const other = entityById.get(otherId);
                            const verb = row.relation_type || row.relationType || "";
                            const strength = Number(row.strength ?? 0);
                            const affinity = isAffinityRelation({
                                relationType: verb,
                                fromEntityType: outgoing ? type : other?.entityType,
                                toEntityType: outgoing ? other?.entityType : type,
                            });
                            const stamp = row.neural_lab;
                            return (
                                <Box key={row.id || `${otherId}-${verb}`} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.5, "& + &": { borderTop: `1px solid ${UI_COLORS.border}` } }}>
                                    <TypeBadge type={other?.entityType} size={22} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Box sx={{ fontFamily: SANS, fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{other?.title || "Ficha"}</Box>
                                        <Box sx={{ fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>
                                            {outgoing ? "" : "← "}{WIKI_RELATION_TYPE_LABELS[verb] || verb}
                                            {stamp && (
                                                <Box component="span" title={`Neural Lab: «${stamp.event_title || "evento"}»`} sx={{ ml: 0.6, color: UI_COLORS.accent, display: "inline-flex", alignItems: "center", gap: "2px", verticalAlign: "middle" }}>
                                                    <HubIcon sx={{ fontSize: 11 }} /> Neural Lab
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                    {affinity ? (
                                        <Box sx={{ fontFamily: MONO, fontSize: "12px", color: strength <= -3 ? "#ff8095" : strength >= 3 ? "#3dd68c" : "#f5c542" }}>
                                            {strength > 0 ? `+${strength}` : strength}
                                        </Box>
                                    ) : (
                                        <LockOutlinedIcon titleAccess="Vínculo estructural: sin fuerza" sx={{ fontSize: 14, color: "#ffcc66" }} />
                                    )}
                                </Box>
                            );
                        })}
                    </>
                )}
            </Box>
        </Box>
    );
}
