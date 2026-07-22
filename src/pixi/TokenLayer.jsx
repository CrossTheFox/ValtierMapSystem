import { useEffect, useRef, useMemo } from "react";
import * as PIXI from "pixi.js";
import gsap from "gsap";
import { useSelector } from "react-redux";
import { useViewport } from "../context/ViewportContext";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { killGsapDeep, safeDestroy } from "./pixiCleanup";
import { placeTokenOnBoard } from "../../firebase/services/gameService";
import { loadTexture } from "../../firebase/services/assetLoader";
import {
    resolveCellSize,
    snapToGridCenter,
    resolveTokenDiameter,
    resolveTokenSizeKey,
    getMapWidth,
    getMapHeight,
} from "../utils/gridMath";
import { canControlToken, findNearestLocation } from "../utils/tokenControl";
import { bindViewportLabelSync } from "../utils/pixiCrispText";
import { applyTokenImageFit, tokenVisualKey } from "../utils/tokenImageFit";

const HOVER_CYAN = 0x00f2ea;

function ringColorForChar(char) {
    if (!char) return 0x888899;
    if (char.isNpc || char.isEnemy) return 0xff4444;
    return HOVER_CYAN;
}

/** Always-visible name under the token (world space + zoom-aware resolution). */
function createTokenNameLabel(name, radius) {
    const fontSize = Math.max(12, Math.round(radius * 0.38));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const label = new PIXI.Text({
        text: name || "",
        style: {
            fontFamily: "Fira Sans, Arial, sans-serif",
            fontSize,
            fontWeight: "600",
            fill: 0xffffff,
            stroke: {
                color: 0x000000,
                width: Math.max(3, Math.round(fontSize * 0.28)),
                join: "round",
            },
            align: "center",
            padding: 4,
            dropShadow: {
                alpha: 0.55,
                blur: 2,
                distance: 1,
                color: 0x000000,
            },
        },
        resolution: Math.max(2, dpr * 2),
    });
    label.anchor.set(0.5, 0);
    label.y = radius + Math.max(3, radius * 0.08);
    label.roundPixels = true;
    label.eventMode = "none";
    return label;
}

function syncTokenNameResolution(label, viewport) {
    if (!label || !viewport) return;
    const zoom = Math.max(viewport.scale?.x ?? 1, 0.05);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const res = Math.min(8, Math.max(1.5, dpr * zoom));
    if (Math.abs((label.resolution || 1) - res) > 0.2) {
        label.resolution = res;
    }
}

function createHoverRing(radius) {
    const g = new PIXI.Graphics();
    g.eventMode = "none";
    g.visible = false;
    g.lineStyle(Math.max(2.5, radius * 0.14), HOVER_CYAN, 0.85);
    g.drawCircle(0, 0, radius + Math.max(2, radius * 0.06));
    g.lineStyle(Math.max(1, radius * 0.05), HOVER_CYAN, 0.35);
    g.drawCircle(0, 0, radius + Math.max(4, radius * 0.12));
    return g;
}

function buildFallbackDisk(color, label, radius) {
    const container = new PIXI.Container();
    const ring = new PIXI.Graphics();
    ring.lineStyle(Math.max(2, radius * 0.08), color, 0.9);
    ring.drawCircle(0, 0, radius);
    container.addChild(ring);

    const inner = new PIXI.Graphics();
    inner.beginFill(color, 0.85);
    inner.drawCircle(0, 0, radius * 0.78);
    inner.endFill();
    container.addChild(inner);

    const text = new PIXI.Text({
        text: label?.slice(0, 2)?.toUpperCase() ?? "?",
        style: new PIXI.TextStyle({
            fontFamily: "Arial",
            fontSize: Math.max(9, Math.round(radius * 0.7)),
            fill: 0x000000,
            fontWeight: "bold",
        }),
    });
    text.anchor.set(0.5);
    container.addChild(text);
    return container;
}

