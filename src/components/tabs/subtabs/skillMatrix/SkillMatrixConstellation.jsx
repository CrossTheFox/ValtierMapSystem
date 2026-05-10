import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
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
import { CyberTitle, CyberText } from "../../../customs/CustomTexts";
import { UI_COLORS } from "../../../../constants/uiColors";
import { archGlow, LB_MASTERY_OFFSET_DEG, normalizeDeg, polar, wedgePath } from "./orbitLayoutEngine";
import { useOrbitMatrixData } from "./useOrbitMatrixData";

const TYPE_META = {
    class_root: { label: "Clase", Icon: WorkspacePremiumIcon, hint: "Job / núcleo del árbol." },
    trait: { label: "Trait", Icon: AutoAwesomeIcon, hint: "Pasivo de progresión." },
    ability: { label: "Habilidad", Icon: FlashOnIcon, hint: "Acción activa." },
    upgrade: { label: "Mejora", Icon: AddCircleOutlineIcon, hint: "Rama de mejora sobre la habilidad." },
    mastery: { label: "Mastery", Icon: MilitaryTechIcon, hint: "Maestría vinculada al padre." },
    ultimate: { label: "Limit Break", Icon: WhatshotIcon, hint: "Ulti / super del job." },
};

function SkillOrbitNode({ ability, isUnlocked, accent, onSelect, reducedMotion, sectorGlow }) {
    const t = ability?.type || "";
    const meta = TYPE_META[t] || { label: t || "Nodo", Icon: FlashOnIcon, hint: "" };
    const Icon = meta.Icon;
    const hot = Boolean(isUnlocked && sectorGlow);
    const dim = t === "class_root" ? 44 : t === "ultimate" ? 46 : t === "ability" ? 38 : t === "trait" ? 34 : 30;
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
                    zIndex: 4,
                    "&:hover": {
                        transform: reducedMotion ? "none" : "scale(1.08)",
                        zIndex: 10,
                        color: col,
                        boxShadow: `0 0 22px ${col}66`,
                    },
                    "&:focus-visible": { outline: `2px solid ${UI_COLORS.accent}`, outlineOffset: 2 },
                }}
            >
                <Icon sx={{ fontSize: t === "class_root" || t === "ultimate" ? 26 : 22 }} />
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
            <Stack direction="row" spacing={0.75} alignItems="center" key={key}>
                <I sx={{ fontSize: 16, color: UI_COLORS.anomaly, opacity: 0.9 }} />
                <CyberText sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.55)" }}>{m.label}</CyberText>
            </Stack>
        );
    };
    return (
        <Stack direction="row" flexWrap="wrap" spacing={2} useFlexGap sx={{ gap: 1.5, justifyContent: "center", mt: 1.5 }}>
            {row("class_root")}
            {row("trait")}
            {row("ability")}
            {row("upgrade")}
            {row("mastery")}
            {row("ultimate")}
        </Stack>
    );
}

