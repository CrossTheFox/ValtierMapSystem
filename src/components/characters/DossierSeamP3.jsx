import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { useResolvedCombatStats } from "../../hooks/useResolvedCombatStats";
import { useFitChips } from "../../hooks/useFitChips";
import { useDossier } from "../CharactersSettingsDialog";
import {
    DEFAULT_TURN,
    normalizeCharacterVitals,
    normalizeTurn,
} from "../../utils/characterVitals";
import {
    clampHpCur,
    clampVigor,
    commitSeamHpChange,
    commitSeamVigChange,
    computeBarPercents,
    scrubDeltaToValue,
    vigorGainBlocked,
} from "../../utils/seamVitals";
import {
    activeCharacterConditions,
    normalizeCharacterConditions,
    hasNegConditions,
    hasPosConditions,
} from "../../constants/characterConditions";
import { ConditionDrawer, ConditionsTagBtn } from "./ConditionDrawer";

const VIGOR = UI_COLORS.vigor;
const CYAN = UI_COLORS.anomaly;
const DANGER = UI_COLORS.danger;

/** Seam chip — mockup `.seam-full .cond-zone .cx` (skewed, per-code `--cx` accent). */
function CxChip({ code, color, registerRef }) {
    return (
        <Box
            ref={registerRef}
            title={code}
            sx={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                px: "10px",
                py: "4px",
                minWidth: "2.75em",
                transform: "skewX(-12deg)",
                border: `1px solid ${color}eb`,
                background: `linear-gradient(180deg, ${color}61 0%, rgba(4,4,10,0.96) 100%)`,
                boxShadow: `inset 0 1px 0 ${color}8c, 0 0 7px ${color}6b`,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                color,
            }}
        >
            <Box
                component="span"
                sx={{
                    display: "block",
                    transform: "skewX(12deg)",
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.58rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    textShadow: `0 0 6px ${color}8c`,
                }}
            >
                {code}
            </Box>
        </Box>
    );
}

/** `+N` overflow chip — mockup `.cx.more`. */
function CxMoreChip({ n, onClick, registerRef }) {
    return (
        <Box
            ref={registerRef}
            component="button"
            type="button"
            onClick={onClick}
            title={`${n} más — abrir Conditions`}
            sx={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                px: "10px",
                py: "4px",
                minWidth: "2.75em",
                cursor: "pointer",
                transform: "skewX(-12deg)",
                border: "1px solid rgba(255,255,255,0.4)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(8,8,14,0.95))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(0,0,0,0.92)",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                color: "rgba(255,255,255,0.7)",
            }}
        >
            <Box
                component="span"
                sx={{
                    display: "block",
                    transform: "skewX(12deg)",
                    fontFamily: '"Fira Code", monospace',
                    fontSize: "0.58rem",
                    letterSpacing: "0.06em",
                }}
            >
                +{n}
            </Box>
        </Box>
    );
}

