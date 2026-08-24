import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import { cyberMenuPaperSx, cyberMenuItemSx } from "../../constants/designSystem";
import { KitSvgCross, KitSvgPulse, KitSvgLbStar, KitSvgTag } from "../../constants/kitSvg";
import { RangeChip, AoeChip, ResolveChip } from "../characters/kit/KitHeaderChips";
import { FxRail } from "../characters/kit/FxRail";
import { ChatTime, RawAvatar, faceMode } from "./chatCardShared";

/**
 * C2 chat card — Slice 6 (`PHASE-03-GUIDE.md` §6.4). Ports `cardC2()` from the
 * mockup 1:1 (`docs/mockups/kit-job-header/index.html` `#chat`, ~line 8003):
 * head (avatar/name/time/badge) → ID row (KIT_SVG mark + title) → chips
 * (range/AoE/RES/tags) → flavor → static roll band + damage ticket strip
 * (only when `hasAttack`) → effects rail. One post per Play, no `DiceChatCard`
 * duplication (the d20 face here is a static snapshot of the local reveal).
 *
 * Requires the richer Slice-6 payload (`abilityTone`/`abilityAttack`/
 * `abilityEffects`) — `VttChatPanel.ChatMessage` only renders this component
 * when `msg.abilityTone` is present; older messages keep the legacy card.
 */

const TONE_PALETTE = {
    atk: {
        accent: "#ff8a3d",
        badge: "ATK",
        border: "rgba(255,138,61,0.4)",
        background: "linear-gradient(135deg, rgba(255,138,61,0.08) 0%, rgba(7,7,14,0.94) 42%, rgba(0,0,0,0.6) 100%)",
        boxShadow: "0 0 18px rgba(255,138,61,0.12), inset 0 0 0 1px rgba(255,255,255,0.04)",
        headBorder: "rgba(255,138,61,0.22)",
        avatarBg: "rgba(255,138,61,0.2)",
        avatarBorder: "rgba(255,138,61,0.45)",
        badgeBorder: "rgba(255,138,61,0.4)",
        badgeBg: "rgba(255,138,61,0.12)",
    },
    std: {
        accent: "#00f2ea",
        badge: "ABILITY",
        border: "rgba(0,242,234,0.4)",
        background: "linear-gradient(135deg, rgba(255,138,61,0.08) 0%, rgba(7,7,14,0.94) 42%, rgba(0,0,0,0.6) 100%)",
        boxShadow: "0 0 18px rgba(0,242,234,0.1), inset 0 0 0 1px rgba(255,255,255,0.04)",
        headBorder: "rgba(0,242,234,0.22)",
        avatarBg: "rgba(0,242,234,0.18)",
        avatarBorder: "rgba(0,242,234,0.45)",
        badgeBorder: "rgba(0,242,234,0.4)",
        badgeBg: "rgba(0,242,234,0.12)",
    },
    lb: {
        accent: "#ffcc33",
        badge: "LB",
        border: "rgba(255,204,51,0.55)",
        background: "linear-gradient(135deg, rgba(255,204,51,0.16) 0%, rgba(7,7,14,0.94) 42%, rgba(0,0,0,0.6) 100%)",
        boxShadow: "0 0 20px rgba(255,204,51,0.18), inset 0 0 0 1px rgba(255,204,51,0.1)",
        headBorder: "rgba(255,204,51,0.38)",
        avatarBg: "rgba(255,204,51,0.2)",
        avatarBorder: "rgba(255,204,51,0.55)",
        badgeBorder: "rgba(255,204,51,0.55)",
        badgeBg: "rgba(255,204,51,0.14)",
    },
};

const ROLLBAND_TONE = {
    atk: {
        border: "rgba(255,138,61,0.55)",
        background: "linear-gradient(90deg, rgba(255,138,61,0.22) 0%, rgba(255,138,61,0.06) 58%, rgba(0,0,0,0.28) 100%)",
        boxShadow: "inset 3px 0 0 #ff8a3d, 0 0 16px rgba(255,138,61,0.18)",
        label: "#ff8a3d",
        totalShadow: "0 0 14px rgba(255,138,61,0.45)",
    },
    fail: {
        border: "rgba(255,51,85,0.5)",
        background: "linear-gradient(90deg, rgba(255,51,85,0.18) 0%, rgba(255,51,85,0.04) 58%, rgba(0,0,0,0.28) 100%)",
        boxShadow: "inset 3px 0 0 #ff3355, 0 0 14px rgba(255,51,85,0.16)",
        label: "#ff3355",
        totalShadow: "0 0 12px rgba(255,51,85,0.4)",
    },
    crit: {
        border: "rgba(255,204,51,0.6)",
        background: "linear-gradient(90deg, rgba(255,204,51,0.2) 0%, rgba(255,204,51,0.05) 58%, rgba(0,0,0,0.28) 100%)",
        boxShadow: "inset 3px 0 0 #ffcc33, 0 0 16px rgba(255,204,51,0.22)",
        label: "#ffcc33",
        totalShadow: "0 0 12px rgba(255,204,51,0.4)",
    },
};

