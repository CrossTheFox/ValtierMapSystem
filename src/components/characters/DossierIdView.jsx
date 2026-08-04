import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Box, IconButton, Tooltip } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { uploadCharacterImage } from "../../../firebase/services/assetLoader";
import { callAbilityInChat } from "../../../firebase/services/chatService";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { useDossier } from "../CharactersSettingsDialog";
import MacroPinButton from "./MacroPinButton";
import { MACRO_SLOT_TYPES } from "../../constants/macroBar";
import { normalizeTokenCrop, tokenCropCss } from "../../utils/tokenImageFit";

/* ── colour tokens ──────────────────────────────────────────────── */
const C = {
    border:  UI_COLORS.border,
    text:    "#ffffff",
    pink:    UI_COLORS.accent,
    cyan:    UI_COLORS.anomaly,
    lb:      "#ffcc33",
    danger:  "#ff3355",
};

const SCROLL_SX = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-thumb": {
        background: `rgba(0,242,234,0.25)`,
        borderRadius: "3px",
    },
    "&::-webkit-scrollbar-track": { background: "transparent" },
};

const ACTION_KEYS = ["sneak","traverse","sense","study","charm","command","tinker","excel","smash","endure"];
/** ICON narrative actions: each score caps at 4. */
const MAX_STAT = 4;

const tooltipSlotProps = {
    tooltip: {
        sx: {
            bgcolor: "#0a0a14",
            color: "#ffffff",
            border: `1px solid ${UI_COLORS.border}`,
            fontSize: "0.72rem",
        },
    },
};

