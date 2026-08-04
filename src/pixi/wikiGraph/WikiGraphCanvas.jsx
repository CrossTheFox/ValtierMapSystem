/**
 * WikiGraphCanvas.jsx
 *
 * Self-contained Pixi.js canvas that renders the entity relation graph.
 * Node structure rebuilds only when entities/relations/selection change.
 * Propagation animation updates alpha/pulses/edges in place (no full rebuild).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Box } from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import { UI_COLORS } from "../../constants/uiColors";
import WikiGraphHud from "../../components/wiki/WikiGraphHud";
import { computeGraphLayout } from "./wikiGraphLayout";
import {
    NODE_COLORS,
    NODE_RADIUS,
    NODE_RADIUS_SELECTED,
    EDGE_COLORS,
    EDGE_ALPHA,
} from "./wikiGraphTypes";
import { drawSymbolNode, resolveNodeVisual } from "./wikiGraphNodeFactory";
import { detachAllNodePulses } from "./wikiGraphNodePulse";
import { attachEdgePropagation, detachEdgePropagation } from "./wikiGraphEdgeParticles";
import { resolveViewportScreenSize } from "./wikiGraphCoords";
import {
    applyPropagationNodeVisuals,
    buildPreviewWaveMap,
    syncNodePulses,
} from "./wikiGraphPropagationVisuals";
import {
    buildEffectivePropagation,
    propagationRenderKey,
    tickLivePropagation,
} from "./wikiGraphPropagationRuntime";

const BG_COLOR = 0x0a0a12;
const GRID_COLOR = 0x2a2a3d;
const GRID_STEP = 50;
const PAN_DURATION_MS = 720;
const LAYOUT_WORLD = 2000;
const NODE_LABEL_SPACE = 24;
/** Cap GPU memory on HiDPI displays (production often has DPR > local dev). */
const MAX_RENDERER_DPR = 1.5;

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
        minX, minY, maxX, maxY, width, height,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
    };
}

function syncViewportScreen(viewport, app, containerEl) {
    if (!viewport || !app) return;

    const el = containerEl ?? app.canvas?.parentElement;
    const cw = el?.clientWidth ?? 0;
    const ch = el?.clientHeight ?? 0;

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

function cancelViewportPan(viewport) {
    if (!viewport?.plugins) return;
    const animatePlugin = viewport.plugins.get("animate");
    if (animatePlugin) viewport.plugins.remove("animate");
}

function fitGraphToNodes(viewport, nodes) {
    const bounds = computeNodeBounds(nodes);
    if (!bounds) return;
    viewport.fit(false, bounds.width, bounds.height);
    viewport.moveCenter(bounds.cx, bounds.cy);
}

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
    if (animate) smoothCenterOnWorld(viewport, node.x, node.y);
    else viewport.moveCenter(node.x, node.y);
}

function destroyNodeLayer(nodeLayer, app) {
    if (!nodeLayer) return;
    if (app) detachAllNodePulses(app, nodeLayer);
    const children = nodeLayer.removeChildren();
    for (const child of children) {
        try {
            child.destroy({ children: true });
        } catch {
            /* teardown order */
        }
    }
}

