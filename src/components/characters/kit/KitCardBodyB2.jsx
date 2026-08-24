import { useCallback, useState } from "react";
import { Box } from "@mui/material";
import { mergeUnlockedUpgrades } from "../../../utils/mergeUnlockedUpgrades";
import { substituteFormulaTokens, viewPacketFormula } from "../../../utils/abilityFormula";
import { isKitNodeUnlocked } from "../../../utils/kitProgression";
import { useLocalText } from "../../../hooks/useLocalText";
import KitMarkdown from "../KitMarkdown";
import { UnlockBadge } from "./KitHeaderChips";
import { ABILITY_TEXTAREA_SX } from "./kitStyles";
import { FxRail, FX_LANE_COLOR, FX_LANE_LABEL } from "./FxRail";

export function kitFlavorText(node) {
    return String(
        node?.description || node?.blurb || node?.body || node?.content || node?.text || node?.summary || "",
    );
}

function FlavorBlock({ node, kitEdit, onPatch }) {
    const remote = kitFlavorText(node);
    const commitFlavor = useCallback((next) => {
        onPatch?.({ description: next, content: next, blurb: next });
    }, [onPatch]);
    const text = useLocalText(remote, commitFlavor);
    if (kitEdit) {
        return (
            <Box
                sx={{
                    border: "1px solid rgba(0,242,234,0.35)",
                    borderRadius: "3px",
                    bgcolor: "rgba(0,242,234,0.06)",
                    p: "6px 8px",
                    mb: "2px",
                }}
            >
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.38rem",
                    letterSpacing: "0.12em",
                    color: "rgba(0,242,234,0.75)",
                    mb: "4px",
                }}>
                    FLAVOR
                </Box>
                <Box
                    component="textarea"
                    value={text.value}
                    onFocus={text.onFocus}
                    onBlur={text.onBlur}
                    onChange={(e) => text.setValue(e.target.value)}
                    rows={3}
                    placeholder="Descripción / flavor…"
                    sx={{ ...ABILITY_TEXTAREA_SX, mt: 0, minHeight: 40 }}
                />
            </Box>
        );
    }
    if (!remote.trim()) return null;
    return (
        <Box
            sx={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "3px",
                bgcolor: "rgba(0,0,0,0.2)",
                p: "6px 10px",
            }}
        >
            <KitMarkdown content={remote} sx={{ mt: 0, fontSize: "0.78rem", lineHeight: 1.4, color: "rgba(255,255,255,0.88)" }} />
        </Box>
    );
}

/**
 * Body B2 — Slice 5. Rendered after the existing Flavor (`KitMarkdown`) block:
 * attack ticket row (if `hasAttack`) → effects rows → upgrades row (T1/T2/M).
 * VIEW merges unlocked talent/mastery mods via `mergeUnlockedUpgrades`; EDIT shows
 * the raw unmerged node (author view), per plan.
 */

const LANE_CYCLE = ["hit", "mech", "plain"];
const LANE_LABEL = FX_LANE_LABEL;
const LANE_COLOR = FX_LANE_COLOR;
const MACRO_TOKENS = ["[damageDie]", "[fray]", "[mechanicResource]"];
const MACRO_RE = /(\d*)\[[^\]]+\]/g;

function nextLane(lane) {
    const i = LANE_CYCLE.indexOf(lane);
    return LANE_CYCLE[(i < 0 ? 0 : i + 1) % LANE_CYCLE.length];
}

function extractMacroTokens(text) {
    return String(text || "").match(MACRO_RE) || [];
}

