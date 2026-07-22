import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getAbilitiesByIds } from "../../../../../firebase/services/characterService";
import { getAbilityKeysForClase, getClaseDocsByIds } from "../../../../../firebase/services/classService";
import { CyberText, CyberTitle } from "../../../customs/CustomTexts";
import CyberTooltip from "../../../customs/CyberTooltip";
import { UI_COLORS } from "../../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../../constants/cyberScrollStyle";
import { formatClassLabel } from "../../../../constants/characterSheetTokens";
import {
    CHAPTER_CAP,
    resolveCharacterChapter,
    resolveCharacterLevel,
} from "../../../../constants/skillTreeProgression";
import { buildCp2077TreeLayout } from "../../../../utils/buildCp2077TreeLayout";

const C = {
    bg: "#06080c",
    panel: "#0e1218",
    lineOff: "#2a3544",
    lineOn: "#d4a017",
    nodeOff: "#1a2430",
    nodeOffBorder: "#3d4f63",
    nodeOn: "#c9951a",
    nodeOnGlow: "rgba(212, 160, 23, 0.55)",
    nodeAvail: "#5a8aaa",
    text: "#e8eef4",
    muted: "#7a8a9a",
    cyan: "#6ec8e0",
    warn: "#e8b84a",
    ok: "#6dba7a",
    narr: "#a78bfa",
    accent: UI_COLORS.accent,
};

const clipOct =
    "polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)";
const clipDiamond = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
const clipGate =
    "polygon(8% 0%, 92% 0%, 100% 28%, 100% 72%, 92% 100%, 8% 100%, 0% 72%, 0% 28%)";

function frameColors(state, variant = "main") {
    if (state === "unlocked") {
        if (variant === "trait") {
            return {
                bg: "linear-gradient(160deg, #1a2e1c, #0c1810)",
                shadow: `inset 0 0 0 2px ${C.ok}, 0 0 12px rgba(109, 186, 122, 0.35)`,
                color: C.ok,
            };
        }
        return {
            bg: "linear-gradient(160deg, #3a2e12, #1a1408)",
            shadow: `inset 0 0 0 2px ${C.nodeOn}, 0 0 12px ${C.nodeOnGlow}`,
            color: C.warn,
        };
    }
    if (state === "available") {
        return {
            bg: C.nodeOff,
            shadow: `inset 0 0 0 2px ${C.nodeAvail}, 0 0 8px rgba(90, 138, 170, 0.3)`,
            color: C.cyan,
        };
    }
    if (state === "unowned") {
        return {
            bg: "#121820",
            shadow: "inset 0 0 0 2px #4a5a6a",
            color: "#8a9aaa",
            opacity: 0.92,
        };
    }
    return {
        bg: C.nodeOff,
        shadow: `inset 0 0 0 2px ${C.nodeOffBorder}`,
        color: C.muted,
        opacity: state === "locked" || state === "xor-out" ? 0.38 : 1,
        filter: state === "locked" ? "grayscale(0.4)" : "none",
    };
}

