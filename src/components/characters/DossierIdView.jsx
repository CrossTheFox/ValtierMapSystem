import { useCallback, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Box } from "@mui/material";

import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields, updateCharacterBanner } from "../../../firebase/services/characterService";
import { uploadCharacterImage } from "../../../firebase/services/assetLoader";
import { useDossier } from "../CharactersSettingsDialog";

/* ── colour tokens (match CSS vars in mockup) ───────────────────── */
const C = {
    bg0:     "#07070e",
    bg1:     "#12121a",
    bg2:     "#1a1a2a",
    border:  UI_COLORS.border,
    text:    UI_COLORS.textPrimary,
    muted:   UI_COLORS.textSecondary,
    pink:    UI_COLORS.accent,       // #ff66ff
    cyan:    UI_COLORS.anomaly,      // #00f2ea
    lb:      "#ffcc33",
    trait:   "#7dd3fc",
    glowP:   "rgba(255,20,147,0.55)",
    glowC:   "rgba(0,242,234,0.45)",
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
const MAX_STAT = 6;

/* ── NarrCard ─────────────────────────────────────────────────────── */
function NarrCard({ tag, tagColor, title, text, selKey, selected, onSelect, editMode, onSave }) {
    const { spawnPing } = useDossier();
    const taRef = useRef(null);
    const isSelected = selected === selKey;
    const isBond = selKey?.startsWith("bond:");

    const handleClick = (e) => {
        if (e.target.tagName === "TEXTAREA") return;
        onSelect(selKey);
        spawnPing(e.clientX, e.clientY);
    };

    return (
        <Box
            className={`dossier-narr-card${isSelected ? " is-selected" : ""}`}
            onClick={handleClick}
            sx={{
                position: "relative",
                mb: "10px",
                p: "12px 14px",
                border: `1px solid ${isSelected ? C.cyan : C.border}`,
                borderRadius: "8px",
                bgcolor: "rgba(0,0,0,0.28)",
                cursor: "pointer",
                boxShadow: isSelected ? `0 0 18px rgba(0,242,234,0.12)` : "none",
                transition: "border-color 0.18s, box-shadow 0.18s, transform 0.15s",
                "&:hover": { borderColor: "rgba(255,102,255,0.4)", transform: "translateY(-1px)" },
            }}
        >
            {/* bracket corners */}
            <div className="dossier-brackets" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
            </div>

            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "6px" }}>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.42rem",
                    letterSpacing: "0.1em",
                    color: tagColor || C.lb,
                    border: `1px solid ${tagColor ? tagColor + "66" : "rgba(255,204,51,0.35)"}`,
                    px: "6px", py: "2px", borderRadius: "3px",
                }}>
                    {tag}
                </Box>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.62rem",
                    letterSpacing: "0.1em",
                    color: C.text,
                    flex: 1,
                }}>
                    {title}
                </Box>
            </Box>

            {editMode && isSelected ? (
                <textarea
                    ref={taRef}
                    defaultValue={text}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => onSave && onSave(e.target.value)}
                    style={{
                        width: "100%",
                        minHeight: isBond ? "110px" : "72px",
                        marginTop: "4px",
                        resize: "vertical",
                        background: "rgba(0,0,0,0.45)",
                        border: `1px solid rgba(255,102,255,0.35)`,
                        color: C.text,
                        fontFamily: '"Fira Sans", sans-serif',
                        fontSize: "0.78rem",
                        padding: "8px",
                        borderRadius: "4px",
                    }}
                />
            ) : (
                <Box component="p" sx={{
                    m: 0,
                    fontSize: "0.78rem",
                    color: C.muted,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                }}>
                    {text || <em style={{ opacity: 0.4 }}>Sin texto</em>}
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
        <svg viewBox="0 0 200 200" style={{ width: "100%", maxWidth: 200 }}>
            {axes.map(({ x2, y2, lx, ly, label }, i) => (
                <g key={i}>
                    <line
                        x1={cx} y1={cy} x2={x2} y2={y2}
                        stroke="rgba(42,42,61,0.8)" strokeWidth="1"
                    />
                    <text
                        x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fill={C.muted}
                        style={{ fontSize: "8px", fontFamily: "Fira Code, monospace", letterSpacing: "0.06em" }}
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
            fontSize: "0.48rem",
            letterSpacing: "0.14em",
            color: C.cyan,
            "&::after": {
                content: '""',
                flex: 1,
                height: "1px",
                background: `linear-gradient(90deg, ${C.cyan}44, transparent)`,
            },
        }}>
            {children}
            {limit && (
                <Box component="span" sx={{ fontSize: "0.42rem", color: C.muted, ml: 0.5 }}>
                    {limit}
                </Box>
            )}
        </Box>
    );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function DossierIdView({ character }) {
    const { editMode, spawnPing } = useDossier();
    const dispatch = useDispatch();

    /* Local state for editable fields */
    const [selected, setSelected] = useState(null);
    const bannerInputRef = useRef(null);
    const tokenInputRef  = useRef(null);
    const [uploading, setUploading] = useState(false);

    const bond = character?.bond || {};
    const stats = character?.stats || {};
    const bondPowers = Array.isArray(character?.bondPowers) ? character.bondPowers : [];

    /* ── Save helpers ─────────────────────────────────────────────── */
    const save = useCallback((partial) => {
        if (!character?.id) return;
        updateCharacterFields(character.id, partial).catch(console.error);
    }, [character?.id]);

    const saveBondField = useCallback((field, value) => {
        save({ [`bond.${field}`]: value });
    }, [save]);

    const saveBondPower = useCallback((powerId, value) => {
        const updated = bondPowers.map((bp) =>
            (bp.id || bp.key) === powerId ? { ...bp, description: value } : bp
        );
        save({ bondPowers: updated });
    }, [character?.id, bondPowers, save]);

    const saveIdeal = useCallback((idx, value) => {
        const next = [...(bond.ideals || [])];
        next[idx] = value;
        save({ "bond.ideals": next });
    }, [bond.ideals, save]);

    const handleSelect = (key) => setSelected(key);

    /* ── Banner upload ────────────────────────────────────────────── */
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
            await updateCharacterBanner(character.id, url);
        } catch (err) {
            console.error("[DossierIdView] banner upload:", err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    /* ── Token upload ─────────────────────────────────────────────── */
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
            await updateCharacterFields(character.id, { imageUrl: url });
        } catch (err) {
            console.error("[DossierIdView] token upload:", err);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    /* ── Stat-row glitch snap ─────────────────────────────────────── */
    const handleStatClick = useCallback((e, key) => {
        const row = e.currentTarget;
        setSelected(`action:${key}`);
        row.classList.remove("glitch-snap");
        void row.offsetWidth;
        row.classList.add("glitch-snap");
        spawnPing(e.clientX, e.clientY);
        setTimeout(() => row.classList.remove("glitch-snap"), 600);
    }, [spawnPing]);

    /* ── Add bond power ───────────────────────────────────────────── */
    const handleAddBond = () => {
        if (!editMode || !character?.id) return;
        const id = `bp_${Date.now()}`;
        const next = [...bondPowers, { id, title: "NEW BOND", description: "" }];
        save({ bondPowers: next });
    };

    const bannerUrl = character?.bannerUrl || null;
    const tokenUrl  = character?.imageUrl || character?.tokenImageUrl || null;

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                display: "grid",
                gridTemplateColumns: "minmax(260px, 32%) 1fr",
                overflow: "hidden",
                "@media (max-width: 900px)": {
                    gridTemplateColumns: "1fr",
                    gridTemplateRows: "auto 1fr",
                    overflow: "auto",
                },
            }}
        >
            {/* ─────────────────────────── LEFT · HOLO ──────────────── */}
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
                    overflowY: "auto",
                    gap: "12px",
                    ...SCROLL_SX,
                }}
            >
                {/* Media stack */}
                <Box sx={{ width: "min(240px, 92%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    {/* Banner */}
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
                            "&:hover .banner-cue": { opacity: editMode ? 1 : 0 },
                            "&:hover": editMode ? { borderColor: C.cyan } : {},
                        }}
                    >
                        {bannerUrl ? (
                            <Box
                                component="img"
                                src={bannerUrl}
                                alt="Banner"
                                sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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

                    {/* Token row */}
                    <Box
                        sx={{
                            width: "100%", display: "flex", alignItems: "center",
                            gap: "10px", p: "8px 10px", borderRadius: "8px",
                            border: `1px solid rgba(42,42,61,0.95)`,
                            bgcolor: "rgba(0,0,0,0.28)",
                        }}
                    >
                        {/* Token disk */}
                        <Box
                            onClick={handleTokenClick}
                            title={editMode ? "Cambiar token" : "Token"}
                            sx={{
                                flexShrink: 0,
                                width: 44, height: 44, borderRadius: "50%",
                                border: `2px solid ${tokenUrl ? C.cyan : C.border}`,
                                boxShadow: tokenUrl ? `0 0 10px rgba(0,242,234,0.3)` : "none",
                                overflow: "hidden",
                                cursor: editMode ? "pointer" : "default",
                                bgcolor: "#0a0a14",
                                display: "grid", placeItems: "center",
                                "&:hover": editMode ? { borderColor: C.pink } : {},
                            }}
                        >
                            {tokenUrl ? (
                                <Box component="img" src={tokenUrl} alt="Token"
                                    sx={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.1)" }} />
                            ) : (
                                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.25)" }}>TK</Box>
                            )}
                        </Box>
                        <input ref={tokenInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleTokenFile} />

                        <Box>
                            <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.42rem", letterSpacing: "0.1em", color: C.muted, mb: "2px" }}>TOKEN · MAPA</Box>
                            <Box sx={{ fontSize: "0.6rem", color: C.muted, fontFamily: '"Fira Code", monospace' }}>
                                {tokenUrl ? "Token propio · PNG mapa" : bannerUrl ? "Sin token → usa banner" : "Sube banner o token"}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Radar */}
                <Box sx={{ width: "100%", maxWidth: 200 }}>
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
                {/* Neon scan trail */}
                <div className="dossier-trail" style={{ margin: "0 18px 0" }} />

                <Box sx={{ ...SCROLL_SX, px: "18px", pb: "28px" }}>
                    {/* ── ACTIONS ─────────────────────────────────────── */}
                    <SectionLabel limit="10 · narrativa">ACTIONS</SectionLabel>
                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "4px 12px",
                        mb: "4px",
                    }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            [ACTION_KEYS[i], ACTION_KEYS[i + 5]].map((key) => {
                                const v = stats[key] || 0;
                                const isSel = selected === `action:${key}`;
                                return (
                                    <Box
                                        key={key}
                                        className={`dossier-stat-row${isSel ? " is-selected" : ""}`}
                                        onClick={(e) => handleStatClick(e, key)}
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: "72px 1fr 28px",
                                            gap: "8px",
                                            alignItems: "center",
                                            p: "7px 9px",
                                            borderRadius: "6px",
                                            border: `1px solid ${isSel ? C.cyan : "transparent"}`,
                                            bgcolor: isSel ? "rgba(0,242,234,0.06)" : "transparent",
                                            cursor: "pointer",
                                            position: "relative",
                                            "&:hover": { bgcolor: "rgba(255,102,255,0.05)" },
                                        }}
                                    >
                                        <Box sx={{
                                            fontFamily: '"Fira Code", monospace',
                                            fontSize: "0.55rem",
                                            color: C.muted,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                        }}>
                                            {key}
                                        </Box>
                                        <Box sx={{
                                            height: "8px",
                                            bgcolor: "rgba(42,42,61,0.5)",
                                            border: `1px solid ${C.border}`,
                                            borderRadius: "4px",
                                            overflow: "hidden",
                                        }}>
                                            <Box sx={{
                                                height: "100%",
                                                width: `${(v / MAX_STAT) * 100}%`,
                                                background: `linear-gradient(90deg, ${C.pink}, ${C.cyan})`,
                                                transition: "width 0.25s",
                                                borderRadius: "4px",
                                            }} />
                                        </Box>
                                        {editMode ? (
                                            <Box
                                                component="input"
                                                type="number"
                                                min={0}
                                                max={MAX_STAT}
                                                defaultValue={v}
                                                onClick={(e) => e.stopPropagation()}
                                                onBlur={(e) => {
                                                    const next = Math.min(MAX_STAT, Math.max(0, Number(e.target.value) || 0));
                                                    save({ [`stats.${key}`]: next });
                                                }}
                                                sx={{
                                                    width: "100%", border: `1px solid ${C.border}`,
                                                    bgcolor: "rgba(0,0,0,0.4)", color: C.pink,
                                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.65rem",
                                                    textAlign: "right", borderRadius: "3px", p: "1px 2px",
                                                }}
                                            />
                                        ) : (
                                            <Box sx={{
                                                fontFamily: "Orbitron, sans-serif",
                                                fontSize: "0.7rem",
                                                color: C.pink,
                                                textAlign: "right",
                                            }}>
                                                {v}
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })
                        ))}
                    </Box>

                    {/* ── IDEALS ──────────────────────────────────────── */}
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
                                    fontSize: "0.82rem", color: C.text,
                                }}
                            >
                                <Box component="span" sx={{
                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.45rem",
                                    color: C.lb, flexShrink: 0, mt: "2px",
                                }}>
                                    {`0${i + 1}`}
                                </Box>
                                {editMode ? (
                                    <Box
                                        component="input"
                                        defaultValue={text}
                                        maxLength={80}
                                        onBlur={(e) => saveIdeal(i, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                            flex: 1, border: "none", background: "transparent",
                                            color: C.text, fontFamily: '"Fira Sans", sans-serif',
                                            fontSize: "0.82rem", outline: "none",
                                            borderBottom: `1px solid ${C.border}`,
                                        }}
                                    />
                                ) : (
                                    <Box component="span">{text || <em style={{ opacity: 0.35 }}>—</em>}</Box>
                                )}
                            </Box>
                        ))}
                    </Box>

                    {/* ── SECOND WIND ─────────────────────────────────── */}
                    <SectionLabel>SECOND WIND</SectionLabel>
                    <NarrCard
                        tag="NARRATIVE" title="SECOND WIND"
                        text={bond.secondWind || ""}
                        selKey="sw" selected={selected} onSelect={handleSelect}
                        editMode={editMode}
                        onSave={(v) => saveBondField("secondWind", v)}
                    />

                    {/* ── SPECIAL ABILITY ─────────────────────────────── */}
                    <SectionLabel>SPECIAL ABILITY</SectionLabel>
                    <NarrCard
                        tag="NARRATIVE" title="SPECIAL ABILITY"
                        text={bond.specialAbility || bond.description || ""}
                        selKey="sa" selected={selected} onSelect={handleSelect}
                        editMode={editMode}
                        onSave={(v) => saveBondField("specialAbility", v)}
                    />

                    {/* ── BOND POWERS ─────────────────────────────────── */}
                    <SectionLabel limit={`${bondPowers.length} powers`}>BOND POWERS</SectionLabel>
                    {bondPowers.map((bp) => {
                        const id = bp.id || bp.key || bp.name;
                        return (
                            <NarrCard
                                key={id}
                                tag="BOND"
                                tagColor={C.cyan}
                                title={bp.title || bp.name || bp.label || "BOND"}
                                text={bp.description || bp.content || bp.text || ""}
                                selKey={`bond:${id}`}
                                selected={selected}
                                onSelect={handleSelect}
                                editMode={editMode}
                                onSave={(v) => saveBondPower(id, v)}
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
