/**
 * Editable AI impact blocks shown under the standard narrative body on a ficha.
 * Data: top-level entity.aiImpactBlocks[] (newest first).
 * Narrative prose is editable; relation sync rows are read-only metadata.
 */

import { useState, useCallback } from "react";
import {
    Box, Button, Chip, IconButton, TextField, Tooltip,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";
import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { saveWikiEntity } from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";
import {
    formatRelationEffectLabel,
    getAiImpactBlocks,
    narrativeBodyOfBlock,
    relationEffectsOfBlock,
    withRemovedAiImpactBlock,
    withUpdatedAiImpactBlock,
} from "../../utils/aiImpactBlocks";

function formatBlockDate(ts) {
    if (ts == null) return "";
    try {
        return new Date(ts).toLocaleString("es", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

function RelationEffectsList({ effects }) {
    if (!effects?.length) return null;
    return (
        <Box sx={{ mt: 0.85 }}>
            <CyberText
                sx={{
                    fontSize: "0.52rem",
                    letterSpacing: "0.1em",
                    color: UI_COLORS.textSecondary,
                    fontFamily: "'Orbitron', sans-serif",
                    mb: 0.4,
                }}
            >
                CAMBIOS DE VÍNCULO
            </CyberText>
            {effects.map((fx, i) => {
                const label = formatRelationEffectLabel(fx);
                const delta = fx.strengthDelta;
                const tone = delta == null ? UI_COLORS.anomaly
                    : delta < 0 ? UI_COLORS.danger
                        : delta > 0 ? UI_COLORS.boon
                            : UI_COLORS.anomaly;
                return (
                    <Box
                        key={`${fx.fromEntityId || fx.fromTitle}-${fx.toEntityId || fx.toTitle}-${i}`}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            py: 0.4,
                            borderTop: i === 0 ? "none" : `1px solid ${UI_COLORS.border}`,
                        }}
                    >
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "1px",
                                bgcolor: tone,
                                boxShadow: `0 0 6px ${tone}66`,
                                flexShrink: 0,
                            }}
                        />
                        <CyberText
                            sx={{
                                fontSize: "0.68rem",
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Code', monospace",
                                lineHeight: 1.35,
                            }}
                        >
                            {label}
                        </CyberText>
                    </Box>
                );
            })}
        </Box>
    );
}

function AiImpactBlockCard({
    block,
    canManage,
    saving,
    onSaveBody,
    onDelete,
}) {
    const prose = narrativeBodyOfBlock(block);
    const effects = relationEffectsOfBlock(block);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(prose);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const startEdit = () => {
        setDraft(narrativeBodyOfBlock(block));
        setEditing(true);
        setConfirmDelete(false);
    };

    const cancelEdit = () => {
        setEditing(false);
        setDraft(narrativeBodyOfBlock(block));
    };

    const commitEdit = async () => {
        await onSaveBody(block.id, draft);
        setEditing(false);
    };

    return (
        <Box
            sx={{
                border: `1px solid ${UI_COLORS.anomaly}44`,
                borderLeft: `3px solid ${UI_COLORS.anomaly}`,
                borderRadius: 1,
                px: 1.25,
                py: 1,
                mb: 1,
                bgcolor: `${UI_COLORS.anomaly}0a`,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
                <AutoAwesomeIcon sx={{ fontSize: "0.85rem", color: UI_COLORS.anomaly }} />
                <CyberTitle sx={{ fontSize: "0.62rem", color: UI_COLORS.anomaly, letterSpacing: 1.2 }}>
                    IMPACTO NARRATIVO
                </CyberTitle>
                {block.editedByHuman && (
                    <Chip
                        label="editado"
                        size="small"
                        sx={{
                            height: 16,
                            fontSize: "0.52rem",
                            bgcolor: `${UI_COLORS.accent}18`,
                            color: UI_COLORS.accent,
                            "& .MuiChip-label": { px: 0.55 },
                        }}
                    />
                )}
                <Box sx={{ flex: 1 }} />
                {canManage && !editing && !confirmDelete && (
                    <>
                        <Tooltip title="Editar texto narrativo">
                            <IconButton
                                size="small"
                                disabled={saving}
                                onClick={startEdit}
                                sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                            >
                                <EditIcon sx={{ fontSize: "0.9rem" }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                            <IconButton
                                size="small"
                                disabled={saving}
                                onClick={() => setConfirmDelete(true)}
                                sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                            >
                                <DeleteOutlineIcon sx={{ fontSize: "0.9rem" }} />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                {canManage && editing && (
                    <>
                        <Tooltip title="Guardar">
                            <IconButton
                                size="small"
                                disabled={saving}
                                onClick={commitEdit}
                                sx={{ color: UI_COLORS.anomaly, p: 0.25 }}
                            >
                                <CheckIcon sx={{ fontSize: "0.95rem" }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancelar">
                            <IconButton
                                size="small"
                                disabled={saving}
                                onClick={cancelEdit}
                                sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                            >
                                <CloseIcon sx={{ fontSize: "0.95rem" }} />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
            </Box>

            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 0.65, lineHeight: 1.4 }}>
                {[
                    formatBlockDate(block.createdAt),
                    block.eventTitle ? `Evento: «${block.eventTitle}»` : null,
                    block.wave != null ? `onda ${block.wave}` : null,
                ].filter(Boolean).join(" · ")}
            </CyberText>

            {editing ? (
                <TextField
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    multiline
                    minRows={2}
                    maxRows={6}
                    fullWidth
                    size="small"
                    disabled={saving}
                    helperText="Solo prosa (reacción / gancho). Los cambios de vínculo no se editan aquí."
                    FormHelperTextProps={{ sx: { color: UI_COLORS.textSecondary, fontSize: "0.58rem" } }}
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            color: UI_COLORS.textPrimary,
                            fontSize: "0.8rem",
                            fontFamily: "'Fira Sans', sans-serif",
                            bgcolor: `${UI_COLORS.backgroundPrimary}88`,
                            "& fieldset": { borderColor: `${UI_COLORS.anomaly}55` },
                        },
                    }}
                />
            ) : prose ? (
                <CyberText
                    sx={{
                        fontSize: "0.8rem",
                        color: UI_COLORS.textPrimary,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        fontFamily: "'Fira Sans', sans-serif",
                    }}
                >
                    {prose}
                </CyberText>
            ) : (
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, fontStyle: "italic" }}>
                    Sin texto narrativo (solo cambios de vínculo).
                </CyberText>
            )}

            <RelationEffectsList effects={effects} />

            {confirmDelete && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.accentStrong, flex: 1 }}>
                        ¿Eliminar este bloque?
                    </CyberText>
                    <Button
                        size="small"
                        disabled={saving}
                        onClick={() => setConfirmDelete(false)}
                        sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary, textTransform: "none" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        size="small"
                        disabled={saving}
                        onClick={() => onDelete(block.id)}
                        sx={{ fontSize: "0.6rem", color: UI_COLORS.accentStrong, textTransform: "none" }}
                    >
                        Eliminar
                    </Button>
                </Box>
            )}
        </Box>
    );
}