async function buildTokenVisual(char, diameter, color) {
    const radius = diameter / 2;
    const root = new PIXI.Container();
    const imagePath = char?.tokenImageUrl || char?.imageUrl || null;

    if (imagePath) {
        try {
            const texture = await loadTexture(imagePath);
            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            applyTokenImageFit(sprite, diameter, char?.tokenCrop);

            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff);
            mask.drawCircle(0, 0, radius);
            mask.endFill();

            root.addChild(sprite);
            root.addChild(mask);
            sprite.mask = mask;

            const ring = new PIXI.Graphics();
            ring.lineStyle(Math.max(2, radius * 0.1), color, 0.95);
            ring.drawCircle(0, 0, radius);
            root.addChild(ring);
            return root;
        } catch (err) {
            console.warn("Token image failed, using fallback:", imagePath, err);
        }
    }

    root.addChild(buildFallbackDisk(color, char?.name, radius));
    return root;
}

export default function TokenLayer() {
    const viewport = useViewport();

    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const profile = useSelector((s) => s.player.profile);

    const layerRef = useRef(null);
    const markersRef = useRef(new Map());
    const draggingRef = useRef(null);
    const campaignIdRef = useRef(campaignId);
    const mapIdRef = useRef(mapId);
    const cellSizeRef = useRef(resolveCellSize(map, gridConfig));
    const locationsRef = useRef(locations);
    const buildGenRef = useRef(0);

    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);
    useEffect(() => { mapIdRef.current = mapId; }, [mapId]);
    useEffect(() => {
        cellSizeRef.current = resolveCellSize(map, gridConfig);
    }, [map, gridConfig]);
    useEffect(() => { locationsRef.current = locations; }, [locations]);

    const charById = useMemo(() => {
        const m = new Map();
        // Campaign roster first (includes tokens with null locationId)
        Object.values(charactersById || {}).forEach((c) => {
            if (c?.id) m.set(c.id, c);
        });
        // Nested location chars overwrite (fresher placement sync)
        Object.values(locations || {}).forEach((loc) => {
            (loc.characters || []).forEach((c) => {
                if (c?.id) m.set(c.id, c);
            });
        });
        return m;
    }, [charactersById, locations]);

    useEffect(() => {
        if (!viewport || !map || !mapId) return;

        const layer = new PIXI.Container();
        layer.label = "TokenLayer";
        layer.zIndex = RENDER_LAYERS.TOKENS;
        layer.sortableChildren = true;
        viewport.addChild(layer);
        layerRef.current = layer;

        const onMove = (e) => {
            const drag = draggingRef.current;
            if (!drag) return;
            const wp = viewport.toWorld(e.global.x, e.global.y);
            drag.marker.x = wp.x - drag.offsetX;
            drag.marker.y = wp.y - drag.offsetY;
        };

        const onUp = (e) => {
            const drag = draggingRef.current;
            if (!drag || e.button !== 0) return;
            draggingRef.current = null;
            drag.marker.cursor = "grab";
            viewport.plugins?.resume?.("drag");

            const cell = cellSizeRef.current;
            const snapped = gridConfig?.snap !== false
                ? snapToGridCenter(drag.marker.x, drag.marker.y, cell)
                : { x: drag.marker.x, y: drag.marker.y };

            gsap.to(drag.marker, { x: snapped.x, y: snapped.y, duration: 0.25, ease: "power2.out" });

            const payload = { x: snapped.x, y: snapped.y };
            if (drag.sizeOverride) payload.sizeOverride = drag.sizeOverride;

            const nearest = findNearestLocation(locationsRef.current, snapped.x, snapped.y);
            placeTokenOnBoard(
                campaignIdRef.current,
                mapIdRef.current,
                drag.tokenId,
                payload,
                nearest?.id ?? null,
            ).catch(console.error);
        };

        viewport.on("pointermove", onMove);
        viewport.on("pointerup", onUp);
        viewport.on("pointerupoutside", onUp);

        const markers = markersRef.current;
        const syncLabels = () => {
            markers.forEach((entry) => {
                if (entry.nameLabel) syncTokenNameResolution(entry.nameLabel, viewport);
            });
        };
        const unbindLabelSync = bindViewportLabelSync(viewport, syncLabels);

        return () => {
            unbindLabelSync();
            viewport.off("pointermove", onMove);
            viewport.off("pointerup", onUp);
            viewport.off("pointerupoutside", onUp);
            markers.forEach((entry) => {
                killGsapDeep(entry.marker);
                safeDestroy(entry.marker, { children: true });
            });
            markers.clear();
            safeDestroy(layer, { children: true });
            layerRef.current = null;
        };
    }, [viewport, map, mapId, gridConfig?.snap]);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer || !mapId || !map || !viewport) return;

        const mapTokens = tokenPositions[mapId] ?? {};
        const cellSize = resolveCellSize(map, gridConfig);
        const gen = ++buildGenRef.current;

        const bindMarkerUi = (marker, { movable, tokenId, hoverRing }) => {
            marker.removeAllListeners("pointerover");
            marker.removeAllListeners("pointerout");
            marker.removeAllListeners("pointerdown");

            marker.on("pointerover", () => {
                if (hoverRing) hoverRing.visible = true;
            });
            marker.on("pointerout", () => {
                if (hoverRing) hoverRing.visible = false;
            });

            if (!movable) return;

            marker.on("pointerdown", (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                viewport.plugins?.pause?.("drag");
                const wp = viewport.toWorld(e.global.x, e.global.y);
                draggingRef.current = {
                    tokenId,
                    marker,
                    offsetX: wp.x - marker.x,
                    offsetY: wp.y - marker.y,
                    sizeOverride: markersRef.current.get(tokenId)?.sizeOverride ?? null,
                };
                marker.cursor = "grabbing";
                if (hoverRing) hoverRing.visible = false;
            });
        };

        const ensureMarker = async (tokenId, pos) => {
            const char = charById.get(tokenId);
            const movable = canControlToken(char || { id: tokenId }, profile);
            const sizeKey = resolveTokenSizeKey(char, pos?.sizeOverride);
            const diameter = resolveTokenDiameter(char, cellSize, pos?.sizeOverride);
            const radius = diameter / 2;
            const color = ringColorForChar(char);
            const existing = markersRef.current.get(tokenId);
            const imageKey = tokenVisualKey(char);

            if (existing && existing.sizeKey === sizeKey && existing.imageKey === imageKey) {
                if (draggingRef.current?.tokenId !== tokenId) {
                    gsap.to(existing.marker, {
                        x: pos.x,
                        y: pos.y,
                        duration: 0.3,
                        ease: "power2.out",
                    });
                }
                existing.sizeOverride = pos?.sizeOverride ?? null;
                existing.marker.cursor = movable ? "grab" : "default";
                existing.marker.eventMode = "static";
                bindMarkerUi(existing.marker, {
                    movable,
                    tokenId,
                    hoverRing: existing.hoverRing,
                });
                if (existing.nameLabel) {
                    existing.nameLabel.text = char?.name ?? tokenId;
                    syncTokenNameResolution(existing.nameLabel, viewport);
                }
                return;
            }

            if (existing) {
                killGsapDeep(existing.marker);
                layer.removeChild(existing.marker);
                existing.marker.destroy({ children: true });
                markersRef.current.delete(tokenId);
            }

            const visual = await buildTokenVisual(char, diameter, color);
            if (gen !== buildGenRef.current || !layerRef.current) {
                visual.destroy({ children: true });
                return;
            }

            const marker = new PIXI.Container();
            const hoverRing = createHoverRing(radius);
            const nameLabel = createTokenNameLabel(char?.name ?? tokenId, radius);
            syncTokenNameResolution(nameLabel, viewport);

            marker.addChild(visual);
            marker.addChild(hoverRing);
            marker.addChild(nameLabel);

            marker.x = pos?.x ?? getMapWidth(map) / 2;
            marker.y = pos?.y ?? getMapHeight(map) / 2;
            marker.eventMode = "static";
            marker.cursor = movable ? "grab" : "default";
            marker.hitArea = new PIXI.Circle(0, 0, radius + 4);

            bindMarkerUi(marker, { movable, tokenId, hoverRing });

            layer.addChild(marker);
            markersRef.current.set(tokenId, {
                marker,
                nameLabel,
                hoverRing,
                sizeKey,
                imageKey,
                sizeOverride: pos?.sizeOverride ?? null,
            });
        };

        Object.entries(mapTokens).forEach(([tokenId, pos]) => {
            ensureMarker(tokenId, pos).catch(console.error);
        });

        markersRef.current.forEach((entry, tokenId) => {
            if (!mapTokens[tokenId]) {
                killGsapDeep(entry.marker);
                layer.removeChild(entry.marker);
                entry.marker.destroy({ children: true });
                markersRef.current.delete(tokenId);
            }
        });
    }, [tokenPositions, mapId, charById, profile, map, viewport, gridConfig]);

    return null;
}