function VitChipStepper({
    kind,
    value,
    max,
    open,
    onToggle,
    onDelta,
    onSet,
    onClose,
    /** When true, + is disabled (ICON Shattered / SHA). */
    gainBlocked = false,
}) {
    const isHp = kind === "hp";
    const shattered = !isHp && gainBlocked;
    const accent = isHp ? CYAN : (shattered ? DANGER : VIGOR);
    const borderColor = isHp
        ? "rgba(0,242,234,0.5)"
        : (shattered ? "rgba(255,51,85,0.55)" : "rgba(184,255,60,0.5)");
    const btnBorder = isHp
        ? "rgba(0,242,234,0.4)"
        : (shattered ? "rgba(255,51,85,0.45)" : "rgba(184,255,60,0.4)");
    const display = isHp ? String(value) : (value > 0 ? `+${value}` : "+0");
    const ghost = !isHp && value === 0 && !shattered;
    const chipTitle = isHp
        ? "Click = editar HP"
        : (gainBlocked
            ? "VIG bloqueado: condición Shattered (SHA) — no se puede ganar Vigor"
            : "Click = editar VIG");

    const bump = (d) => {
        if (d > 0 && gainBlocked) return;
        onDelta(d);
    };

    return (
        <Box sx={{ position: "relative" }}>
            <Box
                component="button"
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
                title={chipTitle}
                aria-description={gainBlocked && !isHp ? "Shattered: vigor gain blocked" : undefined}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    boxSizing: "border-box",
                    width: "4.8em",
                    p: "4px 0",
                    transform: "skewX(-12deg)",
                    border: `1px solid ${accent}eb`,
                    background: `linear-gradient(180deg, ${accent}61 0%, rgba(4,4,10,0.96) 100%)`,
                    boxShadow: `inset 0 1px 0 ${accent}8c, 0 0 7px ${accent}6b`,
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    color: accent,
                    cursor: "pointer",
                    opacity: ghost ? 0.35 : 1,
                    filter: open ? "brightness(1.12)" : undefined,
                    "&:hover": { opacity: ghost ? 0.75 : 1, filter: "brightness(1.12)" },
                }}
            >
                <Box
                    component="span"
                    sx={{
                        display: "block",
                        transform: "skewX(12deg)",
                        fontFamily: '"Fira Code", monospace',
                        fontSize: "0.64rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                    }}
                >
                    {isHp ? "HP" : "VIG"}
                </Box>
                <Box
                    component="span"
                    sx={{
                        display: "block",
                        transform: "skewX(12deg)",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.68rem",
                        letterSpacing: "0.04em",
                        fontVariantNumeric: "tabular-nums",
                        overflow: "hidden",
                        maxWidth: "2.4em",
                        textAlign: "center",
                        color: isHp ? "#fff" : accent,
                        textDecoration: shattered ? "line-through" : undefined,
                        textDecorationThickness: shattered ? "1.5px" : undefined,
                        textShadow: `0 0 6px ${accent}8c`,
                    }}
                >
                    {display}
                </Box>
            </Box>
            {open && (
                <Box
                    role="group"
                    aria-label={isHp ? "Set HP" : "Set Vigor"}
                    data-vit-step
                    sx={{
                        position: "absolute",
                        zIndex: 40,
                        left: "50%",
                        top: "calc(100% + 5px)",
                        transform: "translateX(-50%)",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "2px",
                        p: "3px",
                        bgcolor: "#12121a",
                        borderRadius: "3px",
                        border: `1px solid ${borderColor}`,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Box
                        component="button"
                        type="button"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            bump(-1);
                        }}
                        sx={{
                            width: 22, height: 20, borderRadius: "2px", p: 0,
                            fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem",
                            cursor: "pointer", bgcolor: "rgba(255,255,255,0.05)",
                            border: `1px solid ${btnBorder}`, color: accent,
                            "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                        }}
                    >
                        −
                    </Box>
                    <Box
                        component="input"
                        type="number"
                        min={0}
                        max={isHp ? max : undefined}
                        value={value}
                        onChange={(e) => onSet(Number(e.target.value))}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") onClose();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        sx={{
                            width: "2.4em", height: 20,
                            border: "1px solid rgba(255,255,255,0.12)",
                            bgcolor: "#0a0a12",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.62rem",
                            textAlign: "center",
                            outline: "none",
                            borderRadius: "2px",
                            color: accent,
                            MozAppearance: "textfield",
                            "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
                                WebkitAppearance: "none",
                                margin: 0,
                            },
                        }}
                    />
                    <Box
                        component="button"
                        type="button"
                        disabled={gainBlocked && !isHp}
                        title={gainBlocked && !isHp ? "Shattered (SHA): no se puede ganar Vigor" : undefined}
                        aria-disabled={gainBlocked && !isHp ? true : undefined}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            bump(1);
                        }}
                        sx={{
                            width: 22, height: 20, borderRadius: "2px", p: 0,
                            fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem",
                            cursor: gainBlocked && !isHp ? "not-allowed" : "pointer",
                            bgcolor: "rgba(255,255,255,0.05)",
                            border: `1px solid ${btnBorder}`, color: accent,
                            opacity: gainBlocked && !isHp ? 0.35 : 1,
                            "&:hover": {
                                bgcolor: gainBlocked && !isHp
                                    ? "rgba(255,255,255,0.05)"
                                    : "rgba(255,255,255,0.12)",
                            },
                        }}
                    >
                        +
                    </Box>
                </Box>
            )}
        </Box>
    );
}

