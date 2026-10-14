/**
 * Impact blocks on a ficha, newest first. Prose is editable; the effects are the
 * record of what was written. Neural Lab blocks carry the DM's decision and the seal.
 */

import { useState } from "react";
import { Box, Button, Collapse, IconButton, Popover, TextField, Tooltip } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import HubIcon from "@mui/icons-material/Hub";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { Z_INDEX, hudPopoverPaperSx } from "../../constants/designSystem";
import { WIKI_RELATION_TYPE_LABELS } from "../../constants/wikiRelationTypes";
import { REACTION_ARCHETYPE_LABELS, COLLECTIVE_ARCHETYPE_LABELS } from "../../constants/wiki/entityFieldSchemas";
import { sealGradeColor, sealGradeLabel } from "../../utils/impactSealGrade";
import { isNeuralLabBlock } from "../../utils/labImpactReview";
import {
    formatRelationEffectLabel,
    narrativeBodyOfBlock,
    relationEffectsOfBlock,
} from "../../utils/aiImpactBlocks";

const TITLE = '"Orbitron", sans-serif';
const SANS = '"Fira Sans", sans-serif';
const MONO = '"Fira Code", monospace';
const NEURAL = UI_COLORS.accent;

function formatBlockDate(ts) {
    if (ts == null) return "";
    try {
        return new Date(ts).toLocaleString("es", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

/** `@[Título](id)` → Título resaltado. */
function Prose({ text }) {
    const parts = [];
    const re = /@\[([^\]]+)\]\(([^)]*)\)/g;
    let last = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        parts.push(
            <Box key={`${match.index}-${match[2]}`} component="span" sx={{ color: UI_COLORS.anomaly, fontWeight: 600 }}>
                {match[1]}
            </Box>,
        );
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return (
        <Box sx={{ fontFamily: SANS, fontSize: "13px", color: "#ffffff", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {parts}
        </Box>
    );
}

function signed(n) {
    return n > 0 ? `+${n}` : String(n);
}

function relationLine(fx) {
    if (fx.before === undefined && fx.after === undefined) return formatRelationEffectLabel(fx);
    const typ = WIKI_RELATION_TYPE_LABELS[fx.relationType] || String(fx.relationType || "vínculo").replace(/_/g, " ");
    const pair = `${fx.fromTitle || "?"} → ${fx.toTitle || "?"}`;
    if (fx.kind === "relation_remove") return `${pair} · ${typ} roto${fx.before != null ? ` (era ${signed(fx.before)})` : ""}`;
    if (fx.before == null) return `${pair} · ${typ} nuevo · ${signed(fx.after ?? 0)}`;
    const delta = fx.strengthDelta ?? ((fx.after ?? 0) - fx.before);
    return `${pair} · ${typ} ${signed(fx.before)} → ${signed(fx.after ?? 0)} (${signed(delta)})${fx.dmFlipped ? " · signo corregido por el DM" : ""}`;
}

function EffectRow({ tone, children }) {
    return (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, py: 0.45, "& + &": { borderTop: `1px solid ${UI_COLORS.border}` } }}>
            <Box sx={{ width: 6, height: 6, mt: "6px", borderRadius: "1px", bgcolor: tone, boxShadow: `0 0 6px ${tone}66`, flexShrink: 0 }} />
            <Box sx={{ fontFamily: MONO, fontSize: "11.5px", color: "#ffffff", lineHeight: 1.45 }}>{children}</Box>
        </Box>
    );
}

function Kicker({ children }) {
    return (
        <Box sx={{ mt: 1, mb: 0.35, fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.14em", color: UI_COLORS.textSecondary }}>
            {children}
        </Box>
    );
}

function Tag({ children, color, solid }) {
    return (
        <Box
            component="span"
            sx={{
                px: "6px",
                py: "1px",
                borderRadius: "3px",
                border: `1px solid ${color}`,
                background: solid ? color : `${color}14`,
                color: solid ? "#07070c" : color,
                fontFamily: TITLE,
                fontSize: "8.5px",
                letterSpacing: "0.1em",
                whiteSpace: "nowrap",
            }}
        >
            {children}
        </Box>
    );
}

function BlockCard({ block, canManage, saving, onSaveBody, onDelete, framed = true, proseMode = "always" }) {
    const neural = isNeuralLabBlock(block);
    const accent = neural ? NEURAL : UI_COLORS.anomaly;
    const prose = narrativeBodyOfBlock(block);
    const relationEffects = relationEffectsOfBlock(block);
    const stateEffects = Array.isArray(block.stateEffects) ? block.stateEffects : [];
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(prose);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [whyOpen, setWhyOpen] = useState(false);
    const sealColor = block.seal ? sealGradeColor(block.seal) : null;
    const archetype = block.archetype
        ? (REACTION_ARCHETYPE_LABELS[block.archetype] || COLLECTIVE_ARCHETYPE_LABELS[block.archetype] || block.archetype)
        : null;

    return (
        <Box
            data-testid={neural ? "neural-lab-block" : "ai-impact-block"}
            sx={{
                position: "relative",
                border: framed ? `1px solid ${accent}44` : 0,
                borderLeft: framed ? `3px solid ${accent}` : 0,
                borderRadius: framed ? "6px" : 0,
                px: framed ? 1.25 : 0,
                py: framed ? 1 : 0,
                mb: framed ? 1 : 0,
                bgcolor: framed ? `${accent}0a` : "transparent",
                color: "#ffffff",
                "@keyframes aiBlockIn": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "none" } },
                animation: framed ? "aiBlockIn .25s ease-out both" : "none",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, flexWrap: "wrap" }}>
                {neural
                    ? <HubIcon sx={{ fontSize: 15, color: accent }} />
                    : <AutoAwesomeIcon sx={{ fontSize: 14, color: accent }} />}
                {neural ? (
                    <>
                        <Tag color={NEURAL} solid>NEURAL LAB</Tag>
                        <Tag color="#3dd68c">DECISIÓN DEL DM</Tag>
                    </>
                ) : (
                    <Box sx={{ fontFamily: TITLE, fontSize: "9px", letterSpacing: "0.12em", color: accent }}>IMPACTO NARRATIVO</Box>
                )}
                {block.editedByHuman && <Tag color={UI_COLORS.loot}>EDITADO</Tag>}
                {block.dmOnly && <Tag color={UI_COLORS.textSecondary}>SOLO DM</Tag>}
                <Box sx={{ flex: 1 }} />
                {canManage && !editing && !confirmDelete && (
                    <>
                        <Tooltip title="Editar texto">
                            <IconButton size="small" disabled={saving} onClick={() => { setDraft(prose); setEditing(true); }} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }} aria-label="Editar texto">
                                <EditIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar bloque">
                            <IconButton size="small" disabled={saving} onClick={() => setConfirmDelete(true)} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }} aria-label="Eliminar bloque">
                                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                {canManage && editing && (
                    <>
                        <Tooltip title="Guardar">
                            <IconButton size="small" disabled={saving} onClick={async () => { await onSaveBody(block.id, draft); setEditing(false); }} sx={{ color: accent, p: 0.25 }} aria-label="Guardar">
                                <CheckIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancelar">
                            <IconButton size="small" disabled={saving} onClick={() => setEditing(false)} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }} aria-label="Cancelar">
                                <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
            </Box>

            <Box sx={{ mt: 0.5, fontFamily: SANS, fontSize: "11.5px", color: UI_COLORS.textSecondary, lineHeight: 1.4 }}>
                {[
                    formatBlockDate(block.createdAt),
                    block.eventTitle ? `Evento: «${block.eventTitle}»` : null,
                    block.wave != null ? (block.wave === 0 ? "ancla" : `onda ${block.wave}`) : null,
                    archetype ? `reaccionó como ${archetype}` : null,
                ].filter(Boolean).join(" · ")}
            </Box>

            {neural && block.seal && (
                <Box sx={{ mt: 0.6 }}>
                    <Box
                        component="button"
                        type="button"
                        aria-expanded={whyOpen}
                        onClick={() => setWhyOpen((v) => !v)}
                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, p: 0, border: 0, background: "none", cursor: "pointer", color: "#ffffff", fontFamily: SANS, fontSize: "11.5px", textAlign: "left" }}
                    >
                        <Tag color={sealColor} solid>{sealGradeLabel(block.seal)}</Tag>
                        <span>{block.sealHeadline || ""}</span>
                        {block.sealReasons?.length > 0 && (
                            <ExpandMoreIcon sx={{ fontSize: 14, color: UI_COLORS.textSecondary, transition: "transform .2s", transform: whyOpen ? "rotate(180deg)" : "none" }} />
                        )}
                    </Box>
                    <Collapse in={whyOpen} timeout={160}>
                        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25, color: "#dddddd", fontFamily: SANS, fontSize: "11.5px", lineHeight: 1.45 }}>
                            {(block.sealReasons || []).map((reason) => <li key={reason}>{reason}</li>)}
                        </Box>
                    </Collapse>
                </Box>
            )}

            {(proseMode === "always" || editing) && (
            <Box sx={{ mt: 0.75 }}>
                {editing ? (
                    <TextField
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        multiline
                        minRows={2}
                        maxRows={8}
                        fullWidth
                        size="small"
                        disabled={saving}
                        helperText="Solo la prosa. Los cambios de estado y de vínculo quedan como registro."
                        FormHelperTextProps={{ sx: { color: UI_COLORS.textSecondary, fontSize: "11px" } }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                color: "#ffffff",
                                fontSize: "13px",
                                fontFamily: SANS,
                                bgcolor: "rgba(8,8,14,0.6)",
                                "& fieldset": { borderColor: `${accent}55` },
                                "&.Mui-focused fieldset": { borderColor: accent },
                            },
                        }}
                    />
                ) : prose ? (
                    <Prose text={prose} />
                ) : (
                    <Box sx={{ fontFamily: SANS, fontSize: "12px", color: UI_COLORS.textSecondary, fontStyle: "italic" }}>
                        Sin texto narrativo: solo cambios registrados.
                    </Box>
                )}
            </Box>
            )}

            {stateEffects.length > 0 && (
                <>
                    <Kicker>CAMBIOS DE ESTADO</Kicker>
                    {stateEffects.map((fx) => (
                        <EffectRow key={fx.itemKey || fx.field} tone={UI_COLORS.loot}>
                            {fx.fieldLabel || fx.field}
                            {fx.targetId && fx.targetId !== block.forEntityId && fx.targetTitle ? ` de ${fx.targetTitle}` : ""}
                            {": "}
                            {fx.beforeLabel ?? String(fx.before ?? "sin dato")} → {fx.afterLabel ?? String(fx.after ?? "sin dato")}
                        </EffectRow>
                    ))}
                </>
            )}

            {relationEffects.length > 0 && (
                <>
                    <Kicker>CAMBIOS DE VÍNCULO</Kicker>
                    {relationEffects.map((fx, i) => {
                        const delta = fx.strengthDelta;
                        const tone = fx.kind === "relation_remove" ? UI_COLORS.danger
                            : delta == null ? UI_COLORS.anomaly
                                : delta < 0 ? UI_COLORS.danger
                                    : delta > 0 ? UI_COLORS.boon
                                        : UI_COLORS.anomaly;
                        return (
                            <EffectRow key={fx.itemKey || `${fx.fromEntityId}-${fx.toEntityId}-${i}`} tone={tone}>
                                {relationLine(fx)}
                            </EffectRow>
                        );
                    })}
                </>
            )}

            {confirmDelete && (
                <Box sx={{ mt: 1, p: 0.85, borderRadius: "4px", border: `1px solid ${UI_COLORS.danger}55`, bgcolor: `${UI_COLORS.danger}0f` }}>
                    <Box sx={{ fontFamily: SANS, fontSize: "12px", color: "#ffffff" }}>¿Eliminar este bloque?</Box>
                    {neural && (stateEffects.length > 0 || relationEffects.length > 0) && (
                        <Box sx={{ mt: 0.35, fontFamily: SANS, fontSize: "11.5px", color: "#ffb0bc", lineHeight: 1.4 }}>
                            Se borra el registro, no los cambios ya escritos en la ficha ni en los vínculos.
                        </Box>
                    )}
                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 0.5 }}>
                        <Button size="small" disabled={saving} onClick={() => setConfirmDelete(false)} sx={{ fontSize: "11px", color: UI_COLORS.textSecondary, textTransform: "none" }}>
                            Cancelar
                        </Button>
                        <Button size="small" disabled={saving} onClick={() => onDelete(block.id)} sx={{ fontSize: "11px", color: UI_COLORS.danger, textTransform: "none" }}>
                            Eliminar
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

