import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    Box,
    CircularProgress,
    Paper,
    Stack,
    Dialog,
    DialogContent,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Tooltip,
    useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { CyberTitle, CyberText } from "../../../customs/CustomTexts";
import CyberTooltip from "../../../customs/CyberTooltip";
import { UI_COLORS } from "../../../../constants/uiColors";
import { cyberMenuPaperSx, cyberMenuItemSx } from "../../../../constants/designSystem";
import { archGlow, normalizeDeg, polar, wedgePath } from "./orbitLayoutEngine";
import { useOrbitMatrixData } from "./useOrbitMatrixData";

const TYPE_META = {
    class_root: { label: "Clase", Icon: WorkspacePremiumIcon, hint: "Job / núcleo del árbol." },
    trait: { label: "Trait", Icon: AutoAwesomeIcon, hint: "Pasivo de progresión." },
    ability: { label: "Habilidad", Icon: FlashOnIcon, hint: "Acción activa." },
    upgrade: { label: "Mejora", Icon: AddCircleOutlineIcon, hint: "Rama de mejora sobre la habilidad." },
    mastery: { label: "Mastery", Icon: MilitaryTechIcon, hint: "Maestría vinculada al padre." },
    ultimate: { label: "Limit Break", Icon: WhatshotIcon, hint: "Ulti / super del job." },
};

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.4;

function SkillOrbitNode({ ability, isUnlocked, accent, onSelect, reducedMotion, sectorGlow }) {
    const t = ability?.type || "";
    const meta = TYPE_META[t] || { label: t || "Nodo", Icon: FlashOnIcon, hint: "" };
    const Icon = meta.Icon;
    const hot = Boolean(isUnlocked && sectorGlow);
    const dim = t === "class_root" ? 40 : t === "ultimate" ? 42 : t === "ability" ? 34 : t === "trait" ? 30 : 26;
    const col = hot ? accent : "#4a4a62";

    const tip = (
        <Paper elevation={0} sx={{ p: 1.25, maxWidth: 300, bgcolor: "rgba(10,10,18,0.97)", border: `1px solid ${col}66` }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                <Icon sx={{ fontSize: 22, color: col }} />
                <Box>
                    <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.anomaly, letterSpacing: 1 }}>{meta.label}</CyberText>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: "#fff", lineHeight: 1.2 }}>{ability.label}</CyberTitle>
                </Box>
            </Stack>
            {meta.hint ? (
                <CyberText sx={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.55)", mb: 0.75 }}>{meta.hint}</CyberText>
            ) : null}
            {ability.content ? (
                <CyberText sx={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.88)", lineHeight: 1.45 }}>
                    {(ability.content || "").slice(0, 220)}
                    {(ability.content || "").length > 220 ? "…" : ""}
                </CyberText>
            ) : null}
            <CyberText sx={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", mt: 1 }}>Clic: ver texto completo</CyberText>
        </Paper>
    );

    return (
        <Tooltip title={tip} arrow followCursor placement="right" slotProps={{ tooltip: { sx: { bgcolor: "transparent", p: 0, maxWidth: 320 } } }}>
            <Box
                component="button"
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(ability);
                }}
                sx={{
                    position: "absolute",
                    border: "none",
                    padding: 0,
                    left: ability.__x - dim / 2,
                    top: ability.__y - dim / 2,
                    width: dim,
                    height: dim,
                    borderRadius: t === "upgrade" ? "50%" : t === "mastery" ? "4px" : "50%",
                    border: hot ? `2px solid ${col}` : `1px solid ${col}`,
                    boxShadow: hot ? `0 0 0 2px rgba(0,0,0,0.5), 0 0 18px ${col}55` : "inset 0 0 0 1px rgba(0,0,0,0.4)",
                    bgcolor: hot ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.72)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: hot ? col : "rgba(255,255,255,0.35)",
                    transition: reducedMotion ? "none" : "transform 0.16s, box-shadow 0.16s",
                    zIndex: t === "class_root" ? 6 : 4,
                    "&:hover": {
                        transform: reducedMotion ? "none" : "scale(1.08)",
                        zIndex: 10,
                        color: col,
                        boxShadow: `0 0 22px ${col}66`,
                    },
                    "&:focus-visible": { outline: `2px solid ${UI_COLORS.accent}`, outlineOffset: 2 },
                }}
            >
                <Icon sx={{ fontSize: t === "class_root" || t === "ultimate" ? 22 : 18 }} />
            </Box>
        </Tooltip>
    );
}