function TicketSlot({ label, packet, formulaCtx, fromUp, variant = "hit" }) {
    const top = variant === "aoe"
        ? "#00f2ea"
        : variant === "miss"
            ? "rgba(255,255,255,0.35)"
            : "#ff8a3d";
    const border = variant === "aoe"
        ? "rgba(0,242,234,0.45)"
        : variant === "miss"
            ? "rgba(255,255,255,0.14)"
            : "rgba(255,138,61,0.35)";
    const lblColor = variant === "aoe" ? "#00f2ea" : variant === "miss" ? "rgba(255,255,255,0.5)" : "#ff8a3d";
    return (
        <Box sx={{
            flex: 1,
            minWidth: 0,
            p: "7px 8px",
            borderRadius: "3px",
            border: `1px ${variant === "aoe" ? "dashed" : "solid"} ${fromUp ? "#ffcc3388" : border}`,
            borderTop: `2px solid ${fromUp ? "#ffcc33" : top}`,
            bgcolor: variant === "aoe" ? "rgba(0,242,234,0.06)" : (fromUp ? "rgba(255,204,51,0.08)" : "rgba(0,0,0,0.4)"),
        }}>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.38rem",
                letterSpacing: "0.1em",
                color: lblColor,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                mb: "2px",
            }}>
                {label}
                {fromUp && <Box component="span" sx={{ color: "#ffcc33" }}>· {fromUp}</Box>}
            </Box>
            <Box sx={{ fontFamily: "'Fira Code', monospace", fontSize: "1.02rem", color: "#fff", fontWeight: 600, lineHeight: 1.15 }}>
                {viewPacketFormula(packet, formulaCtx)}
            </Box>
        </Box>
    );
}

function AttackTicketRow({ node, formulaCtx }) {
    const atk = node?.attack;
    if (!node?.hasAttack || !atk) return null;
    const patches = node._mergeMeta?.attackPatches || {};
    const slots = [
        { key: "damageOnHit", label: "LIGHT", variant: "hit" },
        { key: "damageOnCrit", label: "HEAVY", variant: "hit" },
    ];
    if (!atk.autoHit) slots.push({ key: "damageOnMiss", label: "MISS", variant: "miss" });
    if (atk.damageAoe) slots.push({ key: "damageAoe", label: "AOE", variant: "aoe" });
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "6px", my: "8px 10px" }}>
            <Box sx={{ display: "flex", alignItems: "stretch", gap: "6px", flexWrap: "wrap" }}>
                <Box sx={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: "8px",
                    minWidth: 76,
                    borderRadius: "3px",
                    border: `1px solid ${atk.autoHit ? "rgba(245,197,66,0.65)" : "rgba(255,255,255,0.22)"}`,
                    bgcolor: atk.autoHit ? "rgba(245,197,66,0.12)" : "rgba(0,0,0,0.4)",
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.42rem",
                    letterSpacing: "0.1em",
                    color: atk.autoHit ? "#f5c542" : "rgba(255,255,255,0.55)",
                }}>
                    {atk.autoHit ? "AUTOHIT" : `+${atk.toHit?.boons || 0} BOONS`}
                </Box>
                {slots.map((s) => (
                    <TicketSlot
                        key={s.key}
                        label={s.label}
                        packet={atk[s.key]}
                        formulaCtx={formulaCtx}
                        fromUp={patches[s.key]}
                        variant={s.variant}
                    />
                ))}
            </Box>
        </Box>
    );
}