export default function SkillMatrixConstellation({ character, fillAvailable }) {
    const [selected, setSelected] = useState(/** @type {Record<string, unknown>|null} */ (null));
    const [viewPx, setViewPx] = useState(1020);
    const wheelWrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
    const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

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
    } = useOrbitMatrixData(character, viewPx);

    const onSelectAbility = useCallback((a) => setSelected(a), []);

    useLayoutEffect(() => {
        const el = wheelWrapRef.current;
        if (!el) return;
        const measure = () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            const side = Math.max(440, Math.min(1280, Math.min(w, h || w)));
            setViewPx(side);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    if (loading) return <CircularProgress sx={{ display: "block", m: "auto", color: UI_COLORS.accent }} />;

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
    const spokeDegs = (bases || []).map((b) => normalizeDeg(b));

    return (
        <Box sx={{ py: 1, width: "100%", display: "flex", flexDirection: "column", overflow: "visible" }}>
            <Stack direction="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1, pr: 0.5 }}>
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly, letterSpacing: 2 }}>
                    // ÓRBITA — {jobCount === 1 ? "1 job (semicírculo)" : jobCount === 2 ? "2 jobs (mitades)" : "3 jobs"} · gajo activo resaltado
                </CyberText>
                {mode === "multiclass" && ids.length > 1 && mcPayload?.metaById ? (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel id="orbit-active-job" sx={{ color: "rgba(255,255,255,0.6)" }}>
                            Job activo
                        </InputLabel>
                        <Select
                            labelId="orbit-active-job"
                            label="Job activo"
                            value={activeClassId || ""}
                            onChange={(e) => onActiveJobSelect(e.target.value)}
                            sx={{
                                color: "#fff",
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.accent },
                            }}
                        >
                            {ids.map((id) => (
                                <MenuItem key={id} value={id}>
                                    {(mcPayload.metaById[id]?.displayName || id).toString()}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : null}
            </Stack>

            <Box
                ref={wheelWrapRef}
                sx={{
                    width: "100%",
                    minHeight: fillAvailable ? { xs: "52vh", sm: "56vh" } : 360,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                    py: 1,
                }}
            >
                <Box
                    sx={{
                        position: "relative",
                        width: "100%",
                        minHeight: { xs: "min(52vh, 720px)", sm: "min(58vh, 900px)" },
                        maxWidth: 1280,
                        mx: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                        bgcolor: "rgba(0,0,0,0.36)",
                        border: `1px solid ${UI_COLORS.border}`,
                    }}
                >
                    <Box sx={{ position: "relative", width: view, height: view, maxWidth: "100%", flexShrink: 0 }}>
                        <svg width={view} height={view} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
                            {sectorLayouts.map((sec, idx) => {
                                const tint = idx % 3;
                                const activeFill = ["rgba(255,0,170,0.26)", "rgba(0,255,220,0.22)", "rgba(255,210,60,0.24)"][tint];
                                const idleFill = ["rgba(255,0,170,0.04)", "rgba(0,255,200,0.032)", "rgba(255,200,0,0.032)"][tint];
                                return (
                                <path
                                    key={`wedge-${sec.slotIndex}-${sec.classId || idx}`}
                                    d={wedgePath(sec.bis, sec.halfSpan ?? halfSpan, cx, cy, rOut)}
                                    fill={sec.isActive ? activeFill : idleFill}
                                    stroke={sec.isActive ? sec.accent : "rgba(255,255,255,0.08)"}
                                    strokeWidth={sec.isActive ? 2.25 : 1}
                                    opacity={1}
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
                                        gi === guideMeta.dashedGuideIndex ? "rgba(255,255,255,0.028)" : "rgba(255,255,255,0.045)"
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
                                      ))
                            )}
                        </svg>

                        {sectorLayouts.map((sec) => {
                            const lab = polar(cx, cy, rOut * 0.1 + 14, sec.bis);
                            return (
                                <Box key={`lab-${sec.slotIndex}-${sec.classId || "x"}`}>
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            left: lab.x - 88,
                                            top: lab.y - 8,
                                            width: 176,
                                            textAlign: "center",
                                            pointerEvents: "none",
                                        }}
                                    >
                                        <CyberText
                                            sx={{
                                                fontSize: "0.58rem",
                                                color: sec.isActive ? UI_COLORS.accent : "rgba(255,255,255,0.42)",
                                                letterSpacing: 1.2,
                                            }}
                                        >
                                            {sec.isActive ? "ACTIVA · " : ""}
                                            {sec.label}
                                        </CyberText>
                                        {!sec.empty ? (
                                            <CyberTitle
                                                sx={{
                                                    fontSize: "0.66rem",
                                                    color: sec.accent,
                                                    mt: 0.35,
                                                    lineHeight: 1.2,
                                                    ...(sec.isActive
                                                        ? { textShadow: `0 0 14px ${sec.accent}88`, filter: "brightness(1.15)" }
                                                        : {}),
                                                }}
                                            >
                                                {sec.displayName}
                                            </CyberTitle>
                                        ) : (
                                            <CyberText sx={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.28)", mt: 0.35 }}>—</CyberText>
                                        )}
                                    </Box>
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
                                  ))
                        )}
                    </Box>
                </Box>
            </Box>

            <TypeLegend />

            <Stack direction="row" justifyContent="center" sx={{ mt: 1, flexShrink: 0 }}>
                <CyberText sx={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.42)", textAlign: "center", maxWidth: 640 }}>
                    {`Clase → traits → habilidades → mejoras → masteries → LB+mastery (+${LB_MASTERY_OFFSET_DEG}°). `}
                    Solo el job activo muestra desbloqueos “encendidos”. Líneas discontinuas: prerequisitos; cian: desbloquea.
                </CyberText>
            </Stack>

            <AbilityDetailDialog open={Boolean(selected)} ability={selected} accent={dialogAccent} onClose={() => setSelected(null)} />
        </Box>
    );
}