function attachPos(ability, x, y) {
    return { ...ability, __x: x, __y: y };
}

function AbilityDetailDialog({ open, ability, accent, onClose }) {
    if (!ability) return null;
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: UI_COLORS.backgroundSecondary,
                        border: `1px solid ${UI_COLORS.border}`,
                        backgroundImage: "none",
                    },
                },
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", px: 2, pt: 1.5 }}>
                <CyberTitle sx={{ color: accent, fontSize: "1rem", pr: 1 }}>{ability.label}</CyberTitle>
                <IconButton onClick={onClose} size="small" sx={{ color: UI_COLORS.accent }}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent sx={{ pt: 1 }}>
                {ability.cost ? (
                    <CyberText sx={{ fontSize: "0.75rem", color: accent, mb: 1 }}>[{String(ability.cost).toUpperCase()}]</CyberText>
                ) : null}
                <CyberText sx={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.9)", lineHeight: 1.55 }}>{ability.content}</CyberText>
                <CyberText sx={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", mt: 2, display: "block" }}>
                    {String(ability.type || "").toUpperCase()} · {ability.key}
                </CyberText>
            </DialogContent>
        </Dialog>
    );
}

function TypeLegend() {
    const row = (key) => {
        const m = TYPE_META[key];
        if (!m) return null;
        const I = m.Icon;
        return (
            <Stack direction="row" spacing={0.5} alignItems="center" key={key}>
                <I sx={{ fontSize: 14, color: UI_COLORS.anomaly, opacity: 0.9 }} />
                <CyberText sx={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.5)" }}>{m.label}</CyberText>
            </Stack>
        );
    };
    return (
        <Stack
            direction="row"
            flexWrap="wrap"
            spacing={1.25}
            useFlexGap
            sx={{ gap: 1, justifyContent: "center", py: 0.5, flexShrink: 0 }}
        >
            {row("class_root")}
            {row("trait")}
            {row("ability")}
            {row("upgrade")}
            {row("mastery")}
            {row("ultimate")}
        </Stack>
    );
}

/**
 * Orbit skill tree — fits container, pan/zoom (CSS transform, LAB-like),
 * one full orbit per job when singleJob.
 */