function EffectRowEdit({ fx, onChange, onDelete }) {
    const remote = fx.text || "";
    const commitText = useCallback((next) => {
        onChange({ text: next });
    }, [onChange]);
    const text = useLocalText(remote, commitText);
    const lane = fx.lane || "plain";
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                position: "relative",
                border: `1px solid ${lane === "hit" ? "rgba(255,138,61,0.35)" : lane === "mech" ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "3px",
                p: "4px 8px",
                bgcolor: "rgba(0,0,0,0.22)",
            }}
        >
            <Box
                component="button"
                type="button"
                title="Ciclar lane: ON HIT → MECH → NONE"
                onClick={() => {
                    text.flush();
                    onChange({ lane: nextLane(lane), label: LANE_LABEL[nextLane(lane)] });
                }}
                sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.38rem",
                    letterSpacing: "0.1em",
                    px: "7px",
                    py: "3px",
                    mt: "5px",
                    minWidth: "4.6em",
                    textAlign: "center",
                    borderRadius: "2px",
                    cursor: "pointer",
                    flexShrink: 0,
                    color: LANE_COLOR[lane] || LANE_COLOR.plain,
                    border: `1px solid ${(LANE_COLOR[lane] || LANE_COLOR.plain)}66`,
                    bgcolor: lane === "hit"
                        ? "rgba(255,138,61,0.12)"
                        : lane === "mech"
                            ? "rgba(167,139,250,0.12)"
                            : "transparent",
                }}
            >
                {LANE_LABEL[lane] || "NONE"}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: 0 }}>
                <Box
                    component="textarea"
                    value={text.value}
                    onFocus={text.onFocus}
                    onBlur={text.onBlur}
                    onChange={(e) => text.setValue(e.target.value)}
                    rows={2}
                    sx={{ ...ABILITY_TEXTAREA_SX, fontSize: "0.8rem", minHeight: 40, mb: 0 }}
                />
                <Box sx={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {MACRO_TOKENS.map((tok) => (
                        <Box
                            key={tok}
                            component="button"
                            type="button"
                            onClick={() => {
                                text.setValue(`${text.value || ""}${tok}`, { commitNow: true });
                            }}
                            title={`Insertar ${tok}`}
                            sx={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "0.62rem",
                                px: "7px",
                                py: "4px",
                                borderRadius: "2px",
                                cursor: "pointer",
                                color: "#fff",
                                border: "1px solid rgba(0,242,234,0.45)",
                                bgcolor: "rgba(0,0,0,0.35)",
                                "&:hover": { bgcolor: "rgba(0,242,234,0.12)" },
                            }}
                        >
                            {tok}
                        </Box>
                    ))}
                </Box>
            </Box>
            <Box
                component="button"
                type="button"
                onClick={() => {
                    text.cancel();
                    onDelete();
                }}
                title="Quitar efecto"
                sx={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: "0.72rem",
                    lineHeight: 1,
                    border: 0,
                    bgcolor: "transparent",
                    color: "rgba(255,255,255,0.45)",
                    cursor: "pointer",
                    p: "2px 2px 0",
                    flexShrink: 0,
                    alignSelf: "flex-start",
                    "&:hover": { color: "#ff3355" },
                }}
            >
                ×
            </Box>
        </Box>
    );
}

function EffectRowView({ fx, provenance, formulaCtx }) {
    const macros = extractMacroTokens(fx.text);
    const prose = String(fx.text || "").replace(MACRO_RE, "").replace(/\s+/g, " ").trim();
    const lane = fx.lane || "plain";
    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: `1px solid ${lane === "hit" ? "rgba(255,138,61,0.35)" : lane === "mech" ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "3px",
            p: "4px 8px",
            bgcolor: "rgba(0,0,0,0.22)",
        }}>
            {provenance && <FxRail badge={provenance} dense />}
            <Box sx={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.38rem",
                letterSpacing: "0.1em",
                px: "7px",
                py: "3px",
                borderRadius: "2px",
                flexShrink: 0,
                color: LANE_COLOR[lane] || LANE_COLOR.plain,
                border: `1px solid ${(LANE_COLOR[lane] || LANE_COLOR.plain)}66`,
            }}>
                {fx.label || LANE_LABEL[lane] || "NONE"}
            </Box>
            <Box sx={{ fontFamily: "'Fira Sans', sans-serif", fontSize: "0.74rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.35, minWidth: 0 }}>
                {prose || <Box component="span" sx={{ opacity: 0.4 }}>—</Box>}
                {macros.map((m, i) => (
                    <Box key={`${m}-${i}`} component="span" sx={{
                        ml: "5px",
                        fontFamily: "'Fira Code', monospace",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        color: "#00f2ea",
                        border: "1px solid #00f2ea",
                        borderRadius: "3px",
                        px: "5px",
                        bgcolor: "rgba(0,242,234,0.12)",
                    }}>
                        {substituteFormulaTokens(m, formulaCtx)}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

function EffectsRows({ node, kitEdit, onPatch, formulaCtx }) {
    const effects = node?.effects || [];
    if (!effects.length && !kitEdit) return null;
    const sources = node?._mergeMeta?.effectSources || {};

    if (kitEdit) {
        const patchEffect = (id, patch) => {
            onPatch?.({ effects: effects.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
        };
        const deleteEffect = (id) => {
            onPatch?.({ effects: effects.filter((e) => e.id !== id) });
        };
        const addEffect = () => {
            onPatch?.({ effects: [...effects, { id: `fx${Date.now().toString(36)}`, lane: "plain", label: "", text: "" }] });
        };
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "4px", mt: 0.5 }}>
                {effects.map((fx) => (
                    <EffectRowEdit
                        key={fx.id}
                        fx={fx}
                        onChange={(patch) => patchEffect(fx.id, patch)}
                        onDelete={() => deleteEffect(fx.id)}
                    />
                ))}
                <Box
                    component="button"
                    type="button"
                    onClick={addEffect}
                    sx={{
                        alignSelf: "flex-start",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.36rem",
                        letterSpacing: "0.1em",
                        px: "8px",
                        py: "4px",
                        borderRadius: "2px",
                        cursor: "pointer",
                        color: "#00f2ea",
                        border: "1px dashed rgba(0,242,234,0.4)",
                        bgcolor: "transparent",
                    }}
                >
                    + EFECTO
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "4px", mt: 0.5 }}>
            {effects.map((fx) => (
                <EffectRowView key={fx.id} fx={fx} provenance={sources[fx.id]} formulaCtx={formulaCtx} />
            ))}
        </Box>
    );
}

function UpgradeSlot({ badge, upgrade, character, ctx, disabled, onUnlockNode }) {
    const [open, setOpen] = useState(false);
    const boxSx = {
        p: "6px 8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.16)",
        bgcolor: "rgba(0,0,0,0.3)", minHeight: 40, opacity: disabled ? 0.4 : 1,
    };
    if (!upgrade) {
        return (
            <Box sx={boxSx}>
                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.46rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>
                    {badge}
                </Box>
                <Box sx={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)" }}>—</Box>
            </Box>
        );
    }
    const node = { id: upgrade.id || upgrade.key, unlockCostAP: upgrade.unlockCostAP };
    const unlocked = isKitNodeUnlocked(character, node, ctx);
    return (
        <Box sx={boxSx}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.46rem", letterSpacing: "0.06em", color: "#ffcc33", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {badge} · {upgrade.label}
                </Box>
                {!disabled && <UnlockBadge node={node} character={character} ctx={ctx} onUnlock={onUnlockNode} />}
            </Box>
            {unlocked && !disabled && (
                <>
                    <Box
                        onClick={() => setOpen((v) => !v)}
                        sx={{ fontSize: "0.46rem", color: "rgba(255,255,255,0.6)", cursor: "pointer", mt: "2px" }}
                    >
                        {open ? "▲ ocultar" : "▼ detalle"}
                    </Box>
                    {open && (
                        <Box sx={{ mt: "4px", fontSize: "0.76rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
                            {upgrade.blurb || upgrade.description || "Sin descripción."}
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
}

/** LB keeps T1/T2 disabled — only Mastery is an actionable slot for limit breaks. */
function UpgradesRow({ node, character, ctx, isLb, onUnlockNode }) {
    const [t1, t2] = node?.talents || [];
    const mastery = node?.mastery || null;
    if (!t1 && !t2 && !mastery) return null;
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", mt: 1 }}>
            <UpgradeSlot badge="T1" upgrade={t1} character={character} ctx={ctx} disabled={isLb} onUnlockNode={onUnlockNode} />
            <UpgradeSlot badge="T2" upgrade={t2} character={character} ctx={ctx} disabled={isLb} onUnlockNode={onUnlockNode} />
            <UpgradeSlot badge="M" upgrade={mastery} character={character} ctx={ctx} disabled={false} onUnlockNode={onUnlockNode} />
        </Box>
    );
}

export default function KitCardBodyB2({ node, character, ctx = {}, kitEdit, formulaCtx = {}, isLb = false, onPatch, onUnlockNode }) {
    if (!node) return null;
    const displayNode = kitEdit ? node : mergeUnlockedUpgrades(node, character, { ...ctx, isLb });
    return (
        <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: "6px", position: "relative", overflow: "visible" }}>
            <FlavorBlock node={displayNode} kitEdit={kitEdit} onPatch={onPatch} />
            <AttackTicketRow node={displayNode} formulaCtx={formulaCtx} />
            <EffectsRows node={displayNode} kitEdit={kitEdit} onPatch={onPatch} formulaCtx={formulaCtx} />
            <UpgradesRow node={node} character={character} ctx={ctx} isLb={isLb} onUnlockNode={onUnlockNode} />
        </Box>
    );
}
