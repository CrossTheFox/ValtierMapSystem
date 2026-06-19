/**
 * WikiGraphCanvas.jsx
 *
 * Self-contained Pixi.js canvas that renders the entity relation graph.
 * Uses pixi-viewport for pan/zoom (same library as the main map).
 *
 * Props:
 *   entities          — wikiEntity[] (all visible for current role)
 *   relations         — wikiRelation[] (all campaign relations)
 *   selectedEntityId  — string | null
 *   onSelectEntity    — (entity) => void
 *   readOnly          — boolean
 */

import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Box } from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import { UI_COLORS } from "../../constants/uiColors";
import { computeGraphLayout } from "./wikiGraphLayout";
import {
    NODE_COLORS,
    NODE_RADIUS,
    NODE_RADIUS_SELECTED,
    EDGE_COLORS,
    EDGE_ALPHA,
    EDGE_ALPHA_DIMMED,
    NODE_ALPHA_DIMMED,
} from "./wikiGraphTypes";
import { drawSymbolNode, resolveNodeVisual } from "./wikiGraphNodeFactory";
import { attachNodePulse, detachAllNodePulses, WIKI_NODE_PULSE_PRESET } from "./wikiGraphNodePulse";
import { attachEdgePropagation, detachEdgePropagation } from "./wikiGraphEdgeParticles";
import {
    resolveViewportScreenSize,
} from "./wikiGraphCoords";

const BG_COLOR = 0x0e0e14;
const PAN_DURATION_MS = 720;
/** Fixed world size for d3 layout — decoupled from panel/screen width so coords stay stable. */
const LAYOUT_WORLD = 2000;
const NODE_LABEL_SPACE = 24;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeNodeBounds(nodes, padding = 80) {
    if (!nodes?.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
        minX = Math.min(minX, n.x - NODE_RADIUS);
        maxX = Math.max(maxX, n.x + NODE_RADIUS);
        minY = Math.min(minY, n.y - NODE_RADIUS);
        maxY = Math.max(maxY, n.y + NODE_RADIUS + NODE_LABEL_SPACE);
    }

    const width = Math.max(maxX - minX + padding * 2, 240);
    const height = Math.max(maxY - minY + padding * 2, 240);

    return {
        minX,
        minY,
        maxX,
        maxY,
        width,
        height,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
    };
}

/** Sync renderer + viewport screen size with CSS layout pixels (NOT renderer buffer pixels). */
function syncViewportScreen(viewport, app, containerEl) {
    if (!viewport || !app) return;

    const el = containerEl ?? app.canvas?.parentElement;
    const cw = el?.clientWidth ?? 0;
    const ch = el?.clientHeight ?? 0;

    // resizeTo can lag during flex sibling width transitions — keep renderer in sync
    if (cw > 0 && ch > 0) {
        if (Math.abs(app.screen.width - cw) > 0.5 || Math.abs(app.screen.height - ch) > 0.5) {
            app.renderer.resize(cw, ch);
        }
    }

    const resolved = resolveViewportScreenSize({
        containerClientWidth: cw,
        containerClientHeight: ch,
        appScreenWidth: app.screen.width,
        appScreenHeight: app.screen.height,
        rendererWidth: app.renderer.width,
        rendererHeight: app.renderer.height,
        resolution: app.renderer.resolution ?? 1,
    });

    if (resolved.width > 0 && resolved.height > 0) {
        viewport.resize(resolved.width, resolved.height);
    }

    return resolved;
}

/** Stop an in-progress pan animation so resize can re-center with updated screen bounds. */
function cancelViewportPan(viewport) {
    if (!viewport?.plugins) return;
    const animatePlugin = viewport.plugins.get("animate");
    if (animatePlugin) viewport.plugins.remove("animate");
}

