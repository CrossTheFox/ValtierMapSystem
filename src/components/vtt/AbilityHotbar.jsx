import { useCallback, useMemo, useState } from "react";
import { Box, IconButton, Paper } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useDispatch, useSelector } from "react-redux";

import { CyberText } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import AttackBoonDialog from "./AttackBoonDialog";
import { UI_COLORS } from "../../constants/uiColors";
import { VTT_HUD } from "../../constants/vttHudTokens";
import {
    MACRO_PAGE_COUNT,
    MACRO_SLOT_COUNT,
    MACRO_SLOT_TYPES,
    macroSlotShortLabel,
    macroTypeAccent,
    normalizeMacroBar,
    serializeMacroBar,
    setMacroSlot,
} from "../../constants/macroBar";
import { ABILITY_KINDS, normalizeAbilityKind } from "../../constants/abilityKinds";
import { getAbilitiesByIds } from "../../../firebase/services/characterService";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { callAbilityInChat } from "../../../firebase/services/chatService";
import { setAbilityBarOpen, setMacroPage, showSnackbar } from "../../store/uiSlice";

/** Resolve live text for a pinned narrative shortcut from the character doc. */
function resolveNarrativeShortcut(character, key) {
    if (!key) return null;
    const bond = character?.bond || {};
    if (key === "sw") {
        return {
            id: "narrative:sw",
            label: "NARRATIVE · SECOND WIND",
            content: bond.secondWind || "",
        };
    }
    if (key === "sa") {
        return {
            id: "narrative:sa",
            label: "NARRATIVE · SPECIAL ABILITY",
            content: bond.specialAbility || bond.description || "",
        };
    }
    if (String(key).startsWith("bond:")) {
        const id = String(key).slice(5);
        const powers = Array.isArray(character?.bondPowers) ? character.bondPowers : [];
        const bp = powers.find((p) => (p.id || p.key || p.name) === id);
        const title = bp?.title || bp?.name || bp?.label || "BOND";
        return {
            id: `narrative:bond:${id}`,
            label: `BOND · ${title}`,
            content: bp?.description || bp?.content || bp?.text || "",
        };
    }
    return {
        id: `narrative:${key}`,
        label: key,
        content: "",
    };
}

function MacroHoverTitle({ slot }) {
    if (!slot) return "Vacío";
    return (
        <Box sx={{ textAlign: "left", maxWidth: 240 }}>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.62rem",
                letterSpacing: "0.08em",
                color: "#ffffff",
                textTransform: "uppercase",
                mb: slot.blurb ? 0.4 : 0,
            }}>
                {slot.label || slot.id}
            </Box>
            {slot.blurb ? (
                <Box sx={{
                    fontFamily: "'Fira Sans', sans-serif",
                    fontSize: "0.72rem",
                    letterSpacing: 0,
                    textTransform: "none",
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.35,
                    whiteSpace: "pre-wrap",
                }}>
                    {slot.blurb.length > 160 ? `${slot.blurb.slice(0, 160)}…` : slot.blurb}
                </Box>
            ) : null}
            <Box sx={{
                mt: 0.4,
                fontFamily: "'Fira Code', monospace",
                fontSize: "0.5rem",
                color: macroTypeAccent(slot.type),
                letterSpacing: "0.08em",
            }}>
                {(slot.type || "").toUpperCase()}
            </Box>
        </Box>
    );
}

/**
 * Macro bar: 9 pages × 10 slots. Stays open until bolt/X (Redux).
 */