function ContinuationEntry({ block, canManage, saving, onSaveBody, onDelete }) {
    const prose = narrativeBodyOfBlock(block);
    const relationLines = relationEffectsOfBlock(block).map(relationLine);
    const neural = isNeuralLabBlock(block);
    const accent = neural ? NEURAL : UI_COLORS.anomaly;
    const archetype = block.archetype
        ? (REACTION_ARCHETYPE_LABELS[block.archetype] || COLLECTIVE_ARCHETYPE_LABELS[block.archetype] || block.archetype)
        : null;
    const meta = [
        formatBlockDate(block.createdAt),
        block.eventTitle ? `«${block.eventTitle}»` : null,
        block.wave != null ? (block.wave === 0 ? "ancla" : `onda ${block.wave}`) : null,
        archetype,
    ].filter(Boolean).join(" · ");
    const [anchor, setAnchor] = useState(null);
    return (
        <Box sx={{ py: 1.15, "& + &": { borderTop: `1px solid ${UI_COLORS.border}` } }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {meta && (
                        <Box sx={{ mb: 0.45, fontFamily: SANS, fontSize: "11.5px", color: UI_COLORS.textSecondary, lineHeight: 1.4 }}>
                            {meta}
                        </Box>
                    )}
                    {prose ? (
                        <Prose text={prose} />
                    ) : (
                        <Box sx={{ fontFamily: SANS, fontSize: "13px", color: relationLines.length ? "#ffffff" : UI_COLORS.textSecondary, fontStyle: relationLines.length ? "normal" : "italic", lineHeight: 1.45 }}>
                            {relationLines.length ? relationLines.join(" · ") : "Sin texto: el detalle guarda los cambios."}
                        </Box>
                    )}
                </Box>
                <Box
                    component="button"
                    type="button"
                    aria-expanded={Boolean(anchor)}
                    aria-label={block.eventTitle ? `Detalle de ${block.eventTitle}` : "Detalle del impacto"}
                    onClick={(event) => setAnchor(event.currentTarget)}
                    sx={{
                        flex: "none",
                        mt: "1px",
                        px: "8px",
                        py: "3px",
                        borderRadius: "4px",
                        border: `1px solid ${UI_COLORS.border}`,
                        background: "transparent",
                        color: "#ffffff",
                        fontFamily: SANS,
                        fontSize: "12px",
                        cursor: "pointer",
                        "&:hover": { borderColor: accent },
                        "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
                    }}
                >
                    Detalle
                </Box>
            </Box>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                disableScrollLock
                slotProps={{
                    root: { sx: { zIndex: Math.max(Z_INDEX.wikiLabMenu, 12000) } },
                    paper: {
                        sx: {
                            ...hudPopoverPaperSx,
                            ...CYBER_SCROLL_STYLE,
                            width: 380,
                            maxWidth: "min(380px, 92vw)",
                            maxHeight: "min(70vh, 520px)",
                            overflow: "auto",
                            p: 1.5,
                            color: "#ffffff",
                            border: `1px solid ${accent}66`,
                            boxShadow: `0 16px 40px rgba(0,0,0,0.55), 0 0 22px ${accent}22`,
                        },
                    },
                }}
            >
                <BlockCard
                    block={block}
                    canManage={canManage}
                    saving={saving}
                    onSaveBody={onSaveBody}
                    onDelete={onDelete}
                    framed={false}
                    proseMode="edit"
                />
            </Popover>
        </Box>
    );
}

/**
 * @param {{
 *   blocks: object[],
 *   canManage?: boolean,
 *   viewerIsDm?: boolean,
 *   saving?: boolean,
 *   onSaveBody?: (blockId: string, body: string) => Promise<void>,
 *   onDelete?: (blockId: string) => Promise<void>,
 *   title?: string,
 *   hint?: string|null,
 *   emptyText?: string|null,
 *   layout?: "cards"|"continuation",
 * }} props
 */
export default function AiImpactBlockList({
    blocks,
    canManage = false,
    viewerIsDm = false,
    saving = false,
    onSaveBody,
    onDelete,
    title = "IMPACTOS NARRATIVOS",
    hint = null,
    emptyText = null,
    layout = "cards",
}) {
    const visible = (blocks || []).filter((block) => viewerIsDm || !block.dmOnly);
    if (layout === "continuation") {
        if (!visible.length) return null;
        return (
            <Box sx={{ color: "#ffffff" }}>
                <Box className="sec-h">
                    Continuación
                    <Box component="span" className="n">
                        {visible.length} {visible.length === 1 ? "decisión" : "decisiones"} · aparte de la biografía
                    </Box>
                </Box>
                {visible.map((block) => (
                    <ContinuationEntry
                        key={block.id}
                        block={block}
                        canManage={canManage}
                        saving={saving}
                        onSaveBody={onSaveBody}
                        onDelete={onDelete}
                    />
                ))}
            </Box>
        );
    }
    if (!visible.length && !emptyText) return null;
    return (
        <Box sx={{ color: "#ffffff" }}>
            <Box sx={{ fontFamily: TITLE, fontSize: "10px", letterSpacing: "0.14em", color: UI_COLORS.anomaly, mb: 0.5 }}>{title}</Box>
            {hint && visible.length > 0 && (
                <Box sx={{ fontFamily: SANS, fontSize: "11.5px", color: UI_COLORS.textSecondary, mb: 1, lineHeight: 1.4 }}>{hint}</Box>
            )}
            {!visible.length && (
                <Box sx={{ fontFamily: SANS, fontSize: "12px", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>{emptyText}</Box>
            )}
            {visible.map((block) => (
                <BlockCard
                    key={block.id}
                    block={block}
                    canManage={canManage}
                    saving={saving}
                    onSaveBody={onSaveBody}
                    onDelete={onDelete}
                />
            ))}
        </Box>
    );
}