/** Fit all nodes in view (overview). */
function fitGraphToNodes(viewport, nodes) {
    const bounds = computeNodeBounds(nodes);
    if (!bounds) return;
    viewport.fit(false, bounds.width, bounds.height);
    viewport.moveCenter(bounds.cx, bounds.cy);
}

/** Smooth pan so the selected node drifts to center instead of jumping. */
function smoothCenterOnWorld(viewport, worldX, worldY, { time = PAN_DURATION_MS } = {}) {
    const center = viewport.center;
    const dx = worldX - center.x;
    const dy = worldY - center.y;

    if (Math.hypot(dx, dy) < 4) {
        viewport.moveCenter(worldX, worldY);
        return;
    }

    viewport.animate({
        position: { x: worldX, y: worldY },
        time,
        ease: "easeInOutCubic",
        removeOnInterrupt: true,
    });
}

function centerOnNode(viewport, nodes, entityId, { animate = true } = {}) {
    const node = nodes?.find((n) => n.id === entityId);
    if (!node) return;

    const vc = viewport.center;
    if (animate) smoothCenterOnWorld(viewport, node.x, node.y);
    else viewport.moveCenter(node.x, node.y);

    const screenPt = viewport.toScreen(new PIXI.Point(node.x, node.y));
    console.log("[WikiNetwork] center on node", {
        entityId,
        nodeWorld: { x: node.x, y: node.y },
        viewportCenterAfter: { x: viewport.center.x, y: viewport.center.y },
        viewportCenterBefore: { x: vc.x, y: vc.y },
        screenSize: { w: viewport.screenWidth, h: viewport.screenHeight },
        screenCenter: { x: viewport.screenWidth / 2, y: viewport.screenHeight / 2 },
        nodeOnScreen: { x: screenPt.x, y: screenPt.y },
        offsetFromScreenCenter: {
            x: screenPt.x - viewport.screenWidth / 2,
            y: screenPt.y - viewport.screenHeight / 2,
        },
        animate,
    });
}

/** Debug: screen/world coords — world = viewport-local (same as node.x/y). */
function logNetworkPointerDebug(label, viewport, event, extra = {}) {
    const clickScreen = { x: event.global.x, y: event.global.y };
    const clickWorld = event.getLocalPosition(viewport);
    const vc = viewport.center;

    const payload = {
        canvasOrigin: "top-left of pixi canvas = screen (0,0)",
        coordSystems: {
            clickScreen: "Pixi global, CSS px from canvas top-left",
            clickWorld: "viewport-local; must match nodeWorld when clicking a node",
            nodeWorld: "d3 layout; children of viewport at container.position",
        },
        clickScreen,
        clickWorld: { x: clickWorld.x, y: clickWorld.y },
        viewportCenter: { x: vc.x, y: vc.y },
        screenCenter: { x: viewport.screenWidth / 2, y: viewport.screenHeight / 2 },
        screenSize: { w: viewport.screenWidth, h: viewport.screenHeight },
        ...extra,
    };

    if (extra.nodeWorld) {
        const screenPt = viewport.toScreen(new PIXI.Point(extra.nodeWorld.x, extra.nodeWorld.y));
        payload.nodeOnScreen = { x: screenPt.x, y: screenPt.y };
        payload.clickVsNodeWorld = {
            dx: clickWorld.x - extra.nodeWorld.x,
            dy: clickWorld.y - extra.nodeWorld.y,
        };
        payload.nodeOffsetFromScreenCenter = {
            x: screenPt.x - viewport.screenWidth / 2,
            y: screenPt.y - viewport.screenHeight / 2,
        };
    }

    console.log(`[WikiNetwork] ${label}`, payload);
}

function destroyNodeLayer(nodeLayer, app) {
    if (!nodeLayer) return;
    if (app) detachAllNodePulses(app, nodeLayer);
    const children = nodeLayer.removeChildren();
    for (const child of children) {
        try {
            child.destroy({ children: true });
        } catch {
            /* strict mode / teardown order */
        }
    }
}

