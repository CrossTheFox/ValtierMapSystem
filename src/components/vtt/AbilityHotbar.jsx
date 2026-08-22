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
    macroTypeLabel,
    normalizeMacroBar,
    serializeMacroBar,
    setMacroSlot,
    withHexAlpha,
} from "../../constants/macroBar";
import { ABILITY_KINDS, normalizeAbilityKind } from "../../constants/abilityKinds";
import { getAbilitiesByIds } from "../../../firebase/services/characterService";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { callAbilityInChat } from "../../../firebase/services/chatService";
import { setAbilityBarOpen, setMacroPage, showSnackbar } from "../../store/uiSlice";
import { updateCharacterInList } from "../../store/characterSlice";
import { updateCharacterInState } from "../../store/worldSlice";
import { HudRichTooltipTitle, hudRichTooltipSlotProps } from "./hudRichTooltip";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import { isMacroSlotDisabledByBurden, normalizeBurdens } from "../../utils/characterBurdens";

/** Fixed dock width so ACTIONS ↔ MACROS share one vertical slab (grow up/down, not sideways). */
export const COMBAT_DOCK_WIDTH = 560;
/** Match character life-sheet height only when Actions + Macros are both open. */
export const COMBAT_DOCK_MIN_HEIGHT = 148;

function MacroHoverTitle({ slot }) {
    if (!slot) return <HudRichTooltipTitle title="Vacío" />;
    const blurb = slot.blurb
        ? (slot.blurb.length > 160 ? `${slot.blurb.slice(0, 160)}…` : slot.blurb)
        : null;
    return (
        <HudRichTooltipTitle
            title={slot.label || slot.id}
            body={blurb}
            meta={macroTypeLabel(slot.type)}
            metaColor={macroTypeAccent(slot.type)}
        />
    );
}

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

/**
 * Centered bottom combat dock: optional ACTIONS row + MACROS bar.
 * Fixed to the horizontal center; grows upward when actions are shown.
 */