/* ── Segmented action row (ref design) ───────────────────────────── */
function ActionSegmentRow({
    actionKey,
    value,
    selected,
    editMode,
    onSelect,
    onChange,
}) {
    const v = Math.max(0, Number(value) || 0);
    const over = v > MAX_STAT;
    const fill = Math.min(v, MAX_STAT);
    const accent = over ? C.danger : C.pink;

    return (
        <Box
            className={`dossier-stat-row${selected ? " is-selected" : ""}`}
            onClick={onSelect}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                p: "4px 4px",
                borderRadius: "5px",
                border: `1px solid ${selected ? C.cyan : "transparent"}`,
                bgcolor: selected ? "rgba(0,242,234,0.06)" : "transparent",
                cursor: editMode ? "pointer" : "default",
                "&:hover": { bgcolor: "rgba(255,102,255,0.05)" },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 0.75 }}>
                <Box sx={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.58rem",
                    color: "#ffffff",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                }}>
                    {actionKey}
                </Box>
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.72rem",
                    color: accent,
                    lineHeight: 1,
                }}>
                    {v}
                </Box>
            </Box>
            <Box sx={{ display: "flex", gap: "3px" }}>
                {Array.from({ length: MAX_STAT }, (_, i) => {
                    const filled = i < fill;
                    return (
                        <Box
                            key={i}
                            component={editMode ? "button" : "div"}
                            type={editMode ? "button" : undefined}
                            onClick={editMode ? (e) => {
                                e.stopPropagation();
                                const next = i < fill && i === fill - 1 ? i : i + 1;
                                onChange(next);
                            } : undefined}
                            sx={{
                                flex: 1,
                                height: 10,
                                borderRadius: "2px",
                                border: `1px solid ${filled ? accent : "rgba(255,255,255,0.18)"}`,
                                bgcolor: filled ? accent : "transparent",
                                boxShadow: filled ? `0 0 6px ${accent}44` : "none",
                                p: 0,
                                cursor: editMode ? "pointer" : "default",
                                transition: "background 0.12s, border-color 0.12s",
                                "&:hover": editMode ? {
                                    borderColor: accent,
                                    bgcolor: filled ? accent : `${accent}33`,
                                } : {},
                            }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}

/* ── NarrCard ─────────────────────────────────────────────────────── */
function NarrCard({
    tag,
    tagColor,
    title,
    text,
    selKey,
    selected,
    onSelect,
    editMode,
    onSave,
    onSendToChat,
    onToggleShortcut,
    isShortcut = false,
    compact = false,
    character = null,
    macroEntry = null,
}) {
    const { spawnPing } = useDossier();
    const isSelected = selected === selKey;
    const isBond = selKey?.startsWith("bond:");

    const handleClick = (e) => {
        if (e.target.tagName === "TEXTAREA" || e.target.closest?.("button")) return;
        onSelect(selKey);
        spawnPing(e.clientX, e.clientY);
    };

    return (
        <Box
            className={`dossier-narr-card${isSelected ? " is-selected" : ""}`}
            onClick={handleClick}
            sx={{
                position: "relative",
                mb: compact ? 0 : "10px",
                p: "12px 14px",
                border: `1px solid ${isSelected ? C.cyan : C.border}`,
                borderRadius: "8px",
                bgcolor: "rgba(0,0,0,0.28)",
                cursor: "pointer",
                flex: compact ? 1 : undefined,
                minWidth: 0,
                boxShadow: isSelected ? `0 0 18px rgba(0,242,234,0.12)` : "none",
                transition: "border-color 0.18s, box-shadow 0.18s, transform 0.15s",
                "&:hover": { borderColor: "rgba(255,102,255,0.4)", transform: "translateY(-1px)" },
            }}
        >
            <div className="dossier-brackets" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
            </div>

            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "6px" }}>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.62rem",
                    letterSpacing: "0.1em",
                    color: "#ffffff",
                    border: `1px solid ${tagColor ? tagColor + "88" : "rgba(255,204,51,0.55)"}`,
                    px: "6px", py: "2px", borderRadius: "3px",
                }}>
                    {tag}
                </Box>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.82rem",
                    letterSpacing: "0.1em",
                    color: "#ffffff",
                    flex: 1,
                    minWidth: 0,
                }}>
                    {title}
                </Box>
                <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    {macroEntry && character && (
                        <MacroPinButton character={character} entry={macroEntry} size="tiny" />
                    )}
                    {typeof onSendToChat === "function" && (
                        <Tooltip title="Lanzar en chat" slotProps={tooltipSlotProps}>
                            <IconButton
                                size="small"
                                aria-label="Lanzar en chat"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSendToChat();
                                }}
                                sx={{
                                    color: "#ffffff",
                                    border: `1px solid ${C.border}`,
                                    width: 28,
                                    height: 28,
                                    "&:hover": { borderColor: C.pink, bgcolor: `${C.pink}18` },
                                }}
                            >
                                <ChatIcon sx={{ fontSize: "0.95rem" }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {typeof onToggleShortcut === "function" && (
                        <Tooltip title={isShortcut ? "Quitar de Shortcuts" : "Añadir a Shortcuts"} slotProps={tooltipSlotProps}>
                            <IconButton
                                size="small"
                                aria-label="Shortcut"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleShortcut();
                                }}
                                sx={{
                                    color: isShortcut ? C.cyan : "#ffffff",
                                    border: `1px solid ${isShortcut ? C.cyan : C.border}`,
                                    width: 28,
                                    height: 28,
                                    bgcolor: isShortcut ? `${C.cyan}14` : "transparent",
                                    "&:hover": { borderColor: C.cyan, bgcolor: `${C.cyan}18` },
                                }}
                            >
                                {isShortcut
                                    ? <PushPinIcon sx={{ fontSize: "0.95rem" }} />
                                    : <PushPinOutlinedIcon sx={{ fontSize: "0.95rem" }} />}
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {editMode && isSelected ? (
                <textarea
                    value={text || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onSave && onSave(e.target.value)}
                    style={{
                        width: "100%",
                        minHeight: isBond ? "110px" : "72px",
                        marginTop: "4px",
                        resize: "vertical",
                        background: "rgba(0,0,0,0.45)",
                        border: `1px solid rgba(255,102,255,0.35)`,
                        color: "#ffffff",
                        fontFamily: '"Fira Sans", sans-serif',
                        fontSize: "0.9rem",
                        padding: "8px",
                        borderRadius: "4px",
                    }}
                />
            ) : (
                <Box component="p" sx={{
                    m: 0,
                    fontSize: "0.9rem",
                    color: "#ffffff",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                }}>
                    {text || <em style={{ opacity: 0.45 }}>Sin texto</em>}
                </Box>
            )}
        </Box>
    );
}