export default function SkillMatrixConstellation({ character, fillAvailable, singleJob = true }) {
    const [selected, setSelected] = useState(/** @type {Record<string, unknown>|null} */ (null));
    const [viewPx, setViewPx] = useState(520);
    const [localFocusId, setLocalFocusId] = useState(null);
    const [cam, setCam] = useState({ x: 0, y: 0, z: 1 });
    const [dragging, setDragging] = useState(false);
    const wheelWrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
    const dragRef = useRef(null);
    const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

    const assignedIds = character?.assignedClassIds || [];
    const focusClassId = localFocusId && assignedIds.includes(localFocusId)
        ? localFocusId
        : (character?.activeClassId && assignedIds.includes(character.activeClassId)
            ? character.activeClassId
            : assignedIds[0] || null);

    const {
        geom,
        guideMeta,
        halfSpan,
        bases,
        sectorLayouts,
        mcPayload,
        mcLoading,
        loading,
        checkU,
        onActiveJobSelect,
        mode,
        ids,
        jobCount,
        activeClassId,
        focusClassId: resolvedFocus,
    } = useOrbitMatrixData(character, viewPx, { singleJob, focusClassId });

    const onSelectAbility = useCallback((a) => setSelected(a), []);

    const resetCam = useCallback(() => setCam({ x: 0, y: 0, z: 1 }), []);

    // Attach after data ready — early loading return unmounts the stage ref
    const stageReady = !loading && Boolean(sectorLayouts?.length);

    useLayoutEffect(() => {
        if (!stageReady) return undefined;
        const el = wheelWrapRef.current;
        if (!el) return undefined;
        const measure = () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            const side = Math.max(
                260,
                Math.floor(Math.min(w > 40 ? w : 520, h > 40 ? h : w > 40 ? w : 520) - 4),
            );
            setViewPx(side);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [stageReady]);

    // Reset camera when switching job / character
    useEffect(() => {
        resetCam();
    }, [resolvedFocus, character?.id, resetCam]);

    useEffect(() => {
        if (!stageReady) return undefined;
        const el = wheelWrapRef.current;
        if (!el) return undefined;

        const onWheel = (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            setCam((prev) => ({
                ...prev,
                z: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.z * factor)),
            }));
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [stageReady]);

    const onPointerDown = (e) => {
        if (e.button !== 0 && e.button !== 1) return;
        // Don't start pan from a node button
        if (e.target?.closest?.("button")) return;
        dragRef.current = {
            px: e.clientX,
            py: e.clientY,
            ox: cam.x,
            oy: cam.y,
            pointerId: e.pointerId,
        };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        setCam((prev) => ({
            ...prev,
            x: d.ox + (e.clientX - d.px),
            y: d.oy + (e.clientY - d.py),
        }));
    };

    const onPointerUp = (e) => {
        if (dragRef.current?.pointerId === e.pointerId) {
            dragRef.current = null;
            setDragging(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                <CircularProgress sx={{ color: UI_COLORS.accent }} />
            </Box>
        );
    }

    if (mode === "multiclass" && !mcLoading && !mcPayload) {
        return (
            <CyberText sx={{ display: "block", textAlign: "center", py: 4, color: "rgba(255,255,255,0.65)" }}>
                No se pudieron cargar las clases desde Firestore.
            </CyberText>
        );
    }

    if (!sectorLayouts?.length) {
        return (
            <CyberText sx={{ display: "block", textAlign: "center", py: 4, color: "rgba(255,255,255,0.65)" }}>
                Sin datos para constelación.
            </CyberText>
        );
    }

    const dialogAccent = selected ? archGlow(selected.classArchetype) : UI_COLORS.accent;
    const { cx, cy, rOut, view } = geom;
    const spokeDegs = singleJob ? [] : (bases || []).map((b) => normalizeDeg(b));
    const focusLabel = mcPayload?.metaById?.[resolvedFocus || ""]?.displayName
        || resolvedFocus
        || "JOB";

    const handleFocusJob = (id) => {
        setLocalFocusId(id);
        onActiveJobSelect(id);
    };

    return (
        <Box
            sx={{
                width: "100%",
                flex: fillAvailable ? 1 : undefined,
                minHeight: fillAvailable ? 0 : 420,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: UI_COLORS.backgroundPrimary || "#0d0d14",
            }}
        >
            <Stack
                direction="row"
                flexWrap="wrap"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{
                    px: 1.25,
                    py: 0.75,
                    flexShrink: 0,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    bgcolor: UI_COLORS.backgroundSecondary,
                }}
            >
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.anomaly, letterSpacing: 2 }}>
                    {singleJob
                        ? `// ÓRBITA · ${String(focusLabel).toUpperCase()}`
                        : `// ÓRBITA — ${jobCount} JOB${jobCount === 1 ? "" : "S"}`}
                </CyberText>

                <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
                    {mode === "multiclass" && ids.length > 1 && mcPayload?.metaById ? (
                        singleJob ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ gap: 0.5 }}>
                                {ids.map((id) => {
                                    const name = (mcPayload.metaById[id]?.displayName || id).toString();
                                    const active = id === resolvedFocus;
                                    return (
                                        <Box
                                            key={id}
                                            component="button"
                                            type="button"
                                            onClick={() => handleFocusJob(id)}
                                            sx={{
                                                px: 1.25,
                                                py: 0.45,
                                                cursor: "pointer",
                                                border: `1px solid ${active ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                                bgcolor: active ? `${UI_COLORS.anomaly}18` : "rgba(0,0,0,0.35)",
                                                borderRadius: 0.5,
                                                color: active ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                                fontFamily: "'Fira Code', monospace",
                                                fontSize: "0.58rem",
                                                letterSpacing: "0.08em",
                                                textTransform: "uppercase",
                                                "&:hover": { borderColor: UI_COLORS.anomaly, color: UI_COLORS.textPrimary },
                                            }}
                                        >
                                            {name}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        ) : (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel id="orbit-active-job" sx={{ color: UI_COLORS.textSecondary }}>
                                    Job activo
                                </InputLabel>
                                <Select
                                    labelId="orbit-active-job"
                                    label="Job activo"
                                    value={activeClassId || ""}
                                    onChange={(e) => onActiveJobSelect(e.target.value)}
                                    MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                                    sx={{
                                        color: UI_COLORS.textPrimary,
                                        "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                                        "& .MuiSelect-icon": { color: UI_COLORS.textSecondary },
                                    }}
                                >
                                    {ids.map((id) => (
                                        <MenuItem key={id} value={id} sx={cyberMenuItemSx}>
                                            {(mcPayload.metaById[id]?.displayName || id).toString()}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )
                    ) : null}

                    <CyberTooltip title="Centrar / reset zoom">
                        <IconButton size="small" onClick={resetCam} sx={{ color: UI_COLORS.textSecondary }}>
                            <RestartAltIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                    </CyberTooltip>
                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5 }}>
                        RUEDA · ZOOM · ARRASTRA
                    </CyberText>
                </Stack>
            </Stack>

            <Box
                ref={wheelWrapRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                sx={{
                    flex: 1,
                    minHeight: 280,
                    width: "100%",
                    position: "relative",
                    overflow: "hidden",
                    cursor: dragging ? "grabbing" : "grab",
                    bgcolor: "#050508",
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    touchAction: "none",
                    userSelect: "none",
                }}
            >
                {/*
                  Center with translate(-50%,-50%) — do NOT use numeric margin in MUI sx
                  (numbers are theme spacing units and fling the stage off-screen).
                */}
                <Box
                    sx={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: `${view}px`,
                        height: `${view}px`,
                        transform: `translate(calc(-50% + ${cam.x}px), calc(-50% + ${cam.y}px)) scale(${cam.z})`,
                        transformOrigin: "center center",
                        willChange: "transform",
                    }}
                >
                    <svg
                        width={view}
                        height={view}
                        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
                    >
                        {sectorLayouts.map((sec, idx) => {
                            const tint = idx % 3;
                            const activeFill = ["rgba(255,0,170,0.12)", "rgba(0,255,220,0.1)", "rgba(255,210,60,0.1)"][tint];
                            const idleFill = ["rgba(255,0,170,0.03)", "rgba(0,255,200,0.025)", "rgba(255,200,0,0.025)"][tint];
                            const span = sec.halfSpan ?? halfSpan;
                            if (span >= 179) {
                                return (
                                    <circle
                                        key={`disc-${sec.slotIndex}-${sec.classId || idx}`}
                                        cx={cx}
                                        cy={cy}
                                        r={rOut}
                                        fill={sec.isActive ? activeFill : idleFill}
                                        stroke={`${sec.accent}66`}
                                        strokeWidth={1.25}
                                    />
                                );
                            }
                            return (
                                <path
                                    key={`wedge-${sec.slotIndex}-${sec.classId || idx}`}
                                    d={wedgePath(sec.bis, span, cx, cy, rOut)}
                                    fill={sec.isActive ? activeFill : idleFill}
                                    stroke={sec.isActive ? sec.accent : "rgba(255,255,255,0.08)"}
                                    strokeWidth={sec.isActive ? 2 : 1}
                                />
                            );
                        })}
                        {guideMeta.radii.map((f, gi) => (
                            <circle
                                key={`orbit-g-${gi}`}
                                cx={cx}
                                cy={cy}
                                r={rOut * f}
                                fill="none"
                                stroke={
                                    gi === guideMeta.dashedGuideIndex
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(255,255,255,0.07)"
                                }
                                strokeWidth={1}
                                strokeDasharray={gi === guideMeta.dashedGuideIndex ? "4 6" : undefined}
                            />
                        ))}
                        {spokeDegs.map((deg) => {
                            const inner = polar(cx, cy, rOut * 0.08, deg);
                            const outer = polar(cx, cy, rOut, deg);
                            return (
                                <line
                                    key={`spoke-${deg}`}
                                    x1={inner.x}
                                    y1={inner.y}
                                    x2={outer.x}
                                    y2={outer.y}
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth={1}
                                />
                            );
                        })}
                        {sectorLayouts.flatMap((sec) => {
                            if (sec.empty || !sec.layout?.spine) return [];
                            // Spine ray clutters full-orbit view; keep only for multi-wedge
                            if (singleJob) return [];
                            const { bis, r0, r1, accent: spAccent } = sec.layout.spine;
                            const p0 = polar(cx, cy, r0, bis);
                            const p1 = polar(cx, cy, r1, bis);
                            return [
                                <line
                                    key={`spine-${sec.slotIndex}-${sec.classId}`}
                                    x1={p0.x}
                                    y1={p0.y}
                                    x2={p1.x}
                                    y2={p1.y}
                                    stroke={spAccent}
                                    strokeWidth={sec.isActive ? 4 : 3}
                                    strokeLinecap="round"
                                    opacity={sec.isActive ? 0.42 : 0.18}
                                />,
                            ];
                        })}
                        {sectorLayouts.flatMap((sec) =>
                            sec.empty || !sec.layout
                                ? []
                                : sec.layout.edges.map((e, j) => (
                                      <line
                                          key={`${sec.classId}-e-${j}`}
                                          x1={e.x1}
                                          y1={e.y1}
                                          x2={e.x2}
                                          y2={e.y2}
                                          stroke={e.accent}
                                          strokeWidth={e.dash ? 1.1 : 1.45}
                                          strokeDasharray={e.dash ? "6 5" : undefined}
                                          opacity={0.88}
                                      />
                                  )),
                        )}
                    </svg>

                    {/* Multi-job wedge labels only — singleJob uses toolbar chips (avoids center overlap) */}
                    {!singleJob &&
                        sectorLayouts.map((sec) => {
                            const lab = polar(cx, cy, rOut * 0.22, sec.bis);
                            return (
                                <Box
                                    key={`lab-${sec.slotIndex}-${sec.classId || "x"}`}
                                    sx={{
                                        position: "absolute",
                                        left: lab.x - 72,
                                        top: lab.y - 10,
                                        width: 144,
                                        textAlign: "center",
                                        pointerEvents: "none",
                                        zIndex: 2,
                                    }}
                                >
                                    <CyberText
                                        sx={{
                                            fontSize: "0.55rem",
                                            color: sec.isActive ? UI_COLORS.accent : "rgba(255,255,255,0.42)",
                                            letterSpacing: 1.2,
                                        }}
                                    >
                                        {sec.isActive ? "ACTIVA · " : ""}
                                        {sec.label}
                                    </CyberText>
                                    <CyberTitle
                                        sx={{
                                            fontSize: "0.62rem",
                                            color: sec.accent,
                                            mt: 0.25,
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {sec.displayName}
                                    </CyberTitle>
                                </Box>
                            );
                        })}

                    {sectorLayouts.map((sec) =>
                        sec.empty || !sec.layout
                            ? null
                            : [...sec.layout.items.values()].map(({ x, y, ability }) => (
                                  <SkillOrbitNode
                                      key={`${sec.classId}-${ability.key}`}
                                      ability={attachPos(ability, x, y)}
                                      isUnlocked={checkU(ability.key)}
                                      sectorGlow={sec.isActive}
                                      accent={sec.accent}
                                      onSelect={onSelectAbility}
                                      reducedMotion={reducedMotion}
                                  />
                              )),
                    )}
                </Box>

                {sectorLayouts.every((s) => s.empty) && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            pointerEvents: "none",
                            px: 2,
                        }}
                    >
                        <CyberText sx={{ fontSize: "0.8rem", color: UI_COLORS.textSecondary, textAlign: "center" }}>
                            Este job no tiene habilidades cargadas en Firestore.
                        </CyberText>
                    </Box>
                )}
            </Box>

            <TypeLegend />

            <AbilityDetailDialog open={Boolean(selected)} ability={selected} accent={dialogAccent} onClose={() => setSelected(null)} />
        </Box>
    );
}