const CC_LANE_COLOR = { hit: "#ff8a3d", mech: "#a78bfa", plain: "#00f2ea" };
const CC_LANE_LABEL = { hit: "ON HIT", mech: "MECH", plain: "EFFECT" };

function bandTone(atk) {
    if (!atk || atk.autoHit || atk.raw == null) return "atk";
    if (Number(atk.raw) === 1) return "fail";
    if (Number(atk.raw) === 20) return "crit";
    return "atk";
}

function C2Head({ msg, avatarByCharacterId, palette, tone, hasAttack }) {
    const name = msg.characterName || msg.senderName || "???";
    const livePath = msg.characterId ? avatarByCharacterId?.get(msg.characterId) : null;
    const avatarPath = livePath || msg.characterAvatarUrl;
    const Mark = tone === "lb" ? KitSvgLbStar : hasAttack ? KitSvgCross : KitSvgPulse;
    return (
        <>
            <Box sx={{
                display: "flex", alignItems: "center", gap: "7px",
                px: 1, pt: 0.7, pb: 0.45, borderBottom: `1px solid ${palette.headBorder}`,
            }}>
                <Box sx={{
                    width: 24, height: 24, flexShrink: 0, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                    fontFamily: "'Fira Sans', sans-serif", fontSize: "0.6rem", fontWeight: 700,
                    bgcolor: palette.avatarBg, border: `1px solid ${palette.avatarBorder}`, color: palette.accent,
                    "& img, & span": { width: "100%", height: "100%", objectFit: "cover", display: "flex", alignItems: "center", justifyContent: "center" },
                }}>
                    <RawAvatar path={avatarPath} name={name} className="" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{
                        fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.3px", lineHeight: 1.2,
                        color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        display: "flex", alignItems: "center",
                    }}>
                        {name}
                        <ChatTime createdAt={msg.createdAt} />
                    </Box>
                </Box>
                <Box sx={{
                    flexShrink: 0, height: 18, display: "inline-flex", alignItems: "center",
                    px: "6px", borderRadius: "9px", fontSize: "0.5rem", letterSpacing: "1.2px", fontWeight: 700,
                    color: palette.accent, border: `1px solid ${palette.badgeBorder}`, bgcolor: palette.badgeBg,
                }}>
                    {palette.badge}
                </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px", px: 1, pt: 0.75, pb: 0.25 }}>
                <Box sx={{ width: tone === "lb" ? 16 : 14, height: tone === "lb" ? 16 : 14, flexShrink: 0, color: palette.accent, display: "flex" }}>
                    <Mark size={tone === "lb" ? 16 : 14} />
                </Box>
                <Box sx={{
                    flex: 1, minWidth: 0, fontFamily: "Orbitron, sans-serif", fontSize: "0.66rem",
                    letterSpacing: "0.08em", color: "#fff", textTransform: "uppercase",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                    {msg.abilityLabel || "ABILITY"}
                </Box>
            </Box>
        </>
    );
}

function C2TagPopover({ tags }) {
    const [anchor, setAnchor] = useState(null);
    if (!tags?.length) return null;
    return (
        <>
            <Box
                component="button"
                type="button"
                onClick={(e) => setAnchor(e.currentTarget)}
                title="Tags"
                sx={{
                    ml: "auto", display: "inline-flex", alignItems: "center", gap: "3px",
                    height: 22, px: "6px", borderRadius: "3px", cursor: "pointer",
                    color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.5)", bgcolor: "rgba(167,139,250,0.1)",
                }}
            >
                <KitSvgTag size={12} />
                <Box component="span" sx={{ fontFamily: "'Fira Code', monospace", fontSize: "0.62rem" }}>{tags.length}</Box>
            </Box>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { ...cyberMenuPaperSx, minWidth: 132, border: "1px solid rgba(167,139,250,0.55)" } } }}
            >
                {tags.map((t) => (
                    <MenuItem key={t} disableRipple sx={{ ...cyberMenuItemSx, fontSize: "0.68rem", fontFamily: "'Fira Code', monospace", cursor: "default" }}>
                        {t}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

function C2Chips({ msg }) {
    const hasRange = msg.abilityRange && msg.abilityRange !== "self";
    const hasAoe = Boolean(msg.abilityAoe);
    const hasRes = msg.abilityResolveCost != null;
    const tags = Array.isArray(msg.abilityTags) ? msg.abilityTags : [];
    if (!hasRange && !hasAoe && !hasRes && !tags.length) return null;
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px", px: 1, pt: 0.5, pb: 0.75 }}>
            {hasRange && <RangeChip value={msg.abilityRange} />}
            {hasAoe && <AoeChip value={msg.abilityAoe} />}
            {hasRes && <ResolveChip value={msg.abilityResolveCost} />}
            <C2TagPopover tags={tags} />
        </Box>
    );
}

function DiceFace({ value, mode }) {
    const toneSx = mode === "fail"
        ? { borderColor: "rgba(255,51,85,0.55)", color: "#ff3355", boxShadow: "0 0 8px rgba(255,51,85,0.35)" }
        : mode === "crit"
            ? { borderColor: "rgba(255,204,51,0.55)", color: "#ffcc33", boxShadow: "0 0 8px rgba(255,204,51,0.35)" }
            : mode === "boon"
                ? { borderColor: "rgba(74,222,128,0.65)", color: "#4ade80" }
                : mode === "curse"
                    ? { borderColor: "rgba(255,51,85,0.65)", color: "#ff3355" }
                    : {};
    return (
        <Box sx={{
            minWidth: 22, height: 22, px: "4px", borderRadius: "4px",
            bgcolor: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.35)",
            fontFamily: "'Fira Code', monospace", fontSize: "0.68rem", fontWeight: 700, color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            ...toneSx,
        }}>
            {value}
        </Box>
    );
}

function C2RollBand({ atk }) {
    if (!atk) return null;
    if (atk.autoHit) {
        const t = ROLLBAND_TONE.atk;
        return (
            <Box sx={{
                display: "flex", alignItems: "center", gap: "10px",
                mx: 1, mt: "2px", p: "8px 10px", borderRadius: "4px",
                border: `1px solid ${t.border}`, background: t.background, boxShadow: t.boxShadow,
            }}>
                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.62rem", letterSpacing: "0.12em", color: t.label }}>
                    Autohit
                </Box>
            </Box>
        );
    }
    const tone = bandTone(atk);
    const t = ROLLBAND_TONE[tone];
    const modClass = atk.polarity === "curse" ? "curse" : "boon";
    return (
        <Box sx={{
            display: "flex", alignItems: "center", gap: "10px",
            mx: 1, mt: "2px", p: "8px 10px", borderRadius: "4px",
            border: `1px solid ${t.border}`, background: t.background, boxShadow: t.boxShadow,
        }}>
            <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.42rem", letterSpacing: "0.14em", color: t.label, minWidth: 52 }}>
                {atk.outcome}
            </Box>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif", fontSize: "1.42rem", letterSpacing: "0.06em",
                color: "#fff", lineHeight: 1, textShadow: t.totalShadow, flexShrink: 0,
            }}>
                {atk.total ?? "—"}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: "3px", ml: "auto", pl: 1 }}>
                <DiceFace value={atk.raw} mode={faceMode(atk.raw, 20)} />
                {atk.modifierDice?.length > 0 && (
                    <>
                        <Box component="span" sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", mx: "2px" }}>
                            {atk.polarity === "curse" ? "−" : "+"}
                        </Box>
                        {atk.modifierDice.map((f, i) => (
                            <DiceFace key={i} value={f} mode={modClass} />
                        ))}
                    </>
                )}
            </Box>
        </Box>
    );
}