/**
 * @param {{
 *   entity: object,
 *   canManage?: boolean,
 *   compact?: boolean,
 * }} props
 */
export default function WikiAiImpactBlocks({ entity, canManage = false, compact = false }) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const uid = useSelector((s) => s.player.profile?.uid);
    const liveEntity = useSelector((s) =>
        entity?.id ? (s.wiki.entities ?? []).find((e) => e.id === entity.id) : null
    ) ?? entity;

    const [saving, setSaving] = useState(false);
    const blocks = getAiImpactBlocks(liveEntity);

    const persist = useCallback(async (patch) => {
        if (!campaignId || !liveEntity?.id) return;
        setSaving(true);
        try {
            await dispatch(saveWikiEntity({
                campaignId,
                entityId: liveEntity.id,
                uid,
                data: patch,
            })).unwrap();
        } catch (err) {
            dispatch(showSnackbar({
                message: `No se pudo actualizar el bloque IA: ${err.message}`,
                severity: "error",
            }));
        } finally {
            setSaving(false);
        }
    }, [campaignId, liveEntity?.id, uid, dispatch]);

    const handleSaveBody = useCallback(async (blockId, body) => {
        await persist(withUpdatedAiImpactBlock(liveEntity, blockId, body));
    }, [persist, liveEntity]);

    const handleDelete = useCallback(async (blockId) => {
        await persist(withRemovedAiImpactBlock(liveEntity, blockId));
    }, [persist, liveEntity]);

    if (!blocks.length) {
        return (
            <Box sx={{ mt: compact ? 1.5 : 2 }}>
                <CyberTitle
                    sx={{
                        fontSize: "0.7rem",
                        letterSpacing: "0.14em",
                        color: UI_COLORS.anomaly,
                        mb: 0.5,
                    }}
                >
                    IMPACTOS NARRATIVOS
                </CyberTitle>
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                    {canManage
                        ? "Aún no hay impactos aplicados desde Lab IA."
                        : "Cuando el DM aplique un evento narrativo, verás aquí cómo te afectó."}
                </CyberText>
            </Box>
        );
    }

    return (
        <Box sx={{ mt: compact ? 1.5 : 2 }}>
            <CyberTitle
                sx={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.14em",
                    color: UI_COLORS.anomaly,
                    mb: 0.75,
                }}
            >
                IMPACTOS NARRATIVOS
            </CyberTitle>
            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mb: 1, lineHeight: 1.4 }}>
                Historial de eventos: prosa editable · cambios de vínculo aparte (solo lectura).
            </CyberText>
            {blocks.map((block) => (
                <AiImpactBlockCard
                    key={block.id}
                    block={block}
                    canManage={canManage && Boolean(campaignId && liveEntity?.id)}
                    saving={saving}
                    onSaveBody={handleSaveBody}
                    onDelete={handleDelete}
                />
            ))}
        </Box>
    );
}