/** Viewport must be destroyed before Application so pixi-viewport can detach from the ticker. */
function teardownWikiGraphApp(app, viewport, { resizeObserver, panFrameRef } = {}) {
    if (panFrameRef?.current != null) {
        cancelAnimationFrame(panFrameRef.current);
        panFrameRef.current = null;
    }

    resizeObserver?.disconnect?.();

    if (app?._wikiResizeHandler) {
        window.removeEventListener("resize", app._wikiResizeHandler);
        app._wikiResizeHandler = null;
    }

    if (viewport) {
        try {
            viewport.plugins?.pause?.("drag");
            if (viewport.parent) viewport.parent.removeChild(viewport);
            viewport.destroy({ children: true });
        } catch {
            /* strict mode / already destroyed */
        }
    }

    if (app) {
        try {
            if (app.canvas?.parentNode) {
                app.canvas.parentNode.removeChild(app.canvas);
            }
            app.destroy(true, { children: false });
        } catch {
            /* idem */
        }
    }
}

function drawEdges(backGraphics, frontGraphics, links, positions, selectedId, propagation) {
    backGraphics.clear();
    frontGraphics.clear();

    const isLive    = propagation?.mode === "live" && propagation?.active;
    const isPreview = propagation?.mode === "preview";
    const litSet = (isLive || isPreview) && propagation.litNodeIds?.length
        ? new Set(propagation.litNodeIds)
        : null;

    const isIncident = (link) => {
        if (!selectedId) return false;
        const fromId = link.source?.id ?? link.source;
        const toId = link.target?.id ?? link.target;
        return fromId === selectedId || toId === selectedId;
    };

    const strokeLink = (graphics, link, { forceHighlight = false } = {}) => {
        const from = positions.get(link.source?.id ?? link.source);
        const to = positions.get(link.target?.id ?? link.target);
        if (!from || !to) return;

        const bothLit = litSet?.has(from.id) && litSet?.has(to.id);
        const incident = isIncident(link);
        const dimmed = forceHighlight
            ? false
            : litSet
                ? !bothLit
                : selectedId && !incident;

        const color = EDGE_COLORS[link.relationType] ?? EDGE_COLORS.otro;
        const strength = link.strength ?? 0;
        const absStrength = Math.abs(strength);

        const alphaBase = isPreview && dimmed ? 0.06 : EDGE_ALPHA;
        const alpha = dimmed ? alphaBase : alphaBase + Math.min(absStrength / 10, 0.35);
        const width = dimmed ? 1 : 1 + absStrength * 0.2;

        graphics.setStrokeStyle({ width, color, alpha });
        graphics.moveTo(from.x, from.y);
        graphics.lineTo(to.x, to.y);
        graphics.stroke();
    };

    for (const link of links) {
        if (selectedId && isIncident(link)) {
            strokeLink(frontGraphics, link, { forceHighlight: true });
        } else {
            strokeLink(backGraphics, link);
        }
    }
}