/* ── RadarSVG ─────────────────────────────────────────────────────── */
function RadarSvg({ stats, maxStat }) {
    const n = ACTION_KEYS.length;
    const R = 78, cx = 100, cy = 100;
    const pts = ACTION_KEYS.map((k, i) => {
        const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
        const r = ((stats[k] || 0) / maxStat) * R;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    const axes = ACTION_KEYS.map((k, i) => {
        const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
        const x2 = cx + Math.cos(a) * R, y2 = cy + Math.sin(a) * R;
        const lx = cx + Math.cos(a) * (R + 16), ly = cy + Math.sin(a) * (R + 16);
        return { a, x2, y2, lx, ly, label: k.slice(0, 3).toUpperCase() };
    });
    const polyPts = pts.map((p) => p.join(",")).join(" ");

    return (
        <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: 220 }}>
            {axes.map(({ x2, y2, lx, ly, label }, i) => (
                <g key={i}>
                    <line
                        x1={cx} y1={cy} x2={x2} y2={y2}
                        stroke="rgba(42,42,61,0.8)" strokeWidth="1"
                    />
                    <text
                        x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fill="#ffffff"
                        style={{ fontSize: "10px", fontFamily: "Fira Code, monospace", letterSpacing: "0.06em" }}
                    >
                        {label}
                    </text>
                </g>
            ))}
            <polygon
                points={polyPts}
                fill="rgba(255,102,255,0.22)"
                stroke={C.pink}
                strokeWidth="1.5"
            />
        </svg>
    );
}

