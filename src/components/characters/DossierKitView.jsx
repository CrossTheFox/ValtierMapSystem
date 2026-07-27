import { useCallback, useMemo, useState } from "react";
import { Box, CircularProgress } from "@mui/material";

import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { useCharacterJobData } from "../../hooks/useCharacterJobData";
import { useDossier } from "../CharactersSettingsDialog";

/* ── colour tokens ────────────────────────────────────────────────── */
const C = {
    border:  UI_COLORS.border,
    text:    UI_COLORS.textPrimary,
    muted:   UI_COLORS.textSecondary,
    pink:    UI_COLORS.accent,
    cyan:    UI_COLORS.anomaly,
    lb:      "#ffcc33",
    trait:   "#7dd3fc",
    glowC:   "rgba(0,242,234,0.45)",
};

const MAX_LOADOUT = 6;

const SCROLL_SX = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    "&::-webkit-scrollbar": { width: "6px" },
    "&::-webkit-scrollbar-thumb": { background: "rgba(0,242,234,0.25)", borderRadius: "3px" },
    "&::-webkit-scrollbar-track": { background: "transparent" },
};

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

/* ── NarrCard (Kit variant — no bracket animation needed here) ─────── */
function KitCard({ tag, tagColor, title, text }) {
    return (
        <Box sx={{
            position: "relative",
            p: "12px 14px",
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            bgcolor: "rgba(0,0,0,0.28)",
            transition: "border-color 0.18s",
            "&:hover": { borderColor: `rgba(255,102,255,0.4)` },
        }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "6px" }}>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif", fontSize: "0.42rem", letterSpacing: "0.1em",
                    color: tagColor || C.lb,
                    border: `1px solid ${tagColor ? tagColor + "66" : "rgba(255,204,51,0.35)"}`,
                    px: "6px", py: "2px", borderRadius: "3px",
                }}>
                    {tag}
                </Box>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em",
                    color: C.text, flex: 1,
                }}>
                    {title}
                </Box>
            </Box>
            <Box component="p" sx={{ m: 0, fontSize: "0.78rem", color: C.muted, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                {text || <em style={{ opacity: 0.35 }}>Sin descripción</em>}
            </Box>
        </Box>
    );
}

/* ── Ability block (expandable) ──────────────────────────────────── */
function AbilityBlock({ ability, isActive, onToggle }) {
    const [open, setOpen] = useState(false);
    const { spawnPing } = useDossier();

    const handleHead = (e) => {
        spawnPing(e.clientX, e.clientY);
        onToggle();
    };

    return (
        <Box sx={{
            border: `1px solid ${isActive ? "rgba(0,242,234,0.45)" : C.border}`,
            borderRadius: "8px",
            bgcolor: "rgba(0,0,0,0.22)",
            overflow: "hidden",
        }}>
            {/* Head */}
            <Box
                onClick={handleHead}
                sx={{
                    display: "flex", alignItems: "center", gap: "8px",
                    p: "10px 12px", cursor: "pointer",
                    bgcolor: "rgba(0,0,0,0.2)",
                    "&:hover": { bgcolor: "rgba(255,102,255,0.04)" },
                }}
            >
                {/* Toggle checkbox */}
                <Box sx={{
                    width: 18, height: 18, borderRadius: "3px", flexShrink: 0,
                    border: `1px solid ${isActive ? C.cyan : C.border}`,
                    bgcolor: isActive ? "rgba(0,242,234,0.15)" : "transparent",
                    display: "grid", placeItems: "center",
                    color: isActive ? C.cyan : "transparent",
                    fontSize: "0.55rem",
                }}>
                    {isActive ? "✓" : ""}
                </Box>
                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.58rem", letterSpacing: "0.1em", flex: 1, color: C.text }}>
                    {ability.label}
                </Box>
                <Box
                    onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
                    sx={{
                        fontFamily: '"Fira Code", monospace', fontSize: "0.45rem",
                        color: C.muted, px: "6px",
                        "&:hover": { color: C.cyan },
                    }}
                >
                    {open ? "▲" : "▼"}
                </Box>
            </Box>

            {/* Body */}
            {open && (
                <Box sx={{ p: "0 12px 12px" }}>
                    <Box component="p" sx={{ m: "8px 0 10px", fontSize: "0.75rem", color: C.muted, lineHeight: 1.4 }}>
                        {ability.blurb}
                    </Box>
                    <Box sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: "6px",
                    }}>
                        {(ability.talents || []).map((t, i) => t && (
                            <Box key={i} sx={{
                                p: "8px", borderRadius: "6px",
                                border: `1px solid ${C.border}`, bgcolor: "rgba(0,0,0,0.25)",
                                fontSize: "0.68rem", color: C.muted,
                            }}>
                                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.4rem", letterSpacing: "0.1em", color: C.trait, mb: "4px" }}>
                                    TALENT {i + 1}
                                </Box>
                                <Box sx={{ color: C.text, fontSize: "0.72rem", mb: "2px" }}>{t.label}</Box>
                                {t.blurb}
                            </Box>
                        ))}
                        {ability.mastery && (
                            <Box sx={{
                                p: "8px", borderRadius: "6px",
                                border: `1px solid ${C.border}`, bgcolor: "rgba(0,0,0,0.25)",
                                fontSize: "0.68rem", color: C.muted,
                            }}>
                                <Box sx={{ fontFamily: "Orbitron, sans-serif", fontSize: "0.4rem", letterSpacing: "0.1em", color: C.pink, mb: "4px" }}>
                                    MASTERY
                                </Box>
                                <Box sx={{ color: C.text, fontSize: "0.72rem", mb: "2px" }}>{ability.mastery.label}</Box>
                                {ability.mastery.blurb}
                            </Box>
                        )}
                    </Box>
                </Box>
            )}
        </Box>
    );
}