function PerkFrame({ state, variant, children, sx = {} }) {
    const f = frameColors(state, variant);
    return (
        <Box
            className="frame"
            sx={{
                width: "100%",
                height: "100%",
                background: f.bg,
                boxShadow: f.shadow,
                color: f.color,
                opacity: f.opacity ?? 1,
                filter: f.filter ?? "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}

function TreeNodeButton({ node, selected, onSelect, children, size, clipPath, sx = {} }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={() => onSelect?.(node)}
            title={node.label}
            sx={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: size.w,
                height: size.h,
                transform: "translate(-50%, -50%)",
                zIndex: selected ? 12 : 3,
                p: 0,
                m: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: C.muted,
                transition: "transform 160ms ease",
                "&:hover": { transform: "translate(-50%, -50%) scale(1.06)", zIndex: 12 },
                "&:focus-visible": { outline: `2px solid ${C.cyan}`, outlineOffset: 2 },
                ...sx,
            }}
        >
            <Box sx={{ width: "100%", height: "100%", clipPath }}>{children}</Box>
        </Box>
    );
}

/**
 * CP2077-style horizontal perk tree (pure React/HTML/SVG).
 * One job at a time; levels grow right; abilities stack up L0 with T1/T2 → M branches.
 */
export default function SkillTreeCp2077({ character }) {
    const level = resolveCharacterLevel(character);
    const chapter = resolveCharacterChapter(character);
    const assignedKey = Array.isArray(character?.assignedClassIds)
        ? character.assignedClassIds.filter(Boolean).join(",")
        : "";
    const classIds = useMemo(
        () => (assignedKey ? assignedKey.split(",") : []),
        [assignedKey]
    );

    const [focusIdx, setFocusIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [jobPayload, setJobPayload] = useState(null);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const active = character?.activeClassId;
        const idx = active && classIds.includes(active) ? classIds.indexOf(active) : 0;
        setFocusIdx(Math.max(0, idx));
    }, [character?.id, character?.activeClassId, classIds]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            try {
                if (classIds.length) {
                    const [meta, keysList] = await Promise.all([
                        getClaseDocsByIds(classIds),
                        Promise.all(classIds.map((id) => getAbilityKeysForClase(id))),
                    ]);
                    const metaById = Object.fromEntries(meta.map((m) => [m.id, m]));
                    const keysByClassId = Object.fromEntries(classIds.map((id, i) => [id, keysList[i] || []]));
                    const uniq = [...new Set(Object.values(keysByClassId).flat())];
                    const abs = uniq.length ? await getAbilitiesByIds(uniq) : [];
                    const byKey = Object.fromEntries(abs.map((a) => [a.key || a.id, a]));
                    if (!cancelled) setJobPayload({ mode: "multiclass", metaById, byKey, keysByClassId });
                } else {
                    const ids =
                        Array.isArray(character?.allAbilities) && character.allAbilities.length
                            ? character.allAbilities
                            : Array.isArray(character?.unlockedAbilities)
                              ? character.unlockedAbilities
                              : [];
                    const abs = ids.length ? await getAbilitiesByIds(ids) : [];
                    if (!cancelled) setJobPayload({ mode: "legacy", abilities: abs });
                }
            } catch (e) {
                console.error(e);
                if (!cancelled) setJobPayload(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [character?.id, assignedKey, character?.allAbilities, character?.unlockedAbilities]);

    const focusClassId = classIds[focusIdx] || null;

    const jobAbilities = useMemo(() => {
        if (!jobPayload) return [];
        if (jobPayload.mode === "legacy") return jobPayload.abilities || [];
        const keys = jobPayload.keysByClassId?.[focusClassId] || [];
        return keys.map((k) => jobPayload.byKey[k]).filter(Boolean);
    }, [jobPayload, focusClassId]);

    const jobMeta = jobPayload?.mode === "multiclass" ? jobPayload.metaById?.[focusClassId] : null;
    const jobLabel =
        (jobMeta?.displayName && String(jobMeta.displayName).toUpperCase()) ||
        formatClassLabel(focusClassId, character?.name) ||
        "JOB";
    const isPrimary = focusIdx === 0;
    const jobRole = isPrimary ? "PRIMARY JOB" : `JOB ${focusIdx + 1}`;

    const layout = useMemo(
        () =>
            buildCp2077TreeLayout({
                abilities: jobAbilities,
                unlockedKeys: character?.unlockedAbilities || [],
                level,
                chapter,
                jobLabel,
                jobRole,
                isPrimary,
                jobCount: classIds.length || 1,
            }),
        [jobAbilities, character?.unlockedAbilities, level, chapter, jobLabel, jobRole, isPrimary, classIds.length]
    );

    const ap = character?.ap ?? character?.abilityPoints ?? character?.stats?.ap;
    const mp = character?.mp ?? character?.masteryPoints ?? character?.stats?.mp;
    const xp = character?.xp ?? character?.stats?.xp;

    if (loading) {
        return (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 280 }}>
                <CircularProgress size={28} sx={{ color: C.cyan }} />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: C.panel,
                borderTop: `1px solid ${C.lineOff}`,
            }}
        >
            {/* Job switcher */}
            <Box
                sx={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    px: 1.5,
                    py: 0.75,
                    borderBottom: `1px solid #1e2834`,
                    bgcolor: "#0a0e14",
                    position: "relative",
                }}
            >
                <IconButton
                    size="small"
                    disabled={focusIdx <= 0 || classIds.length <= 1}
                    onClick={() => setFocusIdx((i) => Math.max(0, i - 1))}
                    sx={{ color: C.muted, border: `1px solid ${C.lineOff}`, borderRadius: 0.5 }}
                >
                    <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <Box sx={{ textAlign: "center", minWidth: 180 }}>
                    <CyberTitle sx={{ fontSize: "1rem", letterSpacing: "0.2em", color: C.cyan, textShadow: "0 0 18px rgba(110,200,224,0.35)" }}>
                        {layout.jobLabel}
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.5rem", letterSpacing: "0.14em", color: C.muted, display: "block" }}>
                        {jobRole}
                        {" · "}
                        LVL {level} · CH {chapter} · CAP L{CHAPTER_CAP[chapter]}
                    </CyberText>
                </Box>
                <IconButton
                    size="small"
                    disabled={focusIdx >= classIds.length - 1 || classIds.length <= 1}
                    onClick={() => setFocusIdx((i) => Math.min(classIds.length - 1, i + 1))}
                    sx={{ color: C.muted, border: `1px solid ${C.lineOff}`, borderRadius: 0.5 }}
                >
                    <ChevronRightIcon fontSize="small" />
                </IconButton>
                <CyberText
                    sx={{
                        position: "absolute",
                        right: 12,
                        fontSize: "0.55rem",
                        letterSpacing: "0.08em",
                        color: C.warn,
                        fontFamily: "Share Tech Mono, monospace",
                    }}
                >
                    UNLOCKED <Box component="b" sx={{ fontWeight: 400, color: C.warn }}>{layout.unlockedCount}</Box>
                </CyberText>
                {(ap != null || mp != null) && (
                    <Box sx={{ position: "absolute", left: 12, display: "flex", gap: 0.5 }}>
                        {ap != null && (
                            <CyberText sx={{ fontSize: "0.5rem", px: 0.6, py: 0.2, border: `1px solid ${C.lineOff}`, color: C.text }}>
                                AP <Box component="b" sx={{ color: C.cyan, fontWeight: 400 }}>{ap}</Box>
                            </CyberText>
                        )}
                        {mp != null && (
                            <CyberText sx={{ fontSize: "0.5rem", px: 0.6, py: 0.2, border: `1px solid ${C.lineOff}`, color: C.text }}>
                                MP <Box component="b" sx={{ color: C.warn, fontWeight: 400 }}>{mp}</Box>
                            </CyberText>
                        )}
                    </Box>
                )}
            </Box>

            <Box
                sx={{
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 0.35,
                    fontFamily: "Share Tech Mono, monospace",
                    fontSize: "0.48rem",
                    letterSpacing: "0.12em",
                    borderBottom: "1px solid #1e2834",
                    bgcolor: "#080c12",
                }}
            >
                <Box sx={{ color: C.cyan }}>↑ TÁCTICO</Box>
                <Box sx={{ color: C.muted }}>L0 → L12 · A → T1/T2 → M →</Box>
                <Box sx={{ color: C.narr }}>↓ NARRATIVO</Box>
            </Box>

            {/* Stage */}
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    bgcolor: C.bg,
                    backgroundImage:
                        "linear-gradient(180deg, rgba(110,200,224,0.04) 0%, transparent 42%, transparent 58%, rgba(167,139,250,0.05) 100%)",
                    ...CYBER_SCROLL_STYLE,
                    scrollbarColor: `${C.nodeOn} transparent`,
                }}
            >
                {!jobAbilities.length ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                        <CyberText sx={{ color: C.muted, fontSize: "0.8rem" }}>
                            Sin abilities cargadas para este job.
                        </CyberText>
                    </Box>
                ) : (
                    <Box sx={{ position: "relative", p: "1rem 1.5rem 1.5rem", minWidth: "min-content" }}>
                        <Box sx={{ position: "relative", width: layout.boardW, height: layout.boardH }}>
                            <Box
                                sx={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: layout.spineY - 1,
                                    height: 2,
                                    background: "linear-gradient(90deg, transparent, #2a3544 6%, #2a3544 94%, transparent)",
                                    zIndex: 1,
                                    pointerEvents: "none",
                                }}
                            />
                            <CyberText
                                sx={{
                                    position: "absolute",
                                    left: 8,
                                    top: 12,
                                    zIndex: 1,
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.16em",
                                    color: C.cyan,
                                    opacity: 0.55,
                                    pointerEvents: "none",
                                }}
                            >
                                TÁCTICO
                            </CyberText>
                            <CyberText
                                sx={{
                                    position: "absolute",
                                    left: 8,
                                    bottom: 12,
                                    zIndex: 1,
                                    fontSize: "0.5rem",
                                    letterSpacing: "0.16em",
                                    color: C.narr,
                                    opacity: 0.55,
                                    pointerEvents: "none",
                                }}
                            >
                                NARRATIVO
                            </CyberText>

                            <Box
                                component="svg"
                                className="pipes"
                                viewBox={`0 0 ${layout.boardW} ${layout.boardH}`}
                                preserveAspectRatio="none"
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    height: "100%",
                                    pointerEvents: "none",
                                    zIndex: 0,
                                    overflow: "visible",
                                }}
                            >
                                {layout.pipes.map((p, i) => (
                                    <line
                                        key={i}
                                        x1={p.x1}
                                        y1={p.y1}
                                        x2={p.x2}
                                        y2={p.y2}
                                        fill="none"
                                        stroke={p.narr ? (p.on ? C.narr : "#4a3a6a") : p.on ? C.lineOn : C.lineOff}
                                        strokeWidth={p.narr ? 1.5 : p.on ? 2.5 : 2}
                                        style={
                                            p.on && !p.narr
                                                ? { filter: "drop-shadow(0 0 4px rgba(212,160,23,0.45))" }
                                                : undefined
                                        }
                                    />
                                ))}
                            </Box>

                            {layout.nodes.map((node) => {
                                if (node.kind === "col-head") {
                                    return (
                                        <CyberTooltip
                                            key={node.id}
                                            title={
                                                <Box>
                                                    <CyberText sx={{ fontSize: "0.55rem", color: C.cyan, mb: 0.5 }}>
                                                        LEVEL {node.lvl}
                                                    </CyberText>
                                                    <CyberText sx={{ fontSize: "0.72rem", color: C.text, display: "block" }}>
                                                        {node.combat}
                                                    </CyberText>
                                                    <CyberText sx={{ fontSize: "0.68rem", color: C.narr, display: "block", mt: 0.25 }}>
                                                        {node.narrative}
                                                    </CyberText>
                                                </Box>
                                            }
                                        >
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    left: node.x,
                                                    top: node.y,
                                                    transform: "translateX(-50%)",
                                                    zIndex: 2,
                                                    fontFamily: "Share Tech Mono, monospace",
                                                    fontSize: "0.55rem",
                                                    letterSpacing: "0.1em",
                                                    color: node.current ? C.warn : node.reached ? C.cyan : C.muted,
                                                    opacity: node.gated ? 0.35 : 1,
                                                    textAlign: "center",
                                                    px: 0.5,
                                                    py: 0.2,
                                                    border: node.current ? `1px solid rgba(232,184,74,0.45)` : "1px solid transparent",
                                                    bgcolor: "rgba(6,8,12,0.65)",
                                                    cursor: "help",
                                                    userSelect: "none",
                                                }}
                                            >
                                                {node.label}
                                            </Box>
                                        </CyberTooltip>
                                    );
                                }

                                if (node.kind === "class-root" || node.kind === "lvl-base") {
                                    const big = node.kind === "class-root";
                                    return (
                                        <TreeNodeButton
                                            key={node.id}
                                            node={node}
                                            selected={selected?.id === node.id}
                                            onSelect={setSelected}
                                            size={big ? { w: 100, h: 100 } : { w: 52, h: 52 }}
                                            clipPath={clipOct}
                                            sx={{ zIndex: 4 }}
                                        >
                                            <PerkFrame state={node.state} sx={node.current ? { boxShadow: `inset 0 0 0 2px ${C.warn}, 0 0 12px rgba(232,184,74,0.35)` } : {}}>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        fontFamily: "Share Tech Mono, monospace",
                                                        fontSize: big ? "0.7rem" : "0.52rem",
                                                        letterSpacing: big ? "0.1em" : "0.04em",
                                                        textAlign: "center",
                                                        maxWidth: "90%",
                                                        lineHeight: 1.1,
                                                    }}
                                                >
                                                    {node.label}
                                                </Box>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        fontFamily: "Share Tech Mono, monospace",
                                                        fontSize: big ? "0.48rem" : "0.42rem",
                                                        color: node.state === "unlocked" ? C.warn : C.cyan,
                                                    }}
                                                >
                                                    {node.rank}
                                                </Box>
                                            </PerkFrame>
                                        </TreeNodeButton>
                                    );
                                }

                                if (node.kind === "trait") {
                                    return (
                                        <TreeNodeButton
                                            key={node.id}
                                            node={node}
                                            selected={selected?.id === node.id}
                                            onSelect={setSelected}
                                            size={{ w: 48, h: 48 }}
                                            clipPath={clipDiamond}
                                        >
                                            <PerkFrame state={node.state} variant="trait">
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        fontFamily: "Share Tech Mono, monospace",
                                                        fontSize: "0.38rem",
                                                        textAlign: "center",
                                                        maxWidth: 36,
                                                        lineHeight: 1.05,
                                                    }}
                                                >
                                                    {node.label}
                                                </Box>
                                                <Box component="span" sx={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.34rem" }}>
                                                    TRAIT
                                                </Box>
                                            </PerkFrame>
                                        </TreeNodeButton>
                                    );
                                }

                                if (node.kind === "ability" || node.kind === "lb" || node.kind === "gate") {
                                    return (
                                        <TreeNodeButton
                                            key={node.id}
                                            node={node}
                                            selected={selected?.id === node.id}
                                            onSelect={setSelected}
                                            size={{ w: 58, h: 58 }}
                                            clipPath={node.kind === "gate" ? clipGate : clipOct}
                                        >
                                            <PerkFrame
                                                state={node.state}
                                                sx={
                                                    node.kind === "lb" && node.state === "unlocked"
                                                        ? { boxShadow: "inset 0 0 0 2px #c44, 0 0 12px rgba(200,60,60,0.4)" }
                                                        : {}
                                                }
                                            >
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        fontFamily: "Share Tech Mono, monospace",
                                                        fontSize: "0.46rem",
                                                        textAlign: "center",
                                                        maxWidth: 50,
                                                        lineHeight: 1.05,
                                                    }}
                                                >
                                                    {node.label}
                                                </Box>
                                                <Box component="span" sx={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.4rem" }}>
                                                    {node.rank}
                                                </Box>
                                            </PerkFrame>
                                        </TreeNodeButton>
                                    );
                                }

                                if (node.kind === "talent" || node.kind === "mastery") {
                                    const mastery = node.kind === "mastery";
                                    const f = frameColors(node.state);
                                    return (
                                        <Box
                                            key={node.id}
                                            component="button"
                                            type="button"
                                            onClick={() => setSelected(node)}
                                            title={node.label}
                                            sx={{
                                                position: "absolute",
                                                left: node.x,
                                                top: node.y,
                                                width: mastery ? 34 : 32,
                                                height: mastery ? 34 : 32,
                                                transform: "translate(-50%, -50%)",
                                                zIndex: selected?.id === node.id ? 12 : 3,
                                                p: 0,
                                                border: "none",
                                                background: "transparent",
                                                cursor: "pointer",
                                                transition: "transform 160ms ease",
                                                "&:hover": { transform: "translate(-50%, -50%) scale(1.1)", zIndex: 12 },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: "100%",
                                                    height: "100%",
                                                    borderRadius: mastery ? "50%" : "2px",
                                                    background: f.bg,
                                                    boxShadow:
                                                        mastery && node.state === "unlocked"
                                                            ? "inset 0 0 0 1.5px #e8a020, 0 0 10px rgba(232,160,32,0.45)"
                                                            : f.shadow,
                                                    color:
                                                        mastery && node.state === "unlocked"
                                                            ? "#e8a020"
                                                            : f.color,
                                                    opacity: f.opacity ?? 1,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontFamily: "Share Tech Mono, monospace",
                                                    fontSize: "0.4rem",
                                                }}
                                            >
                                                {node.glyph || (mastery ? "M" : "T")}
                                            </Box>
                                        </Box>
                                    );
                                }

                                if (node.kind === "grant" || node.kind === "narrative") {
                                    const narr = node.kind === "narrative";
                                    const unlocked = node.state === "unlocked";
                                    return (
                                        <Box
                                            key={node.id}
                                            component="button"
                                            type="button"
                                            onClick={() => setSelected(node)}
                                            sx={{
                                                position: "absolute",
                                                left: node.x,
                                                top: node.y,
                                                transform: "translate(-50%, -50%)",
                                                zIndex: 3,
                                                fontFamily: "Share Tech Mono, monospace",
                                                fontSize: "0.4rem",
                                                letterSpacing: "0.05em",
                                                px: 0.45,
                                                py: 0.25,
                                                border: `1px solid ${
                                                    narr
                                                        ? unlocked
                                                            ? C.narr
                                                            : "#4a3a6a"
                                                        : unlocked
                                                          ? node.grantKind === "mp"
                                                              ? C.warn
                                                              : C.cyan
                                                          : C.nodeOffBorder
                                                }`,
                                                bgcolor: C.nodeOff,
                                                color: narr ? (unlocked ? C.narr : "#b8a4e8") : unlocked ? (node.grantKind === "mp" ? C.warn : C.cyan) : C.muted,
                                                opacity: unlocked ? 1 : 0.45,
                                                cursor: "pointer",
                                                whiteSpace: "nowrap",
                                                maxWidth: 92,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                borderStyle: narr ? "solid" : "dashed",
                                            }}
                                        >
                                            {node.label}
                                        </Box>
                                    );
                                }

                                return null;
                            })}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Legend + detail */}
            <Box
                sx={{
                    flexShrink: 0,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1.5,
                    px: 1.5,
                    py: 0.4,
                    borderTop: "1px solid #1e2834",
                    bgcolor: "#0a0e14",
                    fontFamily: "Share Tech Mono, monospace",
                    fontSize: "0.45rem",
                    letterSpacing: "0.06em",
                    color: C.muted,
                }}
            >
                {[
                    { c: C.warn, t: "OBTENIDA" },
                    { c: "#8a9aaa", t: "NO OBT" },
                    { c: C.nodeOffBorder, t: "LOCKED" },
                    { c: C.ok, t: "TRAIT" },
                    { c: C.cyan, t: "TALENT" },
                    { c: "#e8a020", t: "MASTERY" },
                    { c: C.narr, t: "NARRATIVE" },
                ].map((l) => (
                    <Box key={l.t} sx={{ color: l.c, display: "flex", alignItems: "center", gap: 0.4 }}>
                        <Box sx={{ width: 8, height: 8, bgcolor: "currentColor" }} />
                        {l.t}
                    </Box>
                ))}
                {xp != null && (
                    <CyberText sx={{ ml: "auto", fontSize: "0.45rem", color: C.cyan }}>
                        XP {xp}/15
                    </CyberText>
                )}
            </Box>

            <Box
                sx={{
                    flexShrink: 0,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderTop: "1px solid #1e2834",
                    bgcolor: "#0c1016",
                    minHeight: 62,
                }}
            >
                <Box>
                    <CyberText sx={{ fontSize: "0.5rem", color: C.cyan, letterSpacing: "0.12em" }}>
                        {(selected?.kind || "PERK").toString().toUpperCase()}
                    </CyberText>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: C.warn, letterSpacing: "0.08em", my: 0.25 }}>
                        {selected?.label || "—"}
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.72rem", color: C.muted, m: 0, display: "block" }}>
                        {selected?.blurb || "Columna = nivel. Ability → T1/T2 → M a la derecha. Lo obtenido brilla en oro."}
                    </CyberText>
                </Box>
                <Box sx={{ textAlign: "right", fontFamily: "Share Tech Mono, monospace", fontSize: "0.55rem", color: C.muted }}>
                    <CyberText sx={{ display: "block", color: C.cyan, fontSize: "0.65rem" }}>
                        {(selected?.state || "—").toString().toUpperCase()}
                    </CyberText>
                    {selected?.chapter != null && `CH${selected.chapter}`}
                    {selected?.rank && selected.kind === "ability" && ` · ${selected.rank}`}
                </Box>
            </Box>
        </Box>
    );
}