/* ── SectionLabel ─────────────────────────────────────────────────── */
function SectionLabel({ children, limit }) {
    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            mb: "10px",
            mt: "18px",
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.58rem",
            letterSpacing: "0.14em",
            color: "#ffffff",
            "&::after": {
                content: '""',
                flex: 1,
                height: "1px",
                background: `linear-gradient(90deg, ${C.cyan}66, transparent)`,
            },
        }}>
            {children}
            {limit && (
                <Box component="span" sx={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.75)", ml: 0.5 }}>
                    {limit}
                </Box>
            )}
        </Box>
    );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function DossierIdView({ character }) {
    const { editMode, spawnPing, patchDraft } = useDossier();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);

    const [selected, setSelected] = useState(null);
    const bannerInputRef = useRef(null);
    const tokenInputRef  = useRef(null);
    const [uploading, setUploading] = useState(false);

    const bond = character?.bond || {};
    const rawStats = character?.stats || {};
    const stats = Object.fromEntries(
        ACTION_KEYS.map((k) => [k, Math.min(MAX_STAT, Math.max(0, Number(rawStats[k]) || 0))]),
    );
    const bondPowers = Array.isArray(character?.bondPowers) ? character.bondPowers : [];
    const narrativeShortcuts = Array.isArray(character?.narrativeShortcuts)
        ? character.narrativeShortcuts
        : [];

    /** Persist clamp for legacy >4 values (outside draft). */
    useEffect(() => {
        if (!character?.id || !character?.stats || editMode) return;
        const patch = {};
        let dirty = false;
        for (const key of ACTION_KEYS) {
            const n = Number(character.stats[key]);
            if (Number.isFinite(n) && n > MAX_STAT) {
                patch[`stats.${key}`] = MAX_STAT;
                dirty = true;
            }
        }
        if (dirty) updateCharacterFields(character.id, patch).catch(console.error);
    }, [character?.id, character?.stats, editMode]);

    const setStat = useCallback((key, value) => {
        const next = Math.min(MAX_STAT, Math.max(0, Number(value) || 0));
        patchDraft({ stats: { [key]: next } });
    }, [patchDraft]);

    const saveBondField = useCallback((field, value) => {
        patchDraft({ bond: { [field]: value } });
    }, [patchDraft]);

    const saveBondPower = useCallback((powerId, value) => {
        const updated = bondPowers.map((bp) =>
            (bp.id || bp.key) === powerId ? { ...bp, description: value } : bp
        );
        patchDraft({ bondPowers: updated });
    }, [bondPowers, patchDraft]);

    const saveIdeal = useCallback((idx, value) => {
        const next = [...(bond.ideals || [])];
        while (next.length < 3) next.push("");
        next[idx] = value;
        patchDraft({ bond: { ideals: next } });
    }, [bond.ideals, patchDraft]);

    const isShortcutPinned = useCallback((key) => (
        narrativeShortcuts.some((s) => s.key === key)
    ), [narrativeShortcuts]);

    const toggleShortcut = useCallback((entry) => {
        if (!entry?.key) return;
        const exists = narrativeShortcuts.some((s) => s.key === entry.key);
        const next = exists
            ? narrativeShortcuts.filter((s) => s.key !== entry.key)
            : [...narrativeShortcuts, entry];
        patchDraft({ narrativeShortcuts: next });
    }, [narrativeShortcuts, patchDraft]);

    const sendNarrativeToChat = useCallback(async ({ kind, title, text, id }) => {
        if (!campaignId || !character) return;
        try {
            await callAbilityInChat(
                campaignId,
                profile,
                {
                    id: id || `narrative:${kind}`,
                    label: `${kind} · ${title}`,
                    content: text || "",
                    characterId: character.id,
                    characterName: character.name,
                },
                { character },
            );
        } catch (err) {
            console.error("[DossierIdView] chat:", err);
        }
    }, [campaignId, profile, character]);

    const handleSelect = (key) => setSelected(key);

    const handleBannerClick = (e) => {
        if (!editMode) return;
        spawnPing(e.clientX, e.clientY);
        bannerInputRef.current?.click();
    };
    const handleBannerFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !character?.id) return;
        setUploading(true);
        try {
            const { url } = await uploadCharacterImage(character.id, file);
            patchDraft({ bannerUrl: url });
        } catch (err) {
            console.error("[DossierIdView] banner upload:", err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleTokenClick = (e) => {
        if (!editMode) return;
        spawnPing(e.clientX, e.clientY);
        tokenInputRef.current?.click();
    };
    const handleTokenFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !character?.id) return;
        setUploading(true);
        try {
            const { url } = await uploadCharacterImage(character.id, file);
            patchDraft({ imageUrl: url });
        } catch (err) {
            console.error("[DossierIdView] token upload:", err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleStatClick = useCallback((e, key) => {
        const row = e.currentTarget;
        setSelected(`action:${key}`);
        row.classList.remove("glitch-snap");
        void row.offsetWidth;
        row.classList.add("glitch-snap");
        spawnPing(e.clientX, e.clientY);
        setTimeout(() => row.classList.remove("glitch-snap"), 600);
    }, [spawnPing]);

    const handleAddBond = () => {
        if (!editMode) return;
        const id = `bp_${Date.now()}`;
        const next = [...bondPowers, { id, title: "NEW BOND", description: "" }];
        patchDraft({ bondPowers: next });
    };

    const bannerPath = character?.bannerUrl || null;
    const tokenPath = character?.tokenImageUrl || character?.imageUrl || null;
    const displayBannerPath = bannerPath || tokenPath;
    const resolvedBannerUrl = useAssetUrl(displayBannerPath);
    const resolvedTokenUrl = useAssetUrl(tokenPath);
    const cropCss = tokenCropCss(normalizeTokenCrop(character?.tokenCrop));
    const hasBanner = Boolean(resolvedBannerUrl);
    const hasToken = Boolean(resolvedTokenUrl);

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: "minmax(220px, 30%) 1fr",
                overflow: "hidden",
                "@media (max-width: 900px)": {
                    gridTemplateColumns: "1fr",
                    overflow: "auto",
                },
            }}
        >
            {/* ─────────────────────────── CENTER · MEDIA ──────────── */}
            <Box
                component="aside"
                sx={{
                    borderRight: `1px solid ${C.border}`,
                    background: [
                        `radial-gradient(circle at 50% 28%, rgba(0,242,234,0.1), transparent 42%)`,
                        `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))`,
                    ].join(","),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    p: "16px 14px 18px",
                    gap: "12px",
                    ...SCROLL_SX,
                }}
            >
                <Box sx={{ width: "min(240px, 92%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <Box
                        onClick={handleBannerClick}
                        title={editMode ? "Cambiar banner" : "Banner"}
                        sx={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "1",
                            borderRadius: "8px",
                            overflow: "hidden",
                            border: `2px solid ${C.pink}`,
                            boxShadow: `0 0 22px rgba(255,102,255,0.22)`,
                            cursor: editMode ? "pointer" : "default",
                            bgcolor: "#0a0a14",
                            opacity: uploading ? 0.7 : 1,
                            "&:hover .banner-cue": { opacity: editMode ? 1 : 0 },
                            "&:hover": editMode ? { borderColor: C.cyan } : {},
                        }}
                    >
                        {hasBanner ? (
                            <Box
                                component="img"
                                src={resolvedBannerUrl}
                                alt="Banner"
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    objectPosition: "center",
                                    display: "block",
                                    transform: !bannerPath && tokenPath ? "scale(1.15)" : "none",
                                }}
                            />
                        ) : (
                            <Box sx={{
                                width: "100%", height: "100%",
                                display: "grid", placeItems: "center",
                                fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem",
                                color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em",
                            }}>
                                BANNER
                            </Box>
                        )}
                        {editMode && (
                            <Box
                                className="banner-cue"
                                sx={{
                                    position: "absolute", inset: 0, opacity: 0,
                                    transition: "opacity 0.2s",
                                    background: "rgba(0,0,0,0.55)",
                                    display: "grid", placeItems: "center",
                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.5rem",
                                    color: C.cyan, letterSpacing: "0.12em",
                                }}
                            >
                                CLICK · CAMBIAR / BORRAR
                            </Box>
                        )}
                    </Box>
                    <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerFile} />

                    <Box
                        sx={{
                            width: "100%", display: "flex", alignItems: "center",
                            gap: "10px", p: "8px 10px", borderRadius: "8px",
                            border: `1px solid rgba(42,42,61,0.95)`,
                            bgcolor: "rgba(0,0,0,0.28)",
                        }}
                    >
                        <Box
                            onClick={handleTokenClick}
                            title={editMode ? "Cambiar token" : "Token"}
                            sx={{
                                flexShrink: 0,
                                width: 44, height: 44, borderRadius: "50%",
                                border: `2px solid ${hasToken || tokenPath ? C.cyan : C.border}`,
                                boxShadow: hasToken || tokenPath ? `0 0 10px rgba(0,242,234,0.3)` : "none",
                                overflow: "hidden",
                                cursor: editMode ? "pointer" : "default",
                                bgcolor: "#0a0a14",
                                display: "grid", placeItems: "center",
                                "&:hover": editMode ? { borderColor: C.pink } : {},
                            }}
                        >
                            {hasToken ? (
                                <Box
                                    component="img"
                                    src={resolvedTokenUrl}
                                    alt="Token"
                                    sx={{ width: "100%", height: "100%", ...cropCss }}
                                />
                            ) : (
                                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>TK</Box>
                            )}
                        </Box>
                        <input ref={tokenInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleTokenFile} />

                        <Box>
                            <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.55rem", letterSpacing: "0.1em", color: "#ffffff", mb: "2px" }}>TOKEN · MAPA</Box>
                            <Box sx={{ fontSize: "0.72rem", color: "#ffffff", fontFamily: '"Fira Code", monospace' }}>
                                {tokenPath ? "Token propio · PNG mapa" : bannerPath ? "Sin token → usa banner" : "Sube banner o token"}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ width: "100%", maxWidth: 220 }}>
                    <RadarSvg stats={stats} maxStat={MAX_STAT} />
                </Box>
            </Box>

            {/* ─────────────────────────── RIGHT · CONSOLE ──────────── */}
            <Box
                component="section"
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    bgcolor: "rgba(8,8,14,0.55)",
                }}
            >
                <div className="dossier-trail" style={{ margin: "0 18px 0" }} />

                <Box sx={{ ...SCROLL_SX, px: "18px", pb: "72px" }}>
                    <SectionLabel limit="máx 4">ACTIONS</SectionLabel>
                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        columnGap: "24px",
                        rowGap: "6px",
                        mb: "4px",
                        width: "100%",
                    }}>
                        {ACTION_KEYS.map((key) => (
                            <ActionSegmentRow
                                key={key}
                                actionKey={key}
                                value={stats[key] || 0}
                                selected={selected === `action:${key}`}
                                editMode={editMode}
                                onSelect={(e) => handleStatClick(e, key)}
                                onChange={(v) => setStat(key, v)}
                            />
                        ))}
                    </Box>

                    <SectionLabel limit="3 frases">IDEALS</SectionLabel>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "6px", mb: "4px" }}>
                        {(bond.ideals?.length ? bond.ideals : ["", "", ""]).slice(0, 3).map((text, i) => (
                            <Box
                                key={i}
                                sx={{
                                    display: "flex", gap: "10px", alignItems: "flex-start",
                                    p: "8px 10px", borderRadius: "6px",
                                    border: `1px solid ${C.border}`,
                                    bgcolor: "rgba(0,0,0,0.25)",
                                    fontSize: "0.95rem", color: "#ffffff",
                                }}
                            >
                                <Box component="span" sx={{
                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.58rem",
                                    color: "#ffffff", flexShrink: 0, mt: "2px",
                                }}>
                                    {`0${i + 1}`}
                                </Box>
                                {editMode ? (
                                    <Box
                                        component="input"
                                        value={text || ""}
                                        maxLength={80}
                                        onChange={(e) => saveIdeal(i, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                            flex: 1, border: "none", background: "transparent",
                                            color: "#ffffff", fontFamily: '"Fira Sans", sans-serif',
                                            fontSize: "0.95rem", outline: "none",
                                            borderBottom: `1px solid ${C.border}`,
                                        }}
                                    />
                                ) : (
                                    <Box component="span">{text || <em style={{ opacity: 0.45 }}>—</em>}</Box>
                                )}
                            </Box>
                        ))}
                    </Box>

                    <SectionLabel>NARRATIVE</SectionLabel>
                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                        mb: "10px",
                        "@media (max-width: 900px)": { gridTemplateColumns: "1fr" },
                    }}>
                        <NarrCard
                            compact
                            tag="NARRATIVE" title="SECOND WIND"
                            text={bond.secondWind || ""}
                            selKey="sw" selected={selected} onSelect={handleSelect}
                            editMode={editMode}
                            character={character}
                            macroEntry={{
                                type: MACRO_SLOT_TYPES.SHORTCUT,
                                id: "sw",
                                label: "SECOND WIND",
                                blurb: bond.secondWind || "",
                            }}
                            onSave={(v) => saveBondField("secondWind", v)}
                            onSendToChat={() => sendNarrativeToChat({
                                kind: "SECOND WIND",
                                title: "SECOND WIND",
                                text: bond.secondWind || "",
                                id: "narrative:sw",
                            })}
                            onToggleShortcut={() => toggleShortcut({
                                key: "sw",
                                kind: "SECOND WIND",
                                title: "SECOND WIND",
                            })}
                            isShortcut={isShortcutPinned("sw")}
                        />
                        <NarrCard
                            compact
                            tag="NARRATIVE" title="SPECIAL ABILITY"
                            text={bond.specialAbility || bond.description || ""}
                            selKey="sa" selected={selected} onSelect={handleSelect}
                            editMode={editMode}
                            character={character}
                            macroEntry={{
                                type: MACRO_SLOT_TYPES.SHORTCUT,
                                id: "sa",
                                label: "SPECIAL ABILITY",
                                blurb: bond.specialAbility || bond.description || "",
                            }}
                            onSave={(v) => saveBondField("specialAbility", v)}
                            onSendToChat={() => sendNarrativeToChat({
                                kind: "SPECIAL ABILITY",
                                title: "SPECIAL ABILITY",
                                text: bond.specialAbility || bond.description || "",
                                id: "narrative:sa",
                            })}
                            onToggleShortcut={() => toggleShortcut({
                                key: "sa",
                                kind: "SPECIAL ABILITY",
                                title: "SPECIAL ABILITY",
                            })}
                            isShortcut={isShortcutPinned("sa")}
                        />
                    </Box>

                    <SectionLabel limit={`${bondPowers.length} powers`}>BOND POWERS</SectionLabel>
                    {bondPowers.map((bp) => {
                        const id = bp.id || bp.key || bp.name;
                        const title = bp.title || bp.name || bp.label || "BOND";
                        const text = bp.description || bp.content || bp.text || "";
                        const scKey = `bond:${id}`;
                        return (
                            <NarrCard
                                key={id}
                                tag="BOND"
                                tagColor={C.cyan}
                                title={title}
                                text={text}
                                selKey={scKey}
                                selected={selected}
                                onSelect={handleSelect}
                                editMode={editMode}
                                character={character}
                                macroEntry={{
                                    type: MACRO_SLOT_TYPES.SHORTCUT,
                                    id: scKey,
                                    label: title,
                                    blurb: text,
                                }}
                                onSave={(v) => saveBondPower(id, v)}
                                onSendToChat={() => sendNarrativeToChat({
                                    kind: "BOND",
                                    title,
                                    text,
                                    id: `narrative:${scKey}`,
                                })}
                                onToggleShortcut={() => toggleShortcut({
                                    key: scKey,
                                    kind: "BOND",
                                    title,
                                })}
                                isShortcut={isShortcutPinned(scKey)}
                            />
                        );
                    })}

                    {editMode && (
                        <Box
                            component="button"
                            type="button"
                            onClick={handleAddBond}
                            sx={{
                                width: "100%", mb: "18px",
                                fontFamily: "Orbitron, sans-serif", fontSize: "0.5rem", letterSpacing: "0.1em",
                                p: "10px", borderRadius: "6px", cursor: "pointer",
                                border: `1px dashed rgba(0,242,234,0.35)`,
                                bgcolor: "rgba(0,242,234,0.04)", color: C.cyan,
                                "&:hover": { bgcolor: "rgba(0,242,234,0.1)" },
                            }}
                        >
                            + AÑADIR BOND POWER
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
