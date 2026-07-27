import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, IconButton, Tooltip } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";
import { getAbilitiesByIds } from "../../../../../firebase/services/characterService";
import { getAbilityKeysForClase, getClaseDocsByIds } from "../../../../../firebase/services/classService";
import { CyberText } from "../../../customs/CustomTexts";
import { UI_COLORS } from "../../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../../constants/cyberScrollStyle";
import { formatClassLabel } from "../../../../constants/characterSheetTokens";
import { resolveCharacterChapter } from "../../../../constants/skillTreeProgression";
import { archGlow } from "./orbitLayoutEngine";
import { isViewportCamera } from "./neuralMeshConfig";
import {
    buildNeuralMeshGraph,
    kindLabel,
    stateCode,
} from "./neuralMeshLayout";
import { createNeuralMeshScene } from "./neuralMeshScene";

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Scan Construct — JS frames (same as mock; not a CSS boolean flip). */
async function playScanConstruct(cardEl, beamEl, gridEl, signal, durationMs = 950) {
    if (!cardEl) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 220 : durationMs;

    cardEl.style.opacity = "0";
    cardEl.style.clipPath = "inset(50% 0 50% 0)";
    cardEl.style.webkitClipPath = "inset(50% 0 50% 0)";
    cardEl.style.filter = "brightness(2.2)";
    if (beamEl) {
        beamEl.style.top = "-42%";
        beamEl.style.opacity = "0";
    }
    if (gridEl) gridEl.style.opacity = "0";
    void cardEl.offsetWidth;

    const t0 = performance.now();
    await new Promise((resolve) => {
        const frame = (now) => {
            if (signal.cancelled) return resolve();
            const t = Math.min(1, (now - t0) / duration);
            const u = easeInOut(t);
            const inset = 50 * (1 - u);
            const clip = `inset(${inset}% 0 ${inset}% 0)`;
            cardEl.style.clipPath = clip;
            cardEl.style.webkitClipPath = clip;
            cardEl.style.opacity = String(Math.min(1, t * 2.2));
            cardEl.style.filter = `brightness(${(2.2 - 1.2 * u).toFixed(3)})`;
            if (beamEl) {
                beamEl.style.top = `${(-42 + 152 * u).toFixed(2)}%`;
                const bOp = t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 0.95;
                beamEl.style.opacity = String(Math.max(0, Math.min(1, bOp)));
            }
            if (gridEl) {
                gridEl.style.opacity = String(t < 0.7 ? 0.5 * (1 - t * 0.4) : Math.max(0, 0.35 * (1 - t) * 2));
            }
            if (t < 1) requestAnimationFrame(frame);
            else {
                cardEl.style.opacity = "1";
                cardEl.style.clipPath = "inset(0 0 0 0)";
                cardEl.style.webkitClipPath = "inset(0 0 0 0)";
                cardEl.style.filter = "brightness(1)";
                if (beamEl) beamEl.style.opacity = "0";
                if (gridEl) gridEl.style.opacity = "0";
                resolve();
            }
        };
        requestAnimationFrame(frame);
    });
}

async function typeCodeStream(container, lines, signal) {
    if (!container) return;
    container.innerHTML = "";
    const caret = document.createElement("span");
    caret.className = "nm-code-caret";

    for (const line of lines) {
        if (signal.cancelled) return;
        const row = document.createElement("div");
        row.className = "nm-code-line";
        const px = document.createElement("span");
        px.className = "nm-px";
        px.textContent = "›";
        const body = document.createElement("span");
        if (line.cls) body.className = `nm-${line.cls}`;
        row.appendChild(px);
        row.appendChild(body);
        row.appendChild(caret);
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;

        const full = line.text || "";
        if (line.instant) {
            body.textContent = full;
            await wait(24);
            continue;
        }
        for (let i = 1; i <= full.length; i++) {
            if (signal.cancelled) return;
            body.textContent = full.slice(0, i);
            container.scrollTop = container.scrollHeight;
            const ch = full[i - 1];
            await wait(ch === " " ? 5 : ch === "." || ch === "," ? 22 : 9 + Math.random() * 12);
        }
        caret.remove();
        await wait(28);
    }
    if (!signal.cancelled) {
        const end = document.createElement("div");
        end.className = "nm-code-line";
        end.innerHTML = `<span class="nm-px">›</span><span class="nm-cmt">_</span>`;
        end.appendChild(caret);
        container.appendChild(end);
    }
}