function stripLabel(key) {
    if (key === "light") return "Light";
    if (key === "heavy") return "Heavy";
    if (key === "miss") return "Miss";
    return "AoE";
}

function C2Strip({ atk }) {
    const [openKey, setOpenKey] = useState(null);
    if (!atk) return null;
    const cells = [];
    if (atk.light) cells.push({ key: "light", ...atk.light });
    if (atk.heavy) cells.push({ key: "heavy", ...atk.heavy });
    if (atk.miss) cells.push({ key: "miss", ...atk.miss });
    if (atk.aoe) cells.push({ key: "aoe", ...atk.aoe });
    if (!cells.length) return null;
    return (
        <Box sx={{ display: "flex", flexWrap: "nowrap", borderTop: "1px solid rgba(255,255,255,0.12)", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
            {cells.map((c, i) => {
                const isAoe = c.key === "aoe";
                const isOpen = openKey === c.key;
                const labelColor = isAoe ? "#00f2ea" : "#ff8a3d";
                return (
                    <Box
                        key={c.key}
                        component="button"
                        type="button"
                        onClick={() => setOpenKey(isOpen ? null : c.key)}
                        sx={{
                            flex: 1, minWidth: 0, p: "6px 4px 7px", textAlign: "center", position: "relative",
                            font: "inherit", color: "inherit", cursor: "pointer", border: 0,
                            borderRight: i < cells.length - 1 ? "1px solid rgba(255,255,255,0.1)" : 0,
                            borderLeft: isAoe ? "1px dashed rgba(0,242,234,0.4)" : 0,
                            bgcolor: isOpen ? (isAoe ? "rgba(0,242,234,0.1)" : "rgba(255,138,61,0.08)") : (isAoe ? "rgba(0,242,234,0.05)" : "transparent"),
                            "&:hover": { bgcolor: isAoe ? "rgba(0,242,234,0.1)" : "rgba(255,255,255,0.04)" },
                        }}
                    >
                        {c.fromUp && (
                            <Box sx={{
                                position: "absolute", top: "3px", right: "4px",
                                fontFamily: "Orbitron, sans-serif", fontSize: "0.5rem", letterSpacing: "0.08em",
                                color: c.fromUp === "M" ? "#f5c542" : "#00f2ea",
                            }}>
                                {c.fromUp}
                            </Box>
                        )}
                        <Box sx={{ display: "block", mb: "2px", fontFamily: "Orbitron, sans-serif", fontSize: "0.5rem", letterSpacing: "0.08em", color: labelColor }}>
                            {stripLabel(c.key)}
                        </Box>
                        <Box sx={{ display: "block", fontSize: "0.92rem", color: isAoe ? "#00f2ea" : "#fff" }}>
                            {c.total}
                        </Box>
                        {isOpen && (
                            <Box sx={{ display: "block", fontFamily: "'Fira Code', monospace", fontSize: "0.52rem", color: "rgba(255,255,255,0.65)", mt: "4px", lineHeight: 1.3 }}>
                                {c.detail}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}

function C2FxLine({ fx }) {
    const rolls = Array.isArray(fx.rolls) ? fx.rolls : [];
    return (
        <Box sx={{ display: "flex", alignItems: "stretch", gap: "6px", py: "4px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {fx.from ? (
                <FxRail badge={fx.from} dense />
            ) : (
                <Box sx={{ width: "3px", flexShrink: 0, alignSelf: "stretch", borderRadius: "1px", mt: "2px", bgcolor: CC_LANE_COLOR[fx.lane] || CC_LANE_COLOR.plain }} />
            )}
            <Box sx={{ display: "flex", alignItems: "baseline", gap: "8px", minWidth: 0, flex: 1 }}>
                <Box sx={{
                    flexShrink: 0, minWidth: "3.8em", fontFamily: "Orbitron, sans-serif", fontSize: "0.42rem",
                    letterSpacing: "0.08em", color: CC_LANE_COLOR[fx.lane] || CC_LANE_COLOR.plain,
                }}>
                    {fx.label || CC_LANE_LABEL[fx.lane] || "EFFECT"}
                </Box>
                <Box sx={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
                    {fx.resolvedText}
                    {rolls.map((r, i) => (
                        <Box
                            key={i}
                            component="span"
                            title={r.formula}
                            sx={{
                                display: "inline-flex", alignItems: "baseline", gap: "3px",
                                fontFamily: "'Fira Code', monospace", fontWeight: 700, fontSize: "0.82rem",
                                px: "5px", ml: "4px", borderRadius: "3px",
                                border: "1px solid #00f2ea", color: "#00f2ea", bgcolor: "rgba(0,242,234,0.12)",
                            }}
                        >
                            {r.total}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

export default function AbilityC2Card({ msg, avatarByCharacterId }) {
    const tone = msg.abilityTone === "lb" ? "lb" : msg.abilityTone === "std" ? "std" : "atk";
    const hasAttack = Boolean(msg.abilityAttack);
    const palette = TONE_PALETTE[tone];
    const effects = Array.isArray(msg.abilityEffects) ? msg.abilityEffects : [];

    return (
        <Box sx={{
            mb: 0.9, borderRadius: "6px", overflow: "hidden",
            border: `1px solid ${palette.border}`, background: palette.background, boxShadow: palette.boxShadow,
        }}>
            <C2Head msg={msg} avatarByCharacterId={avatarByCharacterId} palette={palette} tone={tone} hasAttack={hasAttack} />
            <C2Chips msg={msg} />
            {msg.text ? (
                <Box component="p" sx={{ m: 0, px: "10px", pt: "2px", pb: 1, fontSize: "0.82rem", lineHeight: 1.4, color: "rgba(255,255,255,0.78)", fontStyle: "italic" }}>
                    {msg.text}
                </Box>
            ) : null}
            {hasAttack && <C2RollBand atk={msg.abilityAttack} />}
            {hasAttack && <C2Strip atk={msg.abilityAttack} />}
            {effects.length > 0 && (
                <Box sx={{ px: 1, pb: 1, pt: hasAttack ? 0.5 : 0 }}>
                    {effects.map((fx) => (
                        <C2FxLine key={fx.id} fx={fx} />
                    ))}
                </Box>
            )}
        </Box>
    );
}