export default function AbilityHotbar({
    open,
    character,
    actionsSlot = null,
    actionsToolbar = null,
}) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const macroPage = useSelector((s) => s.ui.macroPage ?? 0);
    const [busy, setBusy] = useState(false);
    const [attackPending, setAttackPending] = useState(null); // { payload }

    const bar = useMemo(() => normalizeMacroBar(character?.macroBar), [character?.macroBar]);
    const pageSlots = bar.pages[macroPage] || [];
    const burdens = useMemo(() => normalizeBurdens(character?.burdens), [character?.burdens]);
    const showDock = Boolean(open || actionsSlot);
    const matchCharacterHudHeight = Boolean(open && actionsSlot);

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
        if (isMacroSlotDisabledByBurden(burdens, slot)) {
            dispatch(showSnackbar({
                message: "Bloqueado por Burden activo",
                severity: "warning",
            }));
            return;
        }

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
                characterAvatarUrl: character.tokenImageUrl || character.imageUrl || null,
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
    }, [busy, campaignId, character, dispatch, launchAbility, burdens]);

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
            const serialized = serializeMacroBar(next);
            await updateCharacterFields(character.id, { macroBar: serialized });
            dispatch(updateCharacterInList({
                id: character.id,
                data: { macroBar: serialized },
            }));
            dispatch(updateCharacterInState({
                id: character.id,
                locationId: character.locationId,
                data: { macroBar: serialized },
            }));
        } catch (err) {
            console.error(err);
        }
    }, [bar, character?.id, character?.locationId, dispatch, macroPage]);

    if (!showDock && !attackPending) return null;

    return (
        <>
        {showDock ? (
        <Paper
            elevation={0}
            data-no-token-drop
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            sx={{
                position: "fixed",
                bottom: VTT_HUD.inset,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1210,
                pointerEvents: "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                justifyContent: "flex-end",
                gap: 0.55,
                width: COMBAT_DOCK_WIDTH,
                maxWidth: "calc(100vw - 32px)",
                ...(matchCharacterHudHeight ? { minHeight: COMBAT_DOCK_MIN_HEIGHT } : {}),
                boxSizing: "border-box",
                px: 1,
                py: 0.65,
                borderRadius: `${VTT_HUD.borderRadius}px`,
                border: `1px solid ${VTT_HUD.glassBorder}`,
                bgcolor: VTT_HUD.glassBg,
                backdropFilter: "blur(14px)",
                boxShadow: "0 0 20px rgba(255,102,255,0.08)",
            }}
        >
            {actionsSlot ? (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.55,
                        width: "100%",
                        px: 0.25,
                        pb: open ? 0.65 : 0.15,
                        borderBottom: open ? `1px solid ${UI_COLORS.border}` : "none",
                        boxSizing: "border-box",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            minHeight: 22,
                        }}
                    >
                        <CyberText
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.42rem",
                                letterSpacing: "0.12em",
                                color: UI_COLORS.anomaly,
                                lineHeight: 1,
                                flexShrink: 0,
                            }}
                        >
                            ACTIONS
                        </CyberText>
                        {actionsToolbar}
                    </Box>
                    {actionsSlot}
                </Box>
            ) : null}

            {open ? (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.65,
                    width: "100%",
                    boxSizing: "border-box",
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
                    gridTemplateColumns: `repeat(${MACRO_SLOT_COUNT}, minmax(0, 1fr))`,
                    gap: 0.45,
                    py: 0.15,
                    flex: 1,
                    minWidth: 0,
                }}
            >
                {Array.from({ length: MACRO_SLOT_COUNT }, (_, i) => {
                    const slot = pageSlots[i];
                    const accent = slot ? macroTypeAccent(slot.type) : UI_COLORS.border;
                    const burdenBlocked = Boolean(slot && isMacroSlotDisabledByBurden(burdens, slot));
                    const tipTitle = burdenBlocked
                        ? (
                            <HudRichTooltipTitle
                                title={slot.label || slot.id}
                                body="Bloqueado por Burden activo"
                                meta={macroTypeLabel(slot.type)}
                                metaColor={UI_COLORS.danger}
                            />
                        )
                        : <MacroHoverTitle slot={slot} />;
                    return (
                        <CyberTooltip
                            key={i}
                            title={tipTitle}
                            placement="top"
                            slotProps={hudRichTooltipSlotProps}
                        >
                            <IconButton
                                size="small"
                                disabled={busy || !slot || burdenBlocked}
                                onClick={() => slot && !burdenBlocked && handleCall(slot)}
                                onContextMenu={(e) => slot && handleClearSlot(i, e)}
                                sx={{
                                    width: "100%",
                                    height: 40,
                                    borderRadius: 1,
                                    border: `1px solid ${slot
                                        ? (burdenBlocked ? UI_COLORS.danger : accent)
                                        : "rgba(255,255,255,0.22)"}`,
                                    color: burdenBlocked
                                        ? UI_COLORS.danger
                                        : (slot ? accent : UI_COLORS.textSecondary),
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: slot?.type === MACRO_SLOT_TYPES.ULTIMATE
                                        ? "0.55rem"
                                        : "0.42rem",
                                    letterSpacing: "0.02em",
                                    bgcolor: slot
                                        ? (burdenBlocked
                                            ? `${UI_COLORS.danger}14`
                                            : withHexAlpha(accent, "18"))
                                        : "rgba(0,0,0,0.35)",
                                    gap: 0.25,
                                    opacity: burdenBlocked ? 0.55 : 1,
                                    textDecoration: burdenBlocked ? "line-through" : "none",
                                    "&:hover": slot && !burdenBlocked ? {
                                        bgcolor: withHexAlpha(accent, "28"),
                                        borderColor: accent,
                                        boxShadow: `0 0 10px ${withHexAlpha(accent, "55")}`,
                                    } : {},
                                    "&.Mui-disabled": {
                                        border: burdenBlocked
                                            ? `1px solid ${UI_COLORS.danger}66`
                                            : "1px dashed rgba(255,255,255,0.18)",
                                        color: burdenBlocked
                                            ? UI_COLORS.danger
                                            : UI_COLORS.textSecondary,
                                        opacity: burdenBlocked ? 0.55 : undefined,
                                    },
                                }}
                            >
                                {slot?.type === MACRO_SLOT_TYPES.ULTIMATE ? (
                                    <WhatshotIcon sx={{ fontSize: "1.15rem", color: accent }} />
                                ) : (slot ? macroSlotShortLabel(slot) : "·")}
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
            </Box>
            ) : null}
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