/* ── Main component ───────────────────────────────────────────────── */
export default function DossierKitView({ character }) {
    const { spawnPing } = useDossier();
    const { loading, classIds, jobList } = useCharacterJobData(character);

    const activeClassId = character?.activeClassId || classIds[0] || null;
    const [focusClassId, setFocusClassId] = useState(activeClassId);

    /* Loadout state — persistent via Firestore, local for immediate UI */
    const currentLoadout = useMemo(() => {
        const raw = character?.loadout || character?.selectedAbilities || [];
        return Array.isArray(raw) ? raw : [];
    }, [character?.loadout, character?.selectedAbilities]);

    const [loadout, setLoadout] = useState(currentLoadout);

    const activeJob = useMemo(
        () => jobList.find((j) => j.classId === (focusClassId || activeClassId)) || jobList[0] || null,
        [jobList, focusClassId, activeClassId]
    );

    /* Majority rule: ≥ half of loadout from active job */
    const majorityOk = useCallback((nextLoadout, jobAbilityIds) => {
        if (!jobAbilityIds?.length) return true;
        const jobCount = nextLoadout.filter((id) => jobAbilityIds.includes(id)).length;
        const otherCount = nextLoadout.length - jobCount;
        return jobCount >= otherCount;
    }, []);

    const handleJobChip = (e, classId) => {
        spawnPing(e.clientX, e.clientY);
        setFocusClassId(classId);
        if (character?.id) {
            updateCharacterFields(character.id, { activeClassId: classId }).catch(console.error);
        }
    };

    const handleAbilityToggle = useCallback((abilityId, jobAbilityIds) => {
        setLoadout((prev) => {
            const on = prev.includes(abilityId);
            let next;
            if (on) {
                next = prev.filter((id) => id !== abilityId);
            } else {
                if (prev.length >= MAX_LOADOUT) return prev; // full
                next = [...prev, abilityId];
                if (!majorityOk(next, jobAbilityIds)) return prev; // majority rule
            }
            // Persist
            if (character?.id) {
                updateCharacterFields(character.id, { loadout: next }).catch(console.error);
            }
            return next;
        });
    }, [character?.id, majorityOk]);

    const jobAbilityIds = useMemo(
        () => (activeJob?.abilities || []).map((a) => a.id),
        [activeJob]
    );

    const allAbilities = useMemo(() => {
        if (!activeJob) return [];
        const fromJob = activeJob.abilities.map((a) => ({ ...a, jobLabel: activeJob.label }));
        const others = jobList
            .filter((j) => j.classId !== activeJob.classId)
            .flatMap((j) => j.abilities.map((a) => ({ ...a, jobLabel: j.label })));
        // Deduplicate by id
        const seen = new Set();
        return [...fromJob, ...others].filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }, [activeJob, jobList]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <CircularProgress size={28} sx={{ color: C.cyan }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: "rgba(8,8,14,0.55)" }}>
            {/* Neon trail */}
            <div className="dossier-trail" style={{ margin: "0 18px 0" }} />

            <Box sx={{ ...SCROLL_SX, px: "18px", pb: "28px" }}>

                {/* ── JOB ACTIVO ──────────────────────────────────── */}
                <SectionLabel limit="1 por sesión">JOB ACTIVO</SectionLabel>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px", mb: "14px" }}>
                    {jobList.map((job) => {
                        const isActive = job.classId === (focusClassId || activeClassId);
                        return (
                            <Box
                                key={job.classId}
                                component="button"
                                type="button"
                                onClick={(e) => handleJobChip(e, job.classId)}
                                sx={{
                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.48rem", letterSpacing: "0.08em",
                                    px: "12px", py: "7px", borderRadius: "999px",
                                    border: `1px solid ${isActive ? C.cyan : C.border}`,
                                    color: isActive ? C.cyan : C.muted,
                                    bgcolor: isActive ? "rgba(0,242,234,0.1)" : "rgba(0,0,0,0.35)",
                                    boxShadow: isActive ? `0 0 14px ${C.glowC}` : "none",
                                    cursor: "pointer",
                                    transition: "border-color 0.15s, color 0.15s, box-shadow 0.15s",
                                    "&:hover": { borderColor: C.cyan, color: C.text },
                                }}
                            >
                                {job.label}
                                {isActive && (
                                    <Box component="span" sx={{ ml: "6px", fontSize: "0.4rem", color: C.lb }}>
                                        ACTIVE
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                    {jobList.length === 0 && (
                        <Box sx={{ fontSize: "0.7rem", color: C.muted }}>Sin clases asignadas</Box>
                    )}
                </Box>

                {/* ── LOADOUT BAR ─────────────────────────────────── */}
                <Box sx={{
                    display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
                    p: "8px 12px", mb: "16px", borderRadius: "8px",
                    border: "1px solid rgba(255,204,51,0.28)",
                    bgcolor: "rgba(255,204,51,0.06)",
                    fontFamily: '"Fira Code", monospace', fontSize: "0.55rem", color: C.muted,
                }}>
                    <span>LOADOUT <strong style={{ color: C.lb }}>{loadout.length}/{MAX_LOADOUT}</strong></span>
                    <Box sx={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {Array.from({ length: MAX_LOADOUT }).map((_, i) => (
                            <Box key={i} sx={{
                                width: 22, height: 22, borderRadius: "4px",
                                border: `1px solid ${i < loadout.length ? C.cyan : C.border}`,
                                bgcolor: i < loadout.length ? "rgba(0,242,234,0.12)" : "rgba(0,0,0,0.35)",
                                display: "grid", placeItems: "center",
                                fontSize: "0.45rem",
                                color: i < loadout.length ? C.cyan : C.muted,
                            }}>
                                {i < loadout.length ? "◈" : "·"}
                            </Box>
                        ))}
                    </Box>
                    <Box component="span" sx={{ ml: "auto" }}>mayoría del job activo</Box>
                </Box>

                {activeJob && (
                    <>
                        {/* ── TRAITS ──────────────────────────────── */}
                        <SectionLabel>TRAITS</SectionLabel>
                        <Box sx={{
                            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
                            mb: "8px", alignItems: "start",
                            "@media (max-width:700px)": { gridTemplateColumns: "1fr" },
                        }}>
                            {activeJob.traits.map((t) => t && (
                                <KitCard
                                    key={t.id}
                                    tag="TRAIT"
                                    tagColor={C.trait}
                                    title={t.label}
                                    text={t.blurb}
                                />
                            ))}
                            {activeJob.traits.length === 0 && (
                                <Box sx={{ fontSize: "0.7rem", color: C.muted }}>Sin traits</Box>
                            )}
                        </Box>

                        {/* ── LIMIT BREAK ─────────────────────────── */}
                        {activeJob.limitBreak && (
                            <>
                                <SectionLabel>LIMIT BREAK</SectionLabel>
                                <Box sx={{ mb: "8px" }}>
                                    <KitCard
                                        tag="LIMIT"
                                        tagColor={C.lb}
                                        title={activeJob.limitBreak.label}
                                        text={activeJob.limitBreak.blurb}
                                    />
                                </Box>
                            </>
                        )}
                    </>
                )}

                {/* ── HABILIDADES ──────────────────────────────────── */}
                <SectionLabel limit="+ 2 talentos · 1 mastery c/u">HABILIDADES</SectionLabel>
                <Box sx={{
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
                    mb: "8px", alignItems: "start",
                    "@media (max-width:700px)": { gridTemplateColumns: "1fr" },
                }}>
                    {allAbilities.map((ab) => (
                        <AbilityBlock
                            key={ab.id}
                            ability={ab}
                            isActive={loadout.includes(ab.id)}
                            onToggle={() => handleAbilityToggle(ab.id, jobAbilityIds)}
                        />
                    ))}
                    {allAbilities.length === 0 && (
                        <Box sx={{ fontSize: "0.7rem", color: C.muted }}>Sin habilidades cargadas</Box>
                    )}
                </Box>

                {/* Footer note */}
                <Box sx={{
                    mt: "8px", p: "10px 12px", borderRadius: "6px",
                    border: `1px solid rgba(255,102,255,0.22)`,
                    bgcolor: "rgba(255,102,255,0.05)",
                    fontSize: "0.7rem", color: C.muted, lineHeight: 1.4,
                }}>
                    Loadout ≤{MAX_LOADOUT} · mayoría del job activo. ◈ MESH abre la progresión visual.
                </Box>
            </Box>
        </Box>
    );
}