/** Opaque disc so edges never bleed through semi-transparent node fills. */
function addNodeBackdrop(container, radius) {
    const backdrop = new PIXI.Graphics();
    backdrop.setFillStyle({ color: BG_COLOR, alpha: 1 });
    backdrop.circle(0, 0, radius + 3);
    backdrop.fill();
    container.addChild(backdrop);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WikiGraphCanvas({
    entities = [],
    relations = [],
    selectedEntityId,
    onSelectEntity,
    /** When true, the left detail panel is open and the canvas is narrower — center after layout settles. */
    detailPanelOpen = false,
    /** When true, the LAB_IA panel is open on the right. */
    labPanelOpen = true,
    /** AI propagation animation state — does not trigger layout recompute. */
    propagationState = null,
}) {
    const containerRef = useRef(null);
    const appRef = useRef(null);
    const viewportRef = useRef(null);
    const edgeLayerRef = useRef(null);
    const edgeLayerFrontRef = useRef(null);
    const particleLayerRef = useRef(null);
    const nodeLayerRef = useRef(null);
    const selectedNodeLayerRef = useRef(null);
    const layoutRef = useRef(null);
    const destroyedRef = useRef(false);
    const selectedEntityIdRef = useRef(selectedEntityId);
    const resizeObserverRef = useRef(null);
    const panFrameRef = useRef(null);
    const pendingCenterRef = useRef(null);
    const syncAfterContainerResizeRef = useRef(null);
    const [ready, setReady] = useState(false);

    selectedEntityIdRef.current = selectedEntityId;

    // Build vttCharacterImages map for node image fallback
    const locations = useSelector((s) => s.world.locations);
    const vttCharacterImages = {};
    for (const loc of Object.values(locations)) {
        for (const char of (loc.characters || [])) {
            if (char.id && char.imageUrl) {
                vttCharacterImages[char.id] = char.imageUrl;
            }
        }
    }

    // ── Init Pixi app and viewport ──────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || appRef.current) return;

        destroyedRef.current = false;
        let cancelled = false;
        const app = new PIXI.Application();

        app.init({
            resizeTo: containerRef.current,
            background: BG_COLOR,
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        }).then(() => {
            if (cancelled || !containerRef.current) {
                teardownWikiGraphApp(app, null);
                return;
            }

            containerRef.current.appendChild(app.canvas);
            appRef.current = app;

            const vp = new Viewport({
                screenWidth: app.screen.width,
                screenHeight: app.screen.height,
                worldWidth: LAYOUT_WORLD,
                worldHeight: LAYOUT_WORLD,
                ticker: app.ticker,
                events: app.renderer.events,
            });

            vp.drag().pinch().wheel().decelerate({ friction: 0.88 });
            vp.eventMode = "static";
            vp.on("pointertap", (e) => {
                logNetworkPointerDebug("canvas click", vp, e);
            });
            app.stage.addChild(vp);
            viewportRef.current = vp;

            // Edge layer (behind nodes)
            const edgeLayer = new PIXI.Graphics();
            vp.addChild(edgeLayer);
            edgeLayerRef.current = edgeLayer;

            // Node layer (non-selected nodes)
            const nodeLayer = new PIXI.Container();
            vp.addChild(nodeLayer);
            nodeLayerRef.current = nodeLayer;

            // Highlighted edges for selected node (above other nodes, below selected node)
            const edgeLayerFront = new PIXI.Graphics();
            vp.addChild(edgeLayerFront);
            edgeLayerFrontRef.current = edgeLayerFront;

            // Selected node always on top of its incident edges
            const selectedNodeLayer = new PIXI.Container();
            vp.addChild(selectedNodeLayer);
            selectedNodeLayerRef.current = selectedNodeLayer;

            const particleLayer = new PIXI.Container();
            vp.addChild(particleLayer);
            particleLayerRef.current = particleLayer;

            const syncAfterContainerResize = () => {
                if (!containerRef.current || !appRef.current || !viewportRef.current) return;

                const viewport = viewportRef.current;
                const app = appRef.current;
                const sizeInfo = syncViewportScreen(viewport, app, containerRef.current);

                if (sizeInfo?.diagnostics?.resolutionMismatch) {
                    console.warn("[WikiNetwork] renderer/CSS size mismatch — check autoDensity", sizeInfo.diagnostics);
                }

                const layout = layoutRef.current;
                if (!layout?.nodes?.length) return;

                const selectedId = selectedEntityIdRef.current;
                if (selectedId) {
                    const pending = pendingCenterRef.current;
                    const shouldAnimate = pending?.entityId === selectedId && pending.animate;
                    cancelViewportPan(viewport);
                    centerOnNode(viewport, layout.nodes, selectedId, { animate: shouldAnimate });
                    if (pending?.entityId === selectedId) pendingCenterRef.current = null;
                } else {
                    cancelViewportPan(viewport);
                    fitGraphToNodes(viewport, layout.nodes);
                }
            };

            syncAfterContainerResizeRef.current = syncAfterContainerResize;

            // Flex panels (e.g. detail sidebar) resize the canvas without a window resize event
            if (typeof ResizeObserver !== "undefined" && containerRef.current) {
                const ro = new ResizeObserver(() => {
                    requestAnimationFrame(syncAfterContainerResize);
                });
                ro.observe(containerRef.current);
                const parentEl = containerRef.current.parentElement;
                if (parentEl) ro.observe(parentEl);
                resizeObserverRef.current = ro;
            }

            // Window resize fallback
            const onResize = () => syncAfterContainerResize();
            window.addEventListener("resize", onResize);
            app._wikiResizeHandler = onResize;

            setReady(true);
        }).catch(console.error);

        return () => {
            cancelled = true;
            destroyedRef.current = true;
            setReady(false);
            teardownWikiGraphApp(appRef.current ?? app, viewportRef.current, {
                resizeObserver: resizeObserverRef.current,
                panFrameRef,
            });
            resizeObserverRef.current = null;
            appRef.current = null;
            viewportRef.current = null;
            edgeLayerRef.current = null;
            edgeLayerFrontRef.current = null;
            particleLayerRef.current = null;
            nodeLayerRef.current = null;
            selectedNodeLayerRef.current = null;
            layoutRef.current = null;
            syncAfterContainerResizeRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Rebuild graph when data or selection changes ───────────────────────
    useEffect(() => {
        if (!ready || !nodeLayerRef.current || entities.length === 0) return;

        const app = appRef.current;
        const viewport = viewportRef.current;
        const nodeLayer = nodeLayerRef.current;
        const selectedNodeLayer = selectedNodeLayerRef.current;
        const edgeLayer = edgeLayerRef.current;
        const edgeLayerFront = edgeLayerFrontRef.current;

        const W = LAYOUT_WORLD;
        const H = LAYOUT_WORLD;

        syncViewportScreen(viewport, app, containerRef.current);

        // Compute layout (or reuse if already done for same set of ids)
        const entityIds = entities.map((e) => e.id).sort().join(",");
        const relationIds = relations.map((r) => r.id).sort().join(",");
        const layoutKey = `${entityIds}::${relationIds}`;

        if (!layoutRef.current || layoutRef.current.key !== layoutKey) {
            const { nodes, links } = computeGraphLayout(entities, relations, {
                width: W,
                height: H,
            });
            layoutRef.current = { key: layoutKey, nodes, links };
        }

        const { nodes, links } = layoutRef.current;
        const posMap = new Map(nodes.map((n) => [n.id, n]));

        const isLiveMode    = propagationState?.mode === "live" && propagationState?.active;
        const isPreviewMode = propagationState?.mode === "preview";
        const isAnyPropagation = isLiveMode || isPreviewMode;

        const litSet = isAnyPropagation && propagationState.litNodeIds?.length
            ? new Set(propagationState.litNodeIds)
            : null;
        const currentWaveIds = isLiveMode
            ? new Set(propagationState.waves?.[propagationState.currentWave]?.nodeIds ?? [])
            : null;

        // For preview mode: build a map of nodeId → waveIndex for color-coding
        const previewWaveMap = isPreviewMode
            ? (() => {
                const m = new Map();
                for (const [wi, wave] of (propagationState.waves ?? []).entries()) {
                    for (const id of wave.nodeIds ?? []) m.set(id, wi);
                }
                return m;
            })()
            : null;

        // ── Draw edges (back = all non-incident; front = incident to selection) ──
        drawEdges(edgeLayer, edgeLayerFront, links, posMap, selectedEntityId, propagationState);

        // ── Draw nodes ──
        destroyNodeLayer(nodeLayer, app);
        destroyNodeLayer(selectedNodeLayer, app);

        for (const node of nodes) {
            const entity = entities.find((e) => e.id === node.id);
            if (!entity) continue;

            const isSelected = entity.id === selectedEntityId;
            const targetLayer = isSelected ? selectedNodeLayer : nodeLayer;
            const isNeighbor = selectedEntityId && links.some(
                (l) =>
                    ((l.source?.id ?? l.source) === selectedEntityId &&
                        (l.target?.id ?? l.target) === entity.id) ||
                    ((l.target?.id ?? l.target) === selectedEntityId &&
                        (l.source?.id ?? l.source) === entity.id)
            );
            const isLit = litSet?.has(entity.id);
            const isCurrentWave = currentWaveIds?.has(entity.id);

            const isDimmed = isAnyPropagation
                ? (!isLit && !isSelected)
                : selectedEntityId
                    ? !isSelected && !isNeighbor
                    : false;

            // Preview: attenuate non-lit nodes more softly than live mode
            const previewAlpha = isPreviewMode && !isLit && !isSelected ? 0.25 : null;

            const container = new PIXI.Container();
            container.position.set(node.x, node.y);
            container.eventMode = "static";
            container.cursor = "pointer";
            container.alpha = previewAlpha !== null ? previewAlpha : isDimmed ? NODE_ALPHA_DIMMED : 1;

            const nodeColor = NODE_COLORS[entity.entityType] ?? 0x888888;
            const displayRadius = isSelected ? NODE_RADIUS_SELECTED : NODE_RADIUS;

            addNodeBackdrop(container, displayRadius);

            // Symbol fallback (rendered immediately; replaced async if image loads)
            const symbolNode = drawSymbolNode(entity.entityType);
            if (isSelected) symbolNode.scale.set(NODE_RADIUS_SELECTED / NODE_RADIUS);
            container.addChild(symbolNode);

            // Async: try to load a real image and swap symbol out
            resolveNodeVisual(entity, vttCharacterImages).then((visual) => {
                if (
                    destroyedRef.current
                    || visual === "symbol"
                    || !container.parent
                    || !nodeLayerRef.current
                ) {
                    return;
                }
                container.removeChild(symbolNode);
                symbolNode.destroy({ children: true });
                if (isSelected) visual.scale.set(NODE_RADIUS_SELECTED / NODE_RADIUS);
                container.addChildAt(visual, 0);
            });

            if (isSelected || (isLiveMode && isCurrentWave)) {
                attachNodePulse(
                    app,
                    container,
                    nodeColor,
                    isCurrentWave && !isSelected
                        ? { ...WIKI_NODE_PULSE_PRESET, alphaMax: 0.55, scaleMax: 1.45, pulseDuration: 1.0 }
                        : {}
                );
            }

            // Label text
            const label = new PIXI.Text({
                text: (entity.title || "").slice(0, 18) + (entity.title?.length > 18 ? "…" : ""),
                style: new PIXI.TextStyle({
                    fontSize: isSelected ? 13 : 11,
                    fill: nodeColor,
                    fontFamily: "Fira Sans, sans-serif",
                    align: "center",
                }),
            });
            label.anchor.set(0.5, 0);
            label.position.set(0, (isSelected ? NODE_RADIUS_SELECTED : NODE_RADIUS) + 5);
            container.addChild(label);

            // Interaction
            container.on("pointerover", () => {
                if (!isSelected) container.scale.set(1.12);
            });
            container.on("pointerout", () => {
                container.scale.set(1);
            });
            container.on("pointertap", (e) => {
                e.stopPropagation();
                logNetworkPointerDebug("node click", viewport, e, {
                    entityId: entity.id,
                    title: entity.title,
                    nodeWorld: { x: node.x, y: node.y },
                });
                onSelectEntity?.(entity);
            });

            targetLayer.addChild(container);
        }

        // Fit all nodes when nothing is selected
        if (!selectedEntityId) {
            fitGraphToNodes(viewport, nodes);
        }

        return () => {
            destroyNodeLayer(nodeLayerRef.current, appRef.current);
            destroyNodeLayer(selectedNodeLayerRef.current, appRef.current);
            edgeLayerRef.current?.clear?.();
            edgeLayerFrontRef.current?.clear?.();
        };
    }, [ready, entities, relations, selectedEntityId, propagationState, onSelectEntity]);

    // ── Edge particle animation (no layout recompute) ─────────────────────
    useEffect(() => {
        const app = appRef.current;
        const particleLayer = particleLayerRef.current;
        const layout = layoutRef.current;

        if (!ready || !app || !particleLayer || !layout?.nodes?.length) return;

        // Edge particles only in live mode, never in static preview
        if (propagationState?.mode !== "live" || !propagationState?.active) {
            detachEdgePropagation(app, particleLayer);
            return;
        }

        const wave = propagationState.waves?.[propagationState.currentWave];
        if (!wave?.edges?.length) {
            detachEdgePropagation(app, particleLayer);
            return;
        }

        const posMap = new Map(layout.nodes.map((n) => [n.id, n]));
        const entityById = new Map(entities.map((e) => [e.id, e]));

        attachEdgePropagation(
            app,
            particleLayer,
            wave.edges,
            posMap,
            (id) => NODE_COLORS[entityById.get(id)?.entityType] ?? 0xffffff
        );

        return () => detachEdgePropagation(app, particleLayer);
    }, [ready, propagationState, entities]);

    // Panel toggles use width transitions — resync renderer/viewport after layout settles
    useEffect(() => {
        if (!ready) return;

        syncAfterContainerResizeRef.current?.();

        const afterTransition = setTimeout(() => {
            syncAfterContainerResizeRef.current?.();
        }, 280);

        return () => clearTimeout(afterTransition);
    }, [ready, detailPanelOpen, labPanelOpen]);

    // Smooth pan when selection changes — wait for detail panel flex layout to settle
    useEffect(() => {
        if (!ready || !viewportRef.current || !layoutRef.current) return;
        if (!selectedEntityId) {
            pendingCenterRef.current = null;
            return;
        }

        const nodes = layoutRef.current.nodes;
        const node = nodes?.find((n) => n.id === selectedEntityId);
        if (!node) return;

        pendingCenterRef.current = { entityId: selectedEntityId, animate: true };

        if (panFrameRef.current != null) {
            cancelAnimationFrame(panFrameRef.current);
        }

        // Triple rAF + microtask: flex panel (right detail) may resize the canvas after paint
        panFrameRef.current = requestAnimationFrame(() => {
            panFrameRef.current = requestAnimationFrame(() => {
                panFrameRef.current = requestAnimationFrame(() => {
                    panFrameRef.current = null;
                    if (destroyedRef.current || !viewportRef.current || !appRef.current) return;
                    syncAfterContainerResizeRef.current?.();
                });
            });
        });

        return () => {
            pendingCenterRef.current = null;
            if (panFrameRef.current != null) {
                cancelAnimationFrame(panFrameRef.current);
                panFrameRef.current = null;
            }
        };
    }, [ready, selectedEntityId, detailPanelOpen, labPanelOpen, entities, relations]);

    return (
        <Box
            sx={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                width: "100%",
                height: "100%",
                bgcolor: "#0e0e14",
            }}
        >
            <div
                ref={containerRef}
                style={{ width: "100%", height: "100%", overflow: "hidden" }}
            />
            {entities.length === 0 && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.5,
                        pointerEvents: "none",
                    }}
                >
                    <HubIcon sx={{ color: `${UI_COLORS.accent}44`, fontSize: "3rem" }} />
                    <span style={{ color: UI_COLORS.textSecondary, fontFamily: "Fira Sans", fontSize: "0.85rem" }}>
                        No hay entidades para mostrar en la red.
                    </span>
                </Box>
            )}
        </Box>
    );
}