export default function AbilityHotbar({ open, character }) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const macroPage = useSelector((s) => s.ui.macroPage ?? 0);
    const [busy, setBusy] = useState(false);
    const [attackPending, setAttackPending] = useState(null); // { payload }

    const bar = useMemo(() => normalizeMacroBar(character?.macroBar), [character?.macroBar]);
    const pageSlots = bar.pages[macroPage] || [];

    const handleClose = () => dispatch(setAbilityBarOpen(false));

    const launchAbility = useCallback(async (payload, attackMods = null) => {
        if (!campaignId || !character || busy) return;
        setBusy(true);
        try {
            await callAbilityInChat(
                campaignId,
                profile,
                payload,
                attackMods ? { character, attackMods } : { character },
            );
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo lanzar la macro", severity: "error" }));
        } finally {
            setBusy(false);
        }
    }, [busy, campaignId, character, dispatch, profile]);

    const handleCall = useCallback(async (slot) => {
        if (!campaignId || !character || !slot || busy) return;

        if (slot.type === MACRO_SLOT_TYPES.OBJECT || slot.type === MACRO_SLOT_TYPES.CUSTOM) {
            dispatch(showSnackbar({
                message: slot.type === MACRO_SLOT_TYPES.CUSTOM
                    ? "Macros custom: próximamente (ver planning VTT)"
                    : "Objetos en macros: próximamente",
                severity: "info",
            }));
            return;
        }

        try {
            let payload = {
                id: slot.id,
                label: slot.label || slot.id,
                content: slot.blurb || "",
                characterId: character.id,
                characterName: character.name,
                abilityKind: ABILITY_KINDS.STANDARD,
                tagKeys: [],
            };

            if (slot.type === MACRO_SLOT_TYPES.SHORTCUT) {
                const sc = resolveNarrativeShortcut(character, slot.id);
                if (sc) {
                    payload = {
                        ...payload,
                        id: sc.id,
                        label: sc.label,
                        content: sc.content || slot.blurb || "",
                    };
                }
            } else {
                try {
                    const list = await getAbilitiesByIds([slot.id]);
                    const live = list?.[0];
                    if (live) {
                        payload = {
                            ...payload,
                            id: live.id || live.key || slot.id,
                            label: live.label || slot.label,
                            content: live.content || live.description || live.blurb || slot.blurb || "",
                            cost: live.cost || "",
                            abilityKind: normalizeAbilityKind(live.abilityKind),
                            tagKeys: Array.isArray(live.tagKeys) ? live.tagKeys : [],
                        };
                    }
                } catch {
                    /* use cached blurb */
                }
            }

            if (normalizeAbilityKind(payload.abilityKind) === ABILITY_KINDS.ATTACK) {
                setAttackPending({ payload });
                return;
            }

            await launchAbility(payload);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo lanzar la macro", severity: "error" }));
        }
    }, [busy, campaignId, character, dispatch, launchAbility]);

    const handleAttackConfirm = useCallback(async ({ boons, curses }) => {
        const pending = attackPending;
        setAttackPending(null);
        if (!pending?.payload) return;
        await launchAbility(pending.payload, { boons, curses });
    }, [attackPending, launchAbility]);

    const handleClearSlot = useCallback(async (slotIndex, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!character?.id) return;
        try {
            const next = setMacroSlot(bar, macroPage, slotIndex, null);
            await updateCharacterFields(character.id, { macroBar: serializeMacroBar(next) });
        } catch (err) {
            console.error(err);
        }
    }, [bar, character?.id, macroPage]);

    if (!open && !attackPending) return null;

    return (
        <>
        {open ? (
        <Paper
            elevation={0}
            data-no-token-drop
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            sx={{
                position: "relative",
                zIndex: 1210,
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: 0.65,
                px: 1,
                py: 0.55,
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 20px rgba(255,102,255,0.08)",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.2,
                    flexShrink: 0,
                    pr: 0.75,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                    minWidth: 52,
                }}
            >
                <CyberText
                    sx={{
                        fontFamily: "monospace",
                        fontSize: "0.42rem",
                        letterSpacing: "0.12em",
                        color: UI_COLORS.anomaly,
                        lineHeight: 1,
                    }}
                >
                    MACROS
                </CyberText>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.15,
                    }}
                >
                    <Box
                        component="button"
                        type="button"
                        aria-label="Página anterior"
                        onClick={() => dispatch(setMacroPage(
                            macroPage <= 0 ? MACRO_PAGE_COUNT - 1 : macroPage - 1,
                        ))}
                        sx={{
                            width: 18,
                            height: 22,
                            p: 0,
                            border: "none",
                            bgcolor: "transparent",
                            color: UI_COLORS.anomaly,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.7rem",
                            cursor: "pointer",
                            lineHeight: 1,
                            opacity: 0.85,
                            "&:hover": { opacity: 1, color: "#ffffff" },
                        }}
                    >
                        ‹
                    </Box>
                    <CyberTooltip
                        title={`Página ${macroPage + 1} de ${MACRO_PAGE_COUNT}`}
                        placement="top"
                    >
                        <Box
                            component="button"
                            type="button"
                            aria-label={`Página ${macroPage + 1} de ${MACRO_PAGE_COUNT}`}
                            onClick={() => dispatch(setMacroPage(
                                (macroPage + 1) % MACRO_PAGE_COUNT,
                            ))}
                            sx={{
                                minWidth: 28,
                                height: 22,
                                px: 0.35,
                                border: `1px solid ${UI_COLORS.anomaly}66`,
                                borderRadius: "3px",
                                bgcolor: `${UI_COLORS.anomaly}12`,
                                color: "#ffffff",
                                fontFamily: "'Orbitron', sans-serif",
                                fontSize: "0.58rem",
                                letterSpacing: "0.04em",
                                cursor: "pointer",
                                lineHeight: 1,
                                "&:hover": {
                                    borderColor: UI_COLORS.anomaly,
                                    bgcolor: `${UI_COLORS.anomaly}22`,
                                },
                            }}
                        >
                            {macroPage + 1}
                            <Box
                                component="span"
                                sx={{
                                    color: "rgba(255,255,255,0.45)",
                                    fontSize: "0.48rem",
                                    ml: "1px",
                                }}
                            >
                                /{MACRO_PAGE_COUNT}
                            </Box>
                        </Box>
                    </CyberTooltip>
                    <Box
                        component="button"
                        type="button"
                        aria-label="Página siguiente"
                        onClick={() => dispatch(setMacroPage(
                            (macroPage + 1) % MACRO_PAGE_COUNT,
                        ))}
                        sx={{
                            width: 18,
                            height: 22,
                            p: 0,
                            border: "none",
                            bgcolor: "transparent",
                            color: UI_COLORS.anomaly,
                            fontFamily: "'Fira Code', monospace",
                            fontSize: "0.7rem",
                            cursor: "pointer",
                            lineHeight: 1,
                            opacity: 0.85,
                            "&:hover": { opacity: 1, color: "#ffffff" },
                        }}
                    >
                        ›
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${MACRO_SLOT_COUNT}, 40px)`,
                    gap: 0.45,
                    py: 0.15,
                }}
            >
                {Array.from({ length: MACRO_SLOT_COUNT }, (_, i) => {
                    const slot = pageSlots[i];
                    const accent = slot ? macroTypeAccent(slot.type) : UI_COLORS.border;
                    return (
                        <CyberTooltip
                            key={i}
                            title={<MacroHoverTitle slot={slot} />}
                            placement="top"
                            slotProps={{
                                tooltip: {
                                    sx: {
                                        textTransform: "none",
                                        maxWidth: 260,
                                        bgcolor: "#0a0a14",
                                        border: `1px solid ${UI_COLORS.border}`,
                                        p: "8px 10px",
                                    },
                                },
                            }}
                        >
                            <IconButton
                                size="small"
                                disabled={busy || !slot}
                                onClick={() => slot && handleCall(slot)}
                                onContextMenu={(e) => slot && handleClearSlot(i, e)}
                                sx={{
                                    width: 40,
                                    height: 36,
                                    borderRadius: 1,
                                    border: `1px solid ${accent}${slot ? "" : "88"}`,
                                    color: slot ? accent : "rgba(255,255,255,0.25)",
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: "0.42rem",
                                    letterSpacing: "0.02em",
                                    bgcolor: slot ? `${accent}12` : "rgba(0,0,0,0.25)",
                                    "&:hover": slot ? {
                                        bgcolor: `${accent}22`,
                                        borderColor: accent,
                                        boxShadow: `0 0 10px ${accent}44`,
                                    } : {},
                                    "&.Mui-disabled": {
                                        border: `1px dashed ${UI_COLORS.border}`,
                                        color: "rgba(255,255,255,0.2)",
                                    },
                                }}
                            >
                                {slot ? macroSlotShortLabel(slot) : "·"}
                            </IconButton>
                        </CyberTooltip>
                    );
                })}
            </Box>

            <IconButton
                size="small"
                onClick={handleClose}
                aria-label="Cerrar barra de macros"
                sx={{
                    color: UI_COLORS.accent,
                    border: `1px solid ${UI_COLORS.border}`,
                    width: 26,
                    height: 26,
                    flexShrink: 0,
                    "&:hover": { bgcolor: `${UI_COLORS.accent}18` },
                }}
            >
                <CloseIcon sx={{ fontSize: "0.9rem" }} />
            </IconButton>
        </Paper>
        ) : null}
        <AttackBoonDialog
            open={!!attackPending}
            abilityLabel={attackPending?.payload?.label || "Ataque"}
            onClose={() => setAttackPending(null)}
            onConfirm={handleAttackConfirm}
        />
        </>
    );
}