function abilityBlurb(data) {
    return (
        data?.content ||
        data?.description ||
        data?.text ||
        data?.blurb ||
        data?.summary ||
        "Sin descripción."
    );
}

/**
 * Neural Mesh skill tree — Pixi graph + HTML Scan Construct dossier.
 * Replaces prior CP2077 / orbit layouts for CharTreeTab.
 */
export default function SkillMatrixNeuralMesh({ character, compactChrome = true }) {
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
    const [dossier, setDossier] = useState(null);
    const [actionsReady, setActionsReady] = useState(false);
    const [rebuilding, setRebuilding] = useState(false);
    const [dossierReady, setDossierReady] = useState(false);

    const stageRef = useRef(null);
    const sceneRef = useRef(null);
    const sizeRef = useRef({ w: 800, h: 560 });
    const signalRef = useRef({ cancelled: false });
    const clickGenRef = useRef(0);
    const dossierCardRef = useRef(null);
    const dossierBeamRef = useRef(null);
    const dossierGridRef = useRef(null);
    const dossierCodeRef = useRef(null);
    const umbilicalRef = useRef(null);
    const dossierRef = useRef(null);
    const dossierWrapRef = useRef(null);
    const cameraRafRef = useRef(0);
    const [sceneReady, setSceneReady] = useState(false);
    const useViewport = isViewportCamera();

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
    }, [character?.id, assignedKey, classIds, character?.allAbilities, character?.unlockedAbilities]);

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
    const classAccent = archGlow(jobMeta?.classArchetype);

    const removeUmbilical = useCallback((immediate = true) => {
        if (!umbilicalRef.current) return;
        const u = umbilicalRef.current;
        umbilicalRef.current = null;
        if (immediate) {
            u.remove();
            return;
        }
        u.classList.remove("on");
        u.classList.add("off");
        setTimeout(() => u.remove(), 280);
    }, []);

    const closeDossier = useCallback(
        (opts = {}) => {
            const { keepSelection = false } = opts;
            signalRef.current.cancelled = true;
            dossierRef.current = null;
            setDossier(null);
            setActionsReady(false);
            setDossierReady(false);
            if (!keepSelection) sceneRef.current?.deselect();
            removeUmbilical(true);
        },
        [removeUmbilical]
    );

    const placeDossierCard = useCallback((nodeScreen, stageEl) => {
        const rect = stageEl.getBoundingClientRect();
        const cardW = Math.min(300, rect.width * 0.42);
        const cardH = Math.min(340, rect.height * 0.52);
        let fx = nodeScreen.x + 28;
        let fy = nodeScreen.y - cardH * 0.35;
        if (fx + cardW > rect.width - 10) fx = nodeScreen.x - cardW - 28;
        if (fx < 10) fx = 10;
        if (fy < 10) fy = 10;
        if (fy + cardH > rect.height - 10) fy = rect.height - cardH - 10;
        return { fx, fy, cardW, cardH, sx: nodeScreen.x, sy: nodeScreen.y };
    }, []);

    const layoutUmbilical = useCallback((sx, sy, fx, fy, cardW, cardH) => {
        const u = umbilicalRef.current;
        const stage = stageRef.current;
        if (!u || !stage) return;
        const cx = fx + cardW / 2;
        const cy = fy + Math.min(40, cardH * 0.15);
        const dx = cx - sx;
        const dy = cy - sy;
        const len = Math.hypot(dx, dy);
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        u.style.left = `${sx}px`;
        u.style.top = `${sy}px`;
        u.style.width = `${Math.max(8, len)}px`;
        u.style.setProperty("--ang", `${ang}deg`);
    }, []);

    const syncDossierToCamera = useCallback(() => {
        const d = dossierRef.current;
        const scene = sceneRef.current;
        const stage = stageRef.current;
        if (!d?.node || !scene || !stage) return;
        const screen = scene.worldToScreen?.(d.wx ?? d.node.x, d.wy ?? d.node.y) || {
            x: d.node.x,
            y: d.node.y,
        };
        const placed = placeDossierCard(screen, stage);
        dossierRef.current = { ...d, ...placed };
        const wrap = dossierWrapRef.current;
        if (wrap) {
            wrap.style.left = `${placed.fx}px`;
            wrap.style.top = `${placed.fy}px`;
            wrap.style.width = `${placed.cardW}px`;
            wrap.style.height = `${placed.cardH}px`;
        }
        layoutUmbilical(placed.sx, placed.sy, placed.fx, placed.fy, placed.cardW, placed.cardH);
    }, [layoutUmbilical, placeDossierCard]);

    const openDossier = useCallback(async (node, fromStage, clickGen) => {
        signalRef.current = { cancelled: false };
        const signal = signalRef.current;
        setActionsReady(false);
        setDossierReady(false);

        const stage = stageRef.current;
        if (!stage) return;
        const placed = placeDossierCard(fromStage, stage);
        const { fx, fy, cardW, cardH, sx, sy } = placed;

        const payload = {
            node,
            fx,
            fy,
            cardW,
            cardH,
            sx,
            sy,
            wx: node.x,
            wy: node.y,
        };
        dossierRef.current = payload;
        setDossier(payload);

        await wait(40);
        if (signal.cancelled || clickGen !== clickGenRef.current) return;

        removeUmbilical(true);
        const u = document.createElement("div");
        u.className = "nm-umbilical";
        stage.appendChild(u);
        umbilicalRef.current = u;
        layoutUmbilical(sx, sy, fx, fy, cardW, cardH);
        requestAnimationFrame(() => {
            if (umbilicalRef.current === u) u.classList.add("on");
        });

        await wait(240);
        if (signal.cancelled || clickGen !== clickGenRef.current) return;

        await playScanConstruct(
            dossierCardRef.current,
            dossierBeamRef.current,
            dossierGridRef.current,
            signal,
            950
        );
        if (signal.cancelled || clickGen !== clickGenRef.current) return;
        setDossierReady(true);

        const st = stateCode(node.state);
        const lines = [
            { cls: "cmt", text: "// decrypting node payload…", instant: true },
            { cls: "kw", text: `type: ${kindLabel(node.kind)}` },
            { cls: "str", text: `id: "${node.key || node.id}"` },
            { cls: "str", text: `label: "${node.fullLabel || node.label}"` },
            { cls: st.cls, text: `state: ${st.text}` },
            ...(node.kind === "limitbreak" || node.kind === "ultimate"
                ? [{ cls: "warn", text: "flag: ACTO_3 | LIMIT_BREAK" }]
                : []),
            ...(node.kind === "talent"
                ? [{ cls: "cmt", text: `// exclusive talent · parent=${node.data?.parentAbility || "—"}` }]
                : []),
            { cls: "cmt", text: "// ---- description ----", instant: true },
            { text: String(abilityBlurb(node.data)) },
            { cls: "ok", text: "surface_ready = true" },
        ];
        await typeCodeStream(dossierCodeRef.current, lines, signal);
        if (!signal.cancelled && clickGen === clickGenRef.current) setActionsReady(true);
    }, [removeUmbilical, placeDossierCard, layoutUmbilical]);

    const onNodeClick = useCallback(
        async (node) => {
            if (rebuilding || loading) return;
            const clickGen = ++clickGenRef.current;
            // Cancel prior dossier + in-flight trail without leaving FX stuck
            signalRef.current.cancelled = true;
            dossierRef.current = null;
            setDossier(null);
            setActionsReady(false);
            setDossierReady(false);
            removeUmbilical(true);

            await wait(16);
            if (clickGen !== clickGenRef.current) return;
            const scene = sceneRef.current;
            if (!scene) return;
            await scene.selectNode(node.id);
            if (clickGen !== clickGenRef.current) return;
            const screen = scene.worldToScreen?.(node.x, node.y) || { x: node.x, y: node.y };
            openDossier(node, screen, clickGen);
        },
        [rebuilding, loading, openDossier, removeUmbilical]
    );

    const onNodeClickRef = useRef(onNodeClick);
    onNodeClickRef.current = onNodeClick;

    const onCameraChangeRef = useRef(() => {});
    onCameraChangeRef.current = () => {
        if (!dossierRef.current) return;
        if (cameraRafRef.current) return;
        cameraRafRef.current = requestAnimationFrame(() => {
            cameraRafRef.current = 0;
            syncDossierToCamera();
        });
    };

    // Init Pixi scene once
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return undefined;
        let cancelled = false;
        const scene = createNeuralMeshScene(el, {
            onNodeClick: (n) => {
                onNodeClickRef.current?.(n);
            },
            onCameraChange: () => {
                onCameraChangeRef.current?.();
            },
        });
        sceneRef.current = scene;
        setSceneReady(false);
        scene.init().then(() => {
            if (cancelled) {
                scene.destroy();
                return;
            }
            setSceneReady(true);
        });
        return () => {
            cancelled = true;
            setSceneReady(false);
            scene.destroy();
            sceneRef.current = null;
        };
    }, []);

    // Rebuild graph when job/data ready (viewport: world size is fixed; fixed: uses stage size)
    useEffect(() => {
        if (loading || !sceneReady || !sceneRef.current || !stageRef.current) return;
        const el = stageRef.current;
        const w = el.clientWidth || 800;
        const h = el.clientHeight || 560;
        sizeRef.current = { w, h };
        const graph = buildNeuralMeshGraph({
            abilities: jobAbilities,
            unlockedKeys: character?.unlockedAbilities || [],
            chapter,
            jobLabel,
            classAccent,
            width: w,
            height: h,
        });
        closeDossier();
        sceneRef.current.setGraph(graph, { animate: true });
    }, [loading, sceneReady, jobAbilities, character?.unlockedAbilities, chapter, jobLabel, classAccent, focusIdx, closeDossier]);

    // Resize: viewport → sync camera screen only; fixed → rebuild elliptical fit
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(() => {
            if (!sceneRef.current || !sceneReady || loading) return;
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (Math.abs(w - sizeRef.current.w) < 8 && Math.abs(h - sizeRef.current.h) < 8) return;
            sizeRef.current = { w, h };
            if (useViewport) {
                sceneRef.current.syncScreen?.();
                sceneRef.current.fitGraph?.({ animate: false });
                if (dossierRef.current) syncDossierToCamera();
                return;
            }
            const graph = buildNeuralMeshGraph({
                abilities: jobAbilities,
                unlockedKeys: character?.unlockedAbilities || [],
                chapter,
                jobLabel,
                classAccent,
                width: w,
                height: h,
            });
            sceneRef.current.setGraph(graph, { animate: false });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [
        loading,
        sceneReady,
        jobAbilities,
        character?.unlockedAbilities,
        chapter,
        jobLabel,
        classAccent,
        useViewport,
        syncDossierToCamera,
    ]);

    const ep = character?.ap ?? character?.abilityPoints ?? character?.stats?.ap ?? "—";
    const canSwitch = classIds.length > 1;

    const switchJob = useCallback(
        async (nextIdx) => {
            if (rebuilding || loading || nextIdx === focusIdx) return;
            const clickGen = ++clickGenRef.current;
            signalRef.current.cancelled = true;
            setDossier(null);
            setActionsReady(false);
            setDossierReady(false);
            removeUmbilical(true);
            sceneRef.current?.deselect();
            setRebuilding(true);
            await wait(380);
            if (clickGen !== clickGenRef.current) {
                setRebuilding(false);
                return;
            }
            setFocusIdx(nextIdx);
            await wait(720);
            if (clickGen === clickGenRef.current) setRebuilding(false);
        },
        [rebuilding, loading, focusIdx, removeUmbilical]
    );

    const jobMetaList = useMemo(() => {
        if (!jobPayload || jobPayload.mode !== "multiclass") return [];
        return classIds.map((cid, i) => {
            const meta = jobPayload.metaById?.[cid];
            const label =
                (meta?.displayName && String(meta.displayName).toUpperCase()) ||
                formatClassLabel(cid, "") ||
                `JOB ${i + 1}`;
            return { id: cid, label, accent: archGlow(meta?.classArchetype) };
        });
    }, [jobPayload, classIds]);

    const jobSwitcher = (
        <Box
            className="dialog-no-drag"
            sx={
                compactChrome
                    ? {
                          position: "absolute",
                          top: 10,
                          left: "50%",
                          transform: "translateX(-50%)",
                          zIndex: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 0.75,
                          px: 1,
                          py: 0.45,
                          borderRadius: 1,
                          bgcolor: "rgba(10, 10, 20, 0.82)",
                          backdropFilter: "blur(12px)",
                          border: `1px solid ${UI_COLORS.border}`,
                          boxShadow: "0 2px 14px rgba(0,0,0,0.45)",
                          pointerEvents: "auto",
                          maxWidth: "92%",
                      }
                    : {
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                          px: 1.5,
                          py: 0.7,
                          borderBottom: `1px solid ${UI_COLORS.border}`,
                          bgcolor: UI_COLORS.backgroundSecondary,
                      }
            }
        >
            {canSwitch && (
                <IconButton
                    size="small"
                    disabled={rebuilding}
                    onClick={() => switchJob((focusIdx - 1 + classIds.length) % classIds.length)}
                    sx={{ color: UI_COLORS.anomaly, p: 0.3 }}
                    aria-label="Job anterior"
                >
                    <ChevronLeftIcon fontSize="small" />
                </IconButton>
            )}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4, minWidth: 0 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "center", maxWidth: 420 }}>
                    {(jobMetaList.length ? jobMetaList : [{ id: "job", label: jobLabel, accent: classAccent }]).map(
                        (j, i) => {
                            const on = i === focusIdx;
                            return (
                                <Box
                                    key={j.id}
                                    component="button"
                                    type="button"
                                    disabled={rebuilding}
                                    onClick={() => switchJob(i)}
                                    sx={{
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.48rem",
                                        letterSpacing: "0.1em",
                                        px: 1.1,
                                        py: 0.55,
                                        borderRadius: 999,
                                        border: `1px solid ${on ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                        color: on ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                        bgcolor: on ? "rgba(0,242,234,0.1)" : "rgba(0,0,0,0.35)",
                                        boxShadow: on ? `0 0 14px ${UI_COLORS.anomaly}66` : "none",
                                        cursor: rebuilding ? "wait" : "pointer",
                                        whiteSpace: "nowrap",
                                        maxWidth: 160,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        opacity: rebuilding && !on ? 0.45 : 1,
                                        "&:hover": {
                                            borderColor: on ? UI_COLORS.anomaly : UI_COLORS.accent,
                                            color: UI_COLORS.textPrimary,
                                        },
                                    }}
                                >
                                    {j.label}
                                </Box>
                            );
                        }
                    )}
                </Box>
                <CyberText sx={{ fontSize: "0.45rem", color: UI_COLORS.textSecondary, letterSpacing: "0.06em" }}>
                    {rebuilding ? "REBUILDING_NEURAL_GRAPH…" : `${focusIdx === 0 ? "PRIMARY" : `JOB ${focusIdx + 1}`} · EP ${ep}`}
                </CyberText>
            </Box>
            {canSwitch && (
                <IconButton
                    size="small"
                    disabled={rebuilding}
                    onClick={() => switchJob((focusIdx + 1) % classIds.length)}
                    sx={{ color: UI_COLORS.anomaly, p: 0.3 }}
                    aria-label="Job siguiente"
                >
                    <ChevronRightIcon fontSize="small" />
                </IconButton>
            )}
        </Box>
    );

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                bgcolor: "#07070e",
                position: "relative",
            }}
        >
            <style>{`
                .nm-umbilical {
                    position: absolute; z-index: 20; pointer-events: none; height: 2.5px;
                    transform-origin: left center; transform: rotate(var(--ang, 0deg)) scaleX(0);
                    background: linear-gradient(90deg, ${UI_COLORS.anomaly}, ${UI_COLORS.accent}, transparent);
                    box-shadow: 0 0 10px ${UI_COLORS.accentGlow}, 0 0 12px rgba(0,242,234,0.45);
                    opacity: 0; border-radius: 2px;
                }
                .nm-umbilical.on { animation: nm-umb 0.65s cubic-bezier(0.2,0.85,0.25,1) forwards; }
                .nm-umbilical.off { animation: nm-umb-off 0.28s ease forwards; }
                @keyframes nm-umb {
                    0% { opacity: 0; transform: rotate(var(--ang,0deg)) scaleX(0); }
                    25% { opacity: 1; }
                    100% { opacity: 0.85; transform: rotate(var(--ang,0deg)) scaleX(1); }
                }
                @keyframes nm-umb-off {
                    to { opacity: 0; transform: rotate(var(--ang,0deg)) scaleX(0.2); }
                }
                .nm-stage.rebuilding::after {
                    content: "";
                    position: absolute; inset: 0; z-index: 25; pointer-events: none;
                    background: linear-gradient(
                        105deg,
                        transparent 0%,
                        rgba(0,242,234,0.08) 45%,
                        rgba(255,102,255,0.12) 50%,
                        transparent 55%
                    );
                    background-size: 220% 100%;
                    animation: nm-rebuild-scan 0.85s ease-in-out;
                }
                @keyframes nm-rebuild-scan {
                    from { background-position: 120% 0; opacity: 0; }
                    20% { opacity: 1; }
                    to { background-position: -40% 0; opacity: 0; }
                }
                .nm-code-line { white-space: pre-wrap; word-break: break-word; min-height: 1.15em; }
                .nm-px { color: rgba(0,242,234,0.45); margin-right: 6px; }
                .nm-kw { color: ${UI_COLORS.accent}; }
                .nm-str { color: ${UI_COLORS.anomaly}; }
                .nm-cmt { color: rgba(170,170,170,0.65); }
                .nm-ok { color: #7dd3fc; }
                .nm-warn { color: #ffcc33; }
                .nm-code-caret {
                    display: inline-block; width: 0.55ch; height: 1em; margin-left: 1px;
                    background: ${UI_COLORS.anomaly}; box-shadow: 0 0 6px rgba(0,242,234,0.55);
                    vertical-align: text-bottom; animation: nm-caret 0.7s steps(1) infinite;
                }
                @keyframes nm-caret { 50% { opacity: 0; } }
            `}</style>

            {!compactChrome && jobSwitcher}

            {/* Stage — full bleed when compactChrome */}
            <Box
                ref={stageRef}
                className={`nm-stage${rebuilding ? " rebuilding" : ""}`}
                onClick={(e) => {
                    if (e.target === stageRef.current || e.target?.tagName === "CANVAS") closeDossier();
                }}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    position: "relative",
                    overflow: "hidden",
                    background: `
                        radial-gradient(ellipse 70% 45% at 15% 10%, rgba(255,102,255,0.12), transparent 55%),
                        radial-gradient(ellipse 55% 40% at 90% 90%, rgba(0,242,234,0.08), transparent 50%),
                        radial-gradient(circle at 50% 48%, rgba(255,102,255,0.05), transparent 42%),
                        #07070e
                    `,
                }}
            >
                {compactChrome && jobSwitcher}
                {useViewport && (
                    <Tooltip title="Recentrar órbita" placement="left">
                        <IconButton
                            className="dialog-no-drag"
                            size="small"
                            aria-label="Recentrar mesh"
                            onClick={(e) => {
                                e.stopPropagation();
                                sceneRef.current?.recenter?.({ animate: true });
                            }}
                            sx={{
                                position: "absolute",
                                right: 10,
                                bottom: 12,
                                zIndex: 18,
                                color: UI_COLORS.anomaly,
                                bgcolor: "rgba(10,10,20,0.82)",
                                border: `1px solid ${UI_COLORS.border}`,
                                boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
                                "&:hover": {
                                    borderColor: UI_COLORS.anomaly,
                                    bgcolor: "rgba(0,242,234,0.12)",
                                },
                            }}
                        >
                            <FilterCenterFocusIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                {loading && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(10,10,18,0.72)",
                        }}
                    >
                        <CircularProgress size={28} sx={{ color: UI_COLORS.anomaly }} />
                    </Box>
                )}
                {dossier && (
                    <Box
                        ref={dossierWrapRef}
                        sx={{
                            position: "absolute",
                            left: dossier.fx,
                            top: dossier.fy,
                            width: dossier.cardW,
                            height: dossier.cardH,
                            zIndex: 30,
                            borderRadius: 1,
                            overflow: "hidden",
                            pointerEvents: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Box
                            ref={dossierCardRef}
                            sx={{
                                width: "100%",
                                height: "100%",
                                border: `1px solid rgba(0,242,234,0.5)`,
                                borderRadius: 1,
                                background: "linear-gradient(165deg, rgba(10,14,24,0.97), rgba(6,6,12,0.98))",
                                boxShadow: `
                                    0 0 0 1px rgba(0,242,234,0.3),
                                    0 0 22px rgba(0,242,234,0.16),
                                    0 0 40px ${UI_COLORS.accentGlow},
                                    inset 0 0 40px rgba(0,242,234,0.03)
                                `,
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                opacity: 0,
                                clipPath: "inset(50% 0 50% 0)",
                                position: "relative",
                            }}
                        >
                            {/* HUD corner brackets — appear when Scan Construct finishes */}
                            {[
                                { t: 4, l: 4, bw: "2px 0 0 2px" },
                                { t: 4, r: 4, bw: "2px 2px 0 0" },
                                { b: 4, l: 4, bw: "0 0 2px 2px" },
                                { b: 4, r: 4, bw: "0 2px 2px 0" },
                            ].map((c, i) => (
                                <Box
                                    key={i}
                                    aria-hidden
                                    sx={{
                                        position: "absolute",
                                        width: 14,
                                        height: 14,
                                        top: c.t,
                                        left: c.l,
                                        right: c.r,
                                        bottom: c.b,
                                        borderColor: UI_COLORS.anomaly,
                                        borderStyle: "solid",
                                        borderWidth: c.bw,
                                        zIndex: 3,
                                        pointerEvents: "none",
                                        opacity: dossierReady ? 0.9 : 0,
                                        transform: dossierReady ? "scale(1)" : "scale(1.25)",
                                        filter: "drop-shadow(0 0 4px rgba(0,242,234,0.55))",
                                        transition: `opacity 0.35s ease ${0.05 + i * 0.07}s, transform 0.35s ease ${0.05 + i * 0.07}s`,
                                    }}
                                />
                            ))}
                            <Box
                                ref={dossierGridRef}
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    zIndex: 2,
                                    pointerEvents: "none",
                                    opacity: 0,
                                    background: `
                                        repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(0,242,234,0.06) 8px),
                                        repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(255,102,255,0.04) 8px)
                                    `,
                                }}
                            />
                            <Box
                                ref={dossierBeamRef}
                                sx={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    top: "-42%",
                                    height: "42%",
                                    zIndex: 2,
                                    pointerEvents: "none",
                                    opacity: 0,
                                    background: `linear-gradient(180deg, transparent, rgba(0,242,234,0.18), rgba(255,102,255,0.25), transparent)`,
                                }}
                            />
                            <Box
                                sx={{
                                    position: "relative",
                                    zIndex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    height: "100%",
                                    minHeight: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        px: 1.25,
                                        py: 0.75,
                                        borderBottom: `1px solid ${UI_COLORS.anomaly}30`,
                                        background: `linear-gradient(90deg, ${UI_COLORS.anomaly}12, transparent 70%)`,
                                        flexShrink: 0,
                                    }}
                                >
                                    <CyberText
                                        sx={{
                                            fontFamily: "'Fira Code', monospace",
                                            fontSize: "0.5rem",
                                            letterSpacing: "0.1em",
                                            color: UI_COLORS.anomaly,
                                        }}
                                    >
                                        SCAN_CONSTRUCT // NODE_SURFACE
                                    </CyberText>
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={closeDossier}
                                        aria-label="Cerrar"
                                        sx={{
                                            width: 26,
                                            height: 26,
                                            border: `1px solid ${UI_COLORS.border}`,
                                            borderRadius: 0.5,
                                            bgcolor: "transparent",
                                            color: UI_COLORS.accent,
                                            cursor: "pointer",
                                            fontSize: "0.9rem",
                                            lineHeight: 1,
                                            "&:hover": { borderColor: UI_COLORS.accent, bgcolor: "rgba(255,102,255,0.12)" },
                                        }}
                                    >
                                        ✕
                                    </Box>
                                </Box>
                                <Box
                                    ref={dossierCodeRef}
                                    sx={{
                                        flex: 1,
                                        minHeight: 0,
                                        overflowY: "auto",
                                        px: 1.5,
                                        py: 1.25,
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.62rem",
                                        lineHeight: 1.55,
                                        color: UI_COLORS.textSecondary,
                                        ...CYBER_SCROLL_STYLE,
                                    }}
                                />
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 0.75,
                                        px: 1.5,
                                        pb: 1.25,
                                        opacity: actionsReady ? 1 : 0,
                                        transition: "opacity 0.3s ease",
                                        pointerEvents: actionsReady ? "auto" : "none",
                                    }}
                                >
                                    <Box
                                        component="button"
                                        type="button"
                                        sx={{
                                            fontFamily: "Orbitron, sans-serif",
                                            fontSize: "0.5rem",
                                            letterSpacing: "0.08em",
                                            px: 1.25,
                                            py: 0.75,
                                            borderRadius: 0.5,
                                            border: `1px solid ${UI_COLORS.accent}`,
                                            bgcolor: "rgba(255,102,255,0.12)",
                                            color: UI_COLORS.textPrimary,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {dossier.node.state === "unlocked"
                                            ? "YA OBTENIDO"
                                            : dossier.node.state === "locked" || dossier.node.state === "xor-out"
                                              ? "BLOQUEADO"
                                              : "GASTAR 1 EP"}
                                    </Box>
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={closeDossier}
                                        sx={{
                                            fontFamily: "Orbitron, sans-serif",
                                            fontSize: "0.5rem",
                                            letterSpacing: "0.08em",
                                            px: 1.25,
                                            py: 0.75,
                                            borderRadius: 0.5,
                                            border: `1px solid ${UI_COLORS.border}`,
                                            bgcolor: "transparent",
                                            color: UI_COLORS.textSecondary,
                                            cursor: "pointer",
                                        }}
                                    >
                                        CERRAR
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