function teardownWikiGraphApp(
    app,
    viewport,
    { resizeObserver, panFrameRef, particleLayer, propagationOnTick, nodeLayers = [] } = {}
) {
    if (panFrameRef?.current != null) {
        cancelAnimationFrame(panFrameRef.current);
        panFrameRef.current = null;
    }

    resizeObserver?.disconnect?.();

    if (app?._wikiResizeHandler) {
        window.removeEventListener("resize", app._wikiResizeHandler);
        app._wikiResizeHandler = null;
    }

    if (app?.ticker) {
        if (propagationOnTick) {
            try {
                app.ticker.remove(propagationOnTick);
            } catch {
                /* teardown order */
            }
        }
        try {
            app.ticker.stop();
        } catch {
            /* idem */
        }
    }

    if (app) {
        for (const layer of nodeLayers) {
            destroyNodeLayer(layer, app);
        }
    }

    if (app && particleLayer) {
        detachEdgePropagation(app, particleLayer);
    }

    if (viewport) {
        try {
            viewport.plugins?.pause?.("drag");
            if (viewport.parent) viewport.parent.removeChild(viewport);
            viewport.destroy({ children: true });
        } catch {
            /* already destroyed */
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
    const previewWaveMap = isPreview ? buildPreviewWaveMap(propagation?.waves) : null;

    const litSet = isLive && propagation?.litNodeIds?.length
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

        let dimmed = forceHighlight ? false : selectedId && !isIncident(link);

        if (isLive && litSet) {
            dimmed = !litSet.has(from.id) || !litSet.has(to.id);
        } else if (isPreview && previewWaveMap) {
            dimmed = !previewWaveMap.has(from.id) || !previewWaveMap.has(to.id);
        }

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

function addNodeBackdrop(container, radius) {
    const backdrop = new PIXI.Graphics();
    backdrop.setFillStyle({ color: BG_COLOR, alpha: 1 });
    backdrop.circle(0, 0, radius + 3);
    backdrop.fill();
    container.addChild(backdrop);
}

function drawGraphGrid(worldSize = LAYOUT_WORLD) {
    const grid = new PIXI.Graphics();
    grid.setStrokeStyle({ width: 0.5, color: GRID_COLOR, alpha: 0.4 });
    for (let x = 0; x <= worldSize; x += GRID_STEP) {
        grid.moveTo(x, 0);
        grid.lineTo(x, worldSize);
    }
    for (let y = 0; y <= worldSize; y += GRID_STEP) {
        grid.moveTo(0, y);
        grid.lineTo(worldSize, y);
    }
    grid.stroke();
    return grid;
}

function ensureLayout(entities, relations, layoutRef) {
    const entityIds = entities.map((e) => e.id).sort().join(",");
    const relationIds = relations.map((r) => r.id).sort().join(",");
    const layoutKey = `${entityIds}::${relationIds}`;

    if (!layoutRef.current || layoutRef.current.key !== layoutKey) {
        const { nodes, links } = computeGraphLayout(entities, relations, {
            width: LAYOUT_WORLD,
            height: LAYOUT_WORLD,
        });
        layoutRef.current = { key: layoutKey, nodes, links };
    }

    return layoutRef.current;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WikiGraphCanvas({
    entities = [],
    relations = [],
    /** Full entity list for legend counts (defaults to entities). */
    legendEntities = null,
    selectedEntityId,
    selectedEntity = null,
    onSelectEntity,
    onClearSelection,
    onOpenEntityDetail,
    detailPanelOpen = false,
    labPanelOpen = true,
    propagationState = null,
    hiddenTypes = null,
    soloType = null,
    onToggleType,
    onSoloType,
    onClearSolo,
}) {
    const legendSource = legendEntities ?? entities;
    const containerRef = useRef(null);
    const appRef = useRef(null);
    const viewportRef = useRef(null);
    const edgeLayerRef = useRef(null);
    const edgeLayerFrontRef = useRef(null);
    const particleLayerRef = useRef(null);
    const nodeLayerRef = useRef(null);
    const selectedNodeLayerRef = useRef(null);
    const layoutRef = useRef(null);
    /** @type {React.MutableRefObject<Map<string, { container: PIXI.Container, pulsing?: boolean, pulseWave?: number }>>} */
    const nodeRegistryRef = useRef(new Map());
    const imageLoadGenRef = useRef(0);
    const destroyedRef = useRef(false);
    const selectedEntityIdRef = useRef(selectedEntityId);
    const resizeObserverRef = useRef(null);
    const panFrameRef = useRef(null);
    const pendingCenterRef = useRef(null);
    const syncAfterContainerResizeRef = useRef(null);
    const onSelectEntityRef = useRef(onSelectEntity);
    const propagationRef = useRef(null);
    const liveAnimRef = useRef({
        waveIndex: 0,
        elapsedMs: 0,
        wavesSig: "",
        lastParticleWave: -1,
    });
    const entityByIdRef = useRef(new Map());
    const lastRenderKeyRef = useRef("");
    const propagationOnTickRef = useRef(null);
    const [ready, setReady] = useState(false);

    selectedEntityIdRef.current = selectedEntityId;
    onSelectEntityRef.current = onSelectEntity;
    propagationRef.current = propagationState;

    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});

    // ── Init Pixi app ───────────────────────────────────────────────────────
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
            resolution: Math.min(window.devicePixelRatio || 1, MAX_RENDERER_DPR),
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
            app.stage.addChild(vp);
            viewportRef.current = vp;

            vp.addChildAt(drawGraphGrid(), 0);

            const edgeLayer = new PIXI.Graphics();
            vp.addChild(edgeLayer);
            edgeLayerRef.current = edgeLayer;

            const nodeLayer = new PIXI.Container();
            vp.addChild(nodeLayer);
            nodeLayerRef.current = nodeLayer;

            const edgeLayerFront = new PIXI.Graphics();
            vp.addChild(edgeLayerFront);
            edgeLayerFrontRef.current = edgeLayerFront;

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
                syncViewportScreen(viewport, app, containerRef.current);

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

            if (typeof ResizeObserver !== "undefined" && containerRef.current) {
                const ro = new ResizeObserver(() => {
                    requestAnimationFrame(syncAfterContainerResize);
                });
                ro.observe(containerRef.current);
                const parentEl = containerRef.current.parentElement;
                if (parentEl) ro.observe(parentEl);
                resizeObserverRef.current = ro;
            }

            const onResize = () => syncAfterContainerResize();
            window.addEventListener("resize", onResize);
            app._wikiResizeHandler = onResize;

            setReady(true);
        }).catch(console.error);

        return () => {
            cancelled = true;
            destroyedRef.current = true;
            setReady(false);
            nodeRegistryRef.current.clear();
            teardownWikiGraphApp(appRef.current ?? app, viewportRef.current, {
                resizeObserver: resizeObserverRef.current,
                panFrameRef,
                particleLayer: particleLayerRef.current,
                propagationOnTick: propagationOnTickRef.current,
                nodeLayers: [nodeLayerRef.current, selectedNodeLayerRef.current],
            });
            propagationOnTickRef.current = null;
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
    }, []);

    // ── Rebuild node structure (NOT on propagation ticks) ───────────────────
    useEffect(() => {
        if (!ready || !nodeLayerRef.current) return;

        const app = appRef.current;
        const viewport = viewportRef.current;
        const nodeLayer = nodeLayerRef.current;
        const selectedNodeLayer = selectedNodeLayerRef.current;
        const edgeBack = edgeLayerRef.current;
        const edgeFront = edgeLayerFrontRef.current;

        destroyNodeLayer(nodeLayer, app);
        destroyNodeLayer(selectedNodeLayer, app);
        nodeRegistryRef.current.clear();

        if (entities.length === 0) {
            edgeBack?.clear();
            edgeFront?.clear();
            layoutRef.current = null;
            lastRenderKeyRef.current = "";
            return;
        }

        syncViewportScreen(viewport, app, containerRef.current);

        const { nodes, links } = ensureLayout(entities, relations, layoutRef);
        const loadGen = ++imageLoadGenRef.current;

        const entityById = new Map(entities.map((e) => [e.id, e]));
        entityByIdRef.current = entityById;

        const positions = new Map(nodes.map((n) => [n.id, n]));
        if (edgeBack && edgeFront) {
            drawEdges(
                edgeBack,
                edgeFront,
                links,
                positions,
                selectedEntityId,
                buildEffectivePropagation(propagationRef.current, liveAnimRef.current)
            );
            lastRenderKeyRef.current = "";
        }

        for (const node of nodes) {
            const entity = entityById.get(node.id);
            if (!entity) continue;

            const isSelected = entity.id === selectedEntityId;
            const targetLayer = isSelected ? selectedNodeLayer : nodeLayer;
            const displayRadius = isSelected ? NODE_RADIUS_SELECTED : NODE_RADIUS;
            const nodeColor = NODE_COLORS[entity.entityType] ?? 0x888888;

            const container = new PIXI.Container();
            container.position.set(node.x, node.y);
            container.eventMode = "static";
            container.cursor = "pointer";

            addNodeBackdrop(container, displayRadius);

            const symbolNode = drawSymbolNode(entity.entityType);
            if (isSelected) symbolNode.scale.set(NODE_RADIUS_SELECTED / NODE_RADIUS);
            container.addChild(symbolNode);

            resolveNodeVisual(entity, locations, charactersById).then((visual) => {
                if (
                    destroyedRef.current
                    || loadGen !== imageLoadGenRef.current
                    || visual === "symbol"
                    || !container.parent
                ) {
                    return;
                }
                const symbolIndex = container.getChildIndex(symbolNode);
                container.removeChild(symbolNode);
                symbolNode.destroy({ children: true });
                if (isSelected) visual.scale.set(NODE_RADIUS_SELECTED / NODE_RADIUS);
                // Keep avatar above the edge-masking backdrop (index 0), not beneath it.
                container.addChildAt(visual, symbolIndex);
            });

            const label = new PIXI.Text({
                text: (entity.title || "").slice(0, 18) + (entity.title?.length > 18 ? "…" : ""),
                style: new PIXI.TextStyle({
                    fontSize: isSelected ? 10 : 9,
                    fill: nodeColor,
                    fontFamily: "'Fira Code', monospace",
                    letterSpacing: 1,
                    align: "center",
                }),
            });
            label.alpha = isSelected ? 1 : 0.6;
            label.anchor.set(0.5, 0);
            label.position.set(0, displayRadius + 5);
            container.addChild(label);

            container.on("pointerover", () => {
                if (entity.id !== selectedEntityIdRef.current) container.scale.set(1.12);
            });
            container.on("pointerout", () => {
                container.scale.set(1);
            });
            container.on("pointertap", (e) => {
                e.stopPropagation();
                onSelectEntityRef.current?.(entity);
            });

            targetLayer.addChild(container);
            nodeRegistryRef.current.set(entity.id, { container, pulsing: false, pulseWave: -1, lastAlpha: 1 });
        }

        if (!selectedEntityId) {
            fitGraphToNodes(viewport, nodes);
        }

        return () => {
            imageLoadGenRef.current += 1;
        };
    }, [ready, entities, relations, selectedEntityId, locations, charactersById]);

    // ── Propagation visuals via Pixi ticker (no React re-render per wave) ───
    useEffect(() => {
        if (!ready || !appRef.current) return;

        const app = appRef.current;
        const liveAnim = liveAnimRef.current;
        liveAnim.waveIndex = 0;
        liveAnim.elapsedMs = 0;
        liveAnim.wavesSig = "";
        liveAnim.lastParticleWave = -1;
        lastRenderKeyRef.current = "";

        const renderPropagation = (force = false) => {
            if (destroyedRef.current || !layoutRef.current?.nodes?.length) return;

            const prop = propagationRef.current;
            const effective = buildEffectivePropagation(prop, liveAnim);
            const selectedId = selectedEntityIdRef.current;
            const renderKey = propagationRenderKey(effective, selectedId);

            if (!force && renderKey === lastRenderKeyRef.current) return;
            lastRenderKeyRef.current = renderKey;

            const { nodes, links } = layoutRef.current;
            const posMap = new Map(nodes.map((n) => [n.id, n]));
            const registry = nodeRegistryRef.current;
            const entityById = entityByIdRef.current;

            drawEdges(
                edgeLayerRef.current,
                edgeLayerFrontRef.current,
                links,
                posMap,
                selectedId,
                effective
            );
            applyPropagationNodeVisuals(registry, effective, selectedId, links);
            syncNodePulses(app, registry, effective, selectedId, entityById);

            const isLive = effective?.mode === "live" && effective?.active;
            const particleLayer = particleLayerRef.current;
            if (isLive && particleLayer) {
                const waveIdx = effective.currentWave ?? 0;
                if (waveIdx !== liveAnim.lastParticleWave) {
                    liveAnim.lastParticleWave = waveIdx;
                    const wave = effective.waves?.[waveIdx];
                    if (wave?.edges?.length) {
                        attachEdgePropagation(
                            app,
                            particleLayer,
                            wave.edges,
                            posMap,
                            (id) => NODE_COLORS[entityById.get(id)?.entityType] ?? 0xffffff
                        );
                    } else {
                        detachEdgePropagation(app, particleLayer);
                    }
                }
            } else if (particleLayer) {
                liveAnim.lastParticleWave = -1;
                detachEdgePropagation(app, particleLayer);
            }
        };

        const onTick = (ticker) => {
            if (destroyedRef.current) return;
            const prop = propagationRef.current;
            if (prop?.mode !== "live" || !prop?.active) return;
            if (tickLivePropagation(prop, liveAnim, ticker.deltaMS)) {
                renderPropagation(false);
            }
        };

        propagationOnTickRef.current = onTick;
        app.ticker.add(onTick);
        renderPropagation(true);

        return () => {
            if (app?.ticker) {
                try {
                    app.ticker.remove(onTick);
                } catch {
                    /* app may already be destroyed */
                }
            }
            if (propagationOnTickRef.current === onTick) {
                propagationOnTickRef.current = null;
            }
            detachEdgePropagation(app, particleLayerRef.current);
        };
    }, [ready, propagationState, selectedEntityId]);

    // Panel width transitions
    useEffect(() => {
        if (!ready) return;
        syncAfterContainerResizeRef.current?.();
        const afterTransition = setTimeout(() => {
            syncAfterContainerResizeRef.current?.();
        }, 280);
        return () => clearTimeout(afterTransition);
    }, [ready, detailPanelOpen, labPanelOpen]);

    // Smooth pan on selection change
    useEffect(() => {
        if (!ready || !viewportRef.current || !layoutRef.current) return;
        if (!selectedEntityId) {
            pendingCenterRef.current = null;
            return;
        }

        const nodes = layoutRef.current.nodes;
        if (!nodes?.find((n) => n.id === selectedEntityId)) return;

        pendingCenterRef.current = { entityId: selectedEntityId, animate: true };

        if (panFrameRef.current != null) cancelAnimationFrame(panFrameRef.current);

        panFrameRef.current = requestAnimationFrame(() => {
            panFrameRef.current = requestAnimationFrame(() => {
                panFrameRef.current = requestAnimationFrame(() => {
                    panFrameRef.current = null;
                    if (destroyedRef.current || !viewportRef.current) return;
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
    }, [ready, selectedEntityId, detailPanelOpen, labPanelOpen]);

    const handleZoomIn = useCallback(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.zoom(Math.min(vp.scale.x * 1.25, 4), true);
    }, []);

    const handleZoomOut = useCallback(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.zoom(Math.max(vp.scale.x / 1.25, 0.15), true);
    }, []);

    const handleResetView = useCallback(() => {
        const vp = viewportRef.current;
        const nodes = layoutRef.current?.nodes;
        if (!vp || !nodes?.length) return;
        cancelViewportPan(vp);
        const selectedId = selectedEntityIdRef.current;
        if (selectedId) {
            centerOnNode(vp, nodes, selectedId, { animate: false });
        } else {
            fitGraphToNodes(vp, nodes);
        }
    }, []);

    return (
        <Box
            sx={{
                position: "relative",
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                width: "100%",
                height: "100%",
                bgcolor: "#0a0a12",
            }}
        >
            <div
                ref={containerRef}
                style={{ width: "100%", height: "100%", overflow: "hidden" }}
            />
            {legendSource.length > 0 && (
                <WikiGraphHud
                    entities={legendSource}
                    relations={relations}
                    selectedEntity={selectedEntity}
                    hiddenTypes={hiddenTypes}
                    soloType={soloType}
                    onToggleType={onToggleType}
                    onSoloType={onSoloType}
                    onClearSolo={onClearSolo}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetView={handleResetView}
                    onClearSelection={onClearSelection}
                    onOpenEntityDetail={onOpenEntityDetail}
                />
            )}
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
                        {legendSource.length > 0
                            ? "Ningún nodo visible con los filtros de tipo actuales."
                            : "No hay entidades para mostrar en la red."}
                    </span>
                </Box>
            )}
        </Box>
    );
}