/** P3 Bracket Ends — HP/VIG chips + proportional scrub (always live). */
export default function DossierSeamP3({ character }) {
    const { patchDraft } = useDossier();
    const { combatStats } = useResolvedCombatStats(character);
    const hpMax = combatStats?.hpMax ?? 16;

    const vitals = useMemo(
        () => normalizeCharacterVitals(character, { effortMax: 3 }),
        [character],
    );

    const remoteHp = vitals?.hpCur ?? 0;
    const remoteVig = vitals?.vigor ?? 0;
    const hpBroken = vitals?.hpBroken ?? false;
    const turn = normalizeTurn(character?.turn ?? DEFAULT_TURN);

    /** Local overlay — paints instantly; parent draft/Firestore catch up debounced. */
    const [localHp, setLocalHp] = useState(null);
    const [localVig, setLocalVig] = useState(null);
    const [preview, setPreview] = useState(null);

    const hpCur = localHp != null ? localHp : remoteHp;
    const vigor = localVig != null ? localVig : remoteVig;
    // Local chip edits must win over bar-scrub preview (stuck preview was masking VIG).
    const displayHp = localHp != null ? localHp : (preview ? preview.hp : remoteHp);
    const displayVig = localVig != null ? localVig : (preview ? preview.vig : remoteVig);
    const { hpPct, vigPct } = computeBarPercents(hpMax, displayHp, displayVig);
    const conditions = normalizeCharacterConditions(character?.conditions);
    const vigGainBlocked = vigorGainBlocked(conditions);

    const activeConditions = useMemo(
        () => activeCharacterConditions(character?.conditions),
        [character?.conditions],
    );
    const chipItems = useMemo(
        () => activeConditions.map((c) => ({ key: c.key, code: c.code, color: c.color })),
        [activeConditions],
    );
    const { containerRef: chipsContainerRef, registerMeasure, visibleItems: visibleChips, overflowCount } = useFitChips(chipItems);
    const condNeg = hasNegConditions(character?.conditions);
    const condPos = hasPosConditions(character?.conditions);

    const [hpStepOpen, setHpStepOpen] = useState(false);
    const [vigStepOpen, setVigStepOpen] = useState(false);
    const [scrubMode, setScrubMode] = useState(null);
    const [condDrawerOpen, setCondDrawerOpen] = useState(false);

    const barRef = useRef(null);
    const hpWrapRef = useRef(null);
    const vigWrapRef = useRef(null);
    const scrubRef = useRef(null);
    const previewRef = useRef(null);

    const hpCurRef = useRef(hpCur);
    const vigorRef = useRef(vigor);
    const hpMaxRef = useRef(hpMax);
    const characterRef = useRef(character);
    const hpBrokenRef = useRef(hpBroken);
    const conditionsRef = useRef(conditions);
    const patchDraftRef = useRef(patchDraft);
    const pendingVitalsRef = useRef({});
    const vitalsTimerRef = useRef(null);
    const characterId = character?.id ?? null;

    hpCurRef.current = hpCur;
    vigorRef.current = vigor;
    hpMaxRef.current = hpMax;
    characterRef.current = character;
    hpBrokenRef.current = hpBroken;
    conditionsRef.current = conditions;
    patchDraftRef.current = patchDraft;

    /** Drop local overlay once remote matches (save / Redux caught up). */
    useEffect(() => {
        setLocalHp((prev) => (prev != null && prev === remoteHp ? null : prev));
        setLocalVig((prev) => (prev != null && prev === remoteVig ? null : prev));
    }, [remoteHp, remoteVig]);

    useEffect(() => {
        setLocalHp(null);
        setLocalVig(null);
        pendingVitalsRef.current = {};
        if (vitalsTimerRef.current) {
            clearTimeout(vitalsTimerRef.current);
            vitalsTimerRef.current = null;
        }
    }, [characterId]);

    const flushVitalsPatch = useCallback(() => {
        vitalsTimerRef.current = null;
        const partial = pendingVitalsRef.current;
        pendingVitalsRef.current = {};
        if (!partial || !Object.keys(partial).length) return;
        patchDraftRef.current(partial);
    }, []);

    const scheduleVitalsPatch = useCallback((partial) => {
        pendingVitalsRef.current = { ...pendingVitalsRef.current, ...partial };
        if (vitalsTimerRef.current) clearTimeout(vitalsTimerRef.current);
        vitalsTimerRef.current = setTimeout(flushVitalsPatch, 350);
    }, [flushVitalsPatch]);

    useEffect(() => () => {
        if (vitalsTimerRef.current) {
            clearTimeout(vitalsTimerRef.current);
            vitalsTimerRef.current = null;
            const partial = pendingVitalsRef.current;
            pendingVitalsRef.current = {};
            if (partial && Object.keys(partial).length) {
                patchDraftRef.current(partial);
            }
        }
    }, []);

    const closeSteps = useCallback(() => {
        setHpStepOpen(false);
        setVigStepOpen(false);
    }, []);

    const toggleCondition = useCallback((key) => {
        const current = normalizeCharacterConditions(characterRef.current?.conditions);
        const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
        patchDraftRef.current({ conditions: next });
    }, []);

    const applyHpPatch = useCallback((nextRaw) => {
        // Drop scrub preview so chip edits are never masked.
        if (previewRef.current) {
            previewRef.current = null;
            setPreview(null);
        }
        const pending = pendingVitalsRef.current;
        const base = characterRef.current || {};
        const charForCascade = {
            ...base,
            hpCur: hpCurRef.current,
            vit: pending.vit !== undefined ? pending.vit : base.vit,
            hpBroken: pending.hpBroken !== undefined ? pending.hpBroken : hpBrokenRef.current,
        };
        const patch = commitSeamHpChange(
            charForCascade,
            nextRaw,
            {
                hpMax: hpMaxRef.current,
                hpCur: hpCurRef.current,
                hpBroken: charForCascade.hpBroken,
            },
        );
        hpCurRef.current = patch.hpCur;
        hpBrokenRef.current = patch.hpBroken;
        setLocalHp(patch.hpCur);
        const partial = {
            hpCur: patch.hpCur,
            hpBroken: patch.hpBroken,
        };
        if (patch.vit !== base.vit) {
            partial.vit = patch.vit;
        }
        scheduleVitalsPatch(partial);
    }, [scheduleVitalsPatch]);

    const applyVigPatch = useCallback((nextRaw) => {
        if (previewRef.current) {
            previewRef.current = null;
            setPreview(null);
        }
        const cur = Number.isFinite(Number(vigorRef.current)) ? Number(vigorRef.current) : 0;
        const raw = Number(nextRaw);
        const target = Number.isFinite(raw) ? raw : cur;
        const { vigor: next } = commitSeamVigChange(
            cur,
            target,
            conditionsRef.current,
        );
        vigorRef.current = next;
        setLocalVig(next);
        scheduleVitalsPatch({ vigor: next });
    }, [scheduleVitalsPatch]);

    useEffect(() => {
        const onDocPointerDown = (e) => {
            const t = e.target;
            if (!t?.closest?.("[data-vit-chip-wrap], [data-vit-step]")) closeSteps();
            if (!t?.closest?.("[data-cond-drawer]") && !t?.closest?.("[data-cond-btn]")) {
                setCondDrawerOpen(false);
            }
        };
        document.addEventListener("pointerdown", onDocPointerDown);
        return () => document.removeEventListener("pointerdown", onDocPointerDown);
    }, [closeSteps]);

    const bindWheel = useCallback((el, mode) => {
        if (!el) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (mode === "hp") {
                applyHpPatch(hpCurRef.current + (e.deltaY < 0 ? 1 : -1));
            } else {
                applyVigPatch(vigorRef.current + (e.deltaY < 0 ? 1 : -1));
            }
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [applyHpPatch, applyVigPatch]);

    useEffect(() => bindWheel(hpWrapRef.current, "hp"), [bindWheel]);
    useEffect(() => bindWheel(barRef.current, "hp"), [bindWheel]);
    useEffect(() => bindWheel(vigWrapRef.current, "vig"), [bindWheel]);

    const endScrub = useCallback((commit) => {
        const scrub = scrubRef.current;
        const snap = previewRef.current;
        scrubRef.current = null;
        previewRef.current = null;
        setScrubMode(null);
        setPreview(null);
        if (!commit || !scrub || !snap) return;
        applyHpPatch(snap.hp);
    }, [applyHpPatch]);

    const startScrub = useCallback((clientX, seedHp, seedVig) => {
        const bar = barRef.current;
        if (!bar) return;
        const rect = bar.getBoundingClientRect();
        const start = {
            x: clientX,
            hp: seedHp,
            vig: seedVig,
            barWidth: rect.width,
        };
        scrubRef.current = start;
        const next = { hp: seedHp, vig: seedVig };
        previewRef.current = next;
        setPreview(next);
        setScrubMode("hp");

        const onMove = (ev) => {
            const scrub = scrubRef.current;
            if (!scrub) return;
            const delta = scrubDeltaToValue(ev.clientX - scrub.x, scrub.barWidth, hpMaxRef.current);
            const nextSnap = { hp: clampHpCur(scrub.hp + delta, hpMaxRef.current), vig: scrub.vig };
            previewRef.current = nextSnap;
            setPreview(nextSnap);
        };
        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            endScrub(true);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    }, [endScrub]);

    const onHpScrubPointerDown = useCallback((e) => {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        closeSteps();
        startScrub(e.clientX, hpCurRef.current, vigorRef.current);
    }, [closeSteps, startScrub]);

    const onBarPointerDown = useCallback((e) => {
        if (e.target.closest("[data-hp-fill]")) return;
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        closeSteps();
        const bar = barRef.current;
        if (!bar) return;
        const rect = bar.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const hp = clampHpCur(Math.round(t * hpMaxRef.current), hpMaxRef.current);
        startScrub(e.clientX, hp, vigorRef.current);
    }, [closeSteps, startScrub]);

    const toggleTurn = (key) => {
        patchDraft({ turn: { [key]: !turn[key] } });
    };

    const barBoxShadow = scrubMode === "hp"
        ? "inset 0 0 0 1px rgba(0,242,234,0.75), 0 0 12px rgba(0,242,234,0.25)"
        : "inset 0 0 0 1px rgba(255,102,255,0.42), 0 0 0 1px rgba(255,102,255,0.08)";

    return (
        <Box
            className="dialog-no-drag"
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gap: "8px",
                alignItems: "center",
                height: 26,
                borderBottom: `1px solid rgba(255,102,255,0.28)`,
                position: "relative",
                px: "12px",
                bgcolor: "transparent",
            }}
        >
            {/* HP zone — span 6 */}
            <Box
                sx={{
                    gridColumn: "span 6",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    minWidth: 0,
                    position: "relative",
                    "&::after": {
                        content: '""',
                        position: "absolute",
                        top: "3px",
                        bottom: "3px",
                        right: "-4px",
                        width: "1px",
                        background: "linear-gradient(180deg, transparent, rgba(255,102,255,0.75), transparent)",
                        boxShadow: "0 0 6px rgba(255,102,255,0.35)",
                        transform: "skewX(-18deg)",
                        pointerEvents: "none",
                        zIndex: 2,
                    },
                }}
            >
                <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "3px" }}>
                    <Box ref={hpWrapRef} data-vit-chip-wrap>
                        <VitChipStepper
                            kind="hp"
                            value={displayHp}
                            max={hpMax}
                            open={hpStepOpen}
                            onToggle={() => {
                                setPreview(null);
                                previewRef.current = null;
                                setVigStepOpen(false);
                                setHpStepOpen((v) => !v);
                            }}
                            onDelta={(d) => applyHpPatch(hpCurRef.current + d)}
                            onSet={applyHpPatch}
                            onClose={closeSteps}
                        />
                    </Box>
                    <Box ref={vigWrapRef} data-vit-chip-wrap>
                        <VitChipStepper
                            kind="vig"
                            value={displayVig}
                            open={vigStepOpen}
                            onToggle={() => {
                                setPreview(null);
                                previewRef.current = null;
                                setHpStepOpen(false);
                                setVigStepOpen((v) => !v);
                            }}
                            onDelta={(d) => applyVigPatch(vigorRef.current + d)}
                            onSet={applyVigPatch}
                            onClose={closeSteps}
                            gainBlocked={vigGainBlocked}
                        />
                    </Box>
                </Box>
                <Box
                    ref={barRef}
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={hpMax}
                    aria-valuenow={displayHp}
                    aria-label="Hit points"
                    title={`HP ${displayHp}/${hpMax} · VIG ${displayVig} — arrastra hatch=HP · VIG solo en chip`}
                    onPointerDown={onBarPointerDown}
                    sx={{
                        position: "relative",
                        height: 12,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        cursor: "default",
                        touchAction: "none",
                        userSelect: "none",
                        bgcolor: "rgba(0,0,0,0.45)",
                        boxShadow: barBoxShadow,
                    }}
                >
                    {displayHp > 0 && (
                        <Box
                            data-hp-fill
                            onPointerDown={onHpScrubPointerDown}
                            style={{ width: `${hpPct}%` }}
                            sx={{
                                position: "absolute",
                                inset: "0 auto 0 0",
                                height: "100%",
                                minWidth: 2,
                                background: `linear-gradient(180deg, rgba(255,255,255,0.18), transparent 40%),
                                    repeating-linear-gradient(-45deg, #4dfff8 0 3px, #00e8e0 3px 5px, #00b8b2 5px 8px)`,
                                zIndex: 1,
                                touchAction: "none",
                                "&::after": {
                                    content: '""',
                                    position: "absolute",
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 2,
                                    bgcolor: "rgba(255,255,255,0.9)",
                                    boxShadow: `0 0 6px ${CYAN}88`,
                                },
                            }}
                        />
                    )}
                    {displayVig > 0 && (
                        <Box
                            data-hp-vig
                            style={{ left: `${hpPct}%`, width: `${vigPct}%` }}
                            sx={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                minWidth: 2,
                                background: `linear-gradient(90deg, #a8f03a, ${VIGOR})`,
                                zIndex: 2,
                                pointerEvents: "none",
                                boxShadow: "0 0 6px rgba(184,255,60,0.4)",
                            }}
                        />
                    )}
                    <Box sx={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
                        {[25, 50, 75].map((pct) => (
                            <Box
                                key={pct}
                                component="i"
                                sx={{
                                    position: "absolute",
                                    top: -1,
                                    bottom: -1,
                                    left: `${pct}%`,
                                    width: "1px",
                                    bgcolor: "rgba(255,102,255,0.45)",
                                }}
                            />
                        ))}
                    </Box>
                </Box>
                <Box
                    component="span"
                    title="HP máx."
                    sx={{
                        flexShrink: 0,
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.72rem",
                        letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.45)",
                        minWidth: "1.4em",
                        textAlign: "center",
                    }}
                >
                    {hpMax}
                </Box>
            </Box>

            {/* COND zone — span 3 */}
            <Box
                sx={{
                    gridColumn: "span 3",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 5fr) minmax(28px, 1fr)",
                    alignItems: "center",
                    minWidth: 0,
                    position: "relative",
                    borderRight: `1px solid rgba(255,102,255,0.22)`,
                }}
            >
                <Box ref={chipsContainerRef} sx={{ minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", gap: "3px", px: "4px 6px", height: "100%" }}>
                    {visibleChips.map((c) => (
                        <CxChip key={c.key} code={c.code} color={c.color} registerRef={registerMeasure(c.key)} />
                    ))}
                    {overflowCount > 0 && (
                        <CxMoreChip n={overflowCount} onClick={() => setCondDrawerOpen((v) => !v)} />
                    )}
                </Box>
                {/* Hidden measuring row — same chips, all of them, used only to read natural widths. */}
                <Box
                    aria-hidden
                    sx={{
                        position: "absolute", top: -9999, left: -9999,
                        display: "flex", alignItems: "center", gap: "3px",
                        visibility: "hidden", pointerEvents: "none",
                    }}
                >
                    {chipItems.map((c) => (
                        <CxChip key={c.key} code={c.code} color={c.color} registerRef={registerMeasure(c.key)} />
                    ))}
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minWidth: 36,
                        px: "5px",
                        borderLeft: `1px solid rgba(255,102,255,0.35)`,
                        background: "linear-gradient(90deg, rgba(255,102,255,0.04), transparent)",
                    }}
                >
                    <ConditionsTagBtn
                        condNeg={condNeg}
                        condPos={condPos}
                        activeCount={activeConditions.length}
                        open={condDrawerOpen}
                        onClick={() => setCondDrawerOpen((v) => !v)}
                    />
                </Box>
                {condDrawerOpen && (
                    <ConditionDrawer
                        activeKeys={normalizeCharacterConditions(character?.conditions)}
                        onToggle={toggleCondition}
                        onClose={() => setCondDrawerOpen(false)}
                    />
                )}
            </Box>

            {/* TURN zone — span 3 */}
            <Box
                sx={{
                    gridColumn: "span 3",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    minWidth: 0,
                    pl: "4px",
                }}
            >
                <Box
                    component="span"
                    sx={{
                        flexShrink: 0,
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.34rem",
                        letterSpacing: "0.12em",
                        color: "rgba(255,140,160,0.9)",
                        lineHeight: 1,
                    }}
                >
                    TURN
                </Box>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        alignItems: "center",
                        gap: "4px",
                        flex: 1,
                        minWidth: 0,
                        width: "100%",
                    }}
                    title="TURN · 2 actions + move"
                >
                    {[["act1", 1], ["act2", 2]].map(([key, n]) => (
                        <Box
                            key={key}
                            component="button"
                            type="button"
                            onClick={() => toggleTurn(key)}
                            title={`Action ${n}`}
                            sx={{
                                width: "100%",
                                height: 14,
                                p: 0,
                                cursor: "pointer",
                                border: turn[key]
                                    ? "1px solid rgba(255,90,120,0.95)"
                                    : "1px solid rgba(255,42,74,0.35)",
                                background: turn[key]
                                    ? "linear-gradient(90deg, #ff6a82, #ff2a4a 55%, #b01028)"
                                    : "#1a080c",
                                opacity: turn[key] ? 1 : 0.5,
                                boxShadow: turn[key] ? "0 0 7px rgba(255,42,74,0.45)" : "none",
                                clipPath: "polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)",
                            }}
                        />
                    ))}
                    <Box
                        component="button"
                        type="button"
                        onClick={() => toggleTurn("move")}
                        title="Move"
                        aria-label="Move"
                        sx={{
                            height: 14,
                            width: "100%",
                            p: 0,
                            cursor: "pointer",
                            color: CYAN,
                            border: turn.move
                                ? "1px solid rgba(0,242,234,0.85)"
                                : "1px solid rgba(0,242,234,0.35)",
                            background: turn.move
                                ? "linear-gradient(90deg, rgba(0,242,234,0.22), rgba(0,20,28,0.85))"
                                : "rgba(0,20,28,0.85)",
                            opacity: turn.move ? 1 : 0.5,
                            boxShadow: turn.move
                                ? "inset 0 0 0 1px rgba(0,242,234,0.18), 0 0 6px rgba(0,242,234,0.22)"
                                : "none",
                            clipPath: "polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            "&:hover": turn.move ? undefined : { borderColor: CYAN },
                        }}
                    >
                        <Box
                            component="svg"
                            viewBox="0 0 16 10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            sx={{ width: 12, height: 8, display: "block", filter: `drop-shadow(0 0 3px ${CYAN}8c)` }}
                        >
                            <path d="M1 5h10M8 1.5L13.5 5 8 8.5" />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
