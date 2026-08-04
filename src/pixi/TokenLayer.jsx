import { useEffect, useRef, useMemo } from "react";
import * as PIXI from "pixi.js";
import gsap from "gsap";
import { useDispatch, useSelector } from "react-redux";
import { useViewport } from "../context/ViewportContext";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { killGsapDeep, safeDestroy } from "./pixiCleanup";
import { placeTokenOnBoard, placeTokensOnBoard } from "../../firebase/services/gameService";
import { loadTexture } from "../../firebase/services/assetLoader";
import {
    resolveCellSize,
    snapToGridCenter,
    resolveTokenDiameter,
    resolveTokenSizeKey,
    getMapWidth,
    getMapHeight,
} from "../utils/gridMath";
import { canControlToken, findNearestLocation, isDmRole } from "../utils/tokenControl";
import { bindViewportLabelSync } from "../utils/pixiCrispText";
import { applyTokenImageFit, tokenVisualKey } from "../utils/tokenImageFit";
import {
    clearTokenSelection,
    openContextMenu,
    setSelectedTokenIds,
} from "../store/uiSlice";
import {
    TOKEN_CONDITIONS,
    normalizeTokenConditions,
} from "../constants/tokenConditions";

const HOVER_CYAN = 0x00f2ea;
const SELECT_MAGENTA = 0xff66ff;
const SELECT_CYAN = 0x00f2ea;
const HIDDEN_ALPHA = 0.45;
const MARQUEE_MIN_PX = 6;

function ringColorForChar(char) {
    if (!char) return 0x888899;
    if (char.isNpc || char.isEnemy) return 0xff4444;
    return HOVER_CYAN;
}

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

/**
 * Selection chrome: thin grid-aligned square — soft cyber frame (Pixi v8).
 */
function paintSelectSquare(g, radius) {
    g.clear();
    const pad = Math.max(1, radius * 0.04);
    const half = radius - pad;
    const side = half * 2;
    const lw = Math.max(1.1, radius * 0.05);
    const arm = Math.max(3.5, radius * 0.2);

    // Whisper of fill
    g.rect(-half, -half, side, side);
    g.fill({ color: SELECT_MAGENTA, alpha: 0.05 });

    // Single thin magenta square
    g.rect(-half, -half, side, side);
    g.stroke({ width: lw, color: SELECT_MAGENTA, alpha: 0.75 });

    // Soft cyan hairline inset
    const inset = Math.max(2, radius * 0.08);
    g.rect(-half + inset, -half + inset, side - inset * 2, side - inset * 2);
    g.stroke({ width: Math.max(0.9, lw * 0.65), color: SELECT_CYAN, alpha: 0.35 });

    // Delicate corner tips (round caps — less blocky)
    const x0 = -half;
    const y0 = -half;
    const x1 = half;
    const y1 = half;
    const corner = { width: lw * 1.15, color: SELECT_MAGENTA, alpha: 0.95, cap: "round", join: "round" };
    g.moveTo(x0, y0 + arm);
    g.lineTo(x0, y0);
    g.lineTo(x0 + arm, y0);
    g.stroke(corner);
    g.moveTo(x1 - arm, y0);
    g.lineTo(x1, y0);
    g.lineTo(x1, y0 + arm);
    g.stroke(corner);
    g.moveTo(x1, y1 - arm);
    g.lineTo(x1, y1);
    g.lineTo(x1 - arm, y1);
    g.stroke(corner);
    g.moveTo(x0 + arm, y1);
    g.lineTo(x0, y1);
    g.lineTo(x0, y1 - arm);
    g.stroke(corner);
}

function createSelectRing(radius) {
    const g = new PIXI.Graphics();
    g.eventMode = "none";
    g.visible = false;
    g.alpha = 1;
    paintSelectSquare(g, radius);
    return g;
}

function prefersReducedMotion() {
    return typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/** Gentle alpha breath while selected. */
function startSelectPulse(g) {
    if (!g) return;
    gsap.killTweensOf(g);
    if (prefersReducedMotion()) {
        g.alpha = 0.9;
        return;
    }
    g.alpha = 0.95;
    gsap.to(g, {
        alpha: 0.48,
        duration: 1.25,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
    });
}

function stopSelectPulse(g) {
    if (!g) return;
    gsap.killTweensOf(g);
    g.alpha = 1;
}

function setSelectChrome(entry, on, radiusHint = 0) {
    if (!entry?.selectRing) return;
    const r = radiusHint
        || entry.radius
        || (entry.marker?.hitArea?.radius != null ? Math.max(4, entry.marker.hitArea.radius - 4) : 0);
    if (on && r > 0) {
        entry.radius = r;
        paintSelectSquare(entry.selectRing, r);
        entry.selectRing.visible = true;
        if (entry.hoverRing) entry.hoverRing.visible = false;
        startSelectPulse(entry.selectRing);
    } else {
        stopSelectPulse(entry.selectRing);
        entry.selectRing.visible = false;
    }
}

function createConditionBadges(conditions, radius) {
    const root = new PIXI.Container();
    root.eventMode = "none";
    const list = normalizeTokenConditions(conditions);
    if (list.length === 0) return root;

    const byKey = Object.fromEntries(TOKEN_CONDITIONS.map((c) => [c.key, c]));
    const fontSize = Math.max(8, Math.round(radius * 0.28));
    let x = -radius * 0.9;
    const y = -radius - fontSize - 2;

    list.forEach((key) => {
        const def = byKey[key];
        if (!def) return;
        const bg = new PIXI.Graphics();
        const label = new PIXI.Text({
            text: def.short,
            style: {
                fontFamily: "Fira Code, monospace",
                fontSize,
                fontWeight: "700",
                fill: 0x0a0a12,
            },
        });
        label.anchor.set(0.5);
        const padX = 3;
        const w = label.width + padX * 2;
        const h = label.height + 2;
        bg.beginFill(0xff66ff, 0.92);
        bg.drawRoundedRect(0, 0, w, h, 2);
        bg.endFill();
        bg.x = x;
        bg.y = y;
        label.x = x + w / 2;
        label.y = y + h / 2;
        root.addChild(bg);
        root.addChild(label);
        x += w + 2;
    });
    return root;
}

function createHiddenBadge(radius) {
    const g = new PIXI.Container();
    g.eventMode = "none";
    const fontSize = Math.max(8, Math.round(radius * 0.28));
    const label = new PIXI.Text({
        text: "HID",
        style: {
            fontFamily: "Fira Code, monospace",
            fontSize,
            fontWeight: "700",
            fill: 0x0a0a12,
        },
    });
    label.anchor.set(0.5);
    const padX = 3;
    const w = label.width + padX * 2;
    const h = label.height + 2;
    const bg = new PIXI.Graphics();
    bg.beginFill(0x888899, 0.95);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 2);
    bg.endFill();
    bg.x = radius * 0.55;
    bg.y = -radius * 0.7;
    label.x = bg.x;
    label.y = bg.y;
    g.addChild(bg);
    g.addChild(label);
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

function buildPositionPayload(entry, x, y) {
    const payload = { x, y };
    if (entry.sizeOverride) payload.sizeOverride = entry.sizeOverride;
    const conditions = normalizeTokenConditions(entry.conditions);
    if (conditions.length) payload.conditions = conditions;
    if (entry.visible === false) payload.visible = false;
    return payload;
}

export default function TokenLayer() {
    const viewport = useViewport();
    const dispatch = useDispatch();

    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const profile = useSelector((s) => s.player.profile);
    const selectedTokenIds = useSelector((s) => s.ui.selectedTokenIds ?? []);
    const rulerActive = useSelector((s) => !!s.ui.rulerTool?.active);
    const isSelectingPosition = useSelector((s) => !!s.ui.isSelectingPosition);

    const layerRef = useRef(null);
    const marqueeRef = useRef(null);
    const markersRef = useRef(new Map());
    const draggingRef = useRef(null);
    const marqueeDragRef = useRef(null);
    const selectedRef = useRef(selectedTokenIds);
    const profileRef = useRef(profile);
    const rulerRef = useRef(rulerActive);
    const selectPosRef = useRef(isSelectingPosition);
    const campaignIdRef = useRef(campaignId);
    const mapIdRef = useRef(mapId);
    const cellSizeRef = useRef(resolveCellSize(map, gridConfig));
    const locationsRef = useRef(locations);
    const charByIdRef = useRef(new Map());
    const buildGenRef = useRef(0);

    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);
    useEffect(() => { mapIdRef.current = mapId; }, [mapId]);
    useEffect(() => {
        cellSizeRef.current = resolveCellSize(map, gridConfig);
    }, [map, gridConfig]);
    useEffect(() => { locationsRef.current = locations; }, [locations]);
    useEffect(() => { selectedRef.current = selectedTokenIds; }, [selectedTokenIds]);
    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { rulerRef.current = rulerActive; }, [rulerActive]);
    useEffect(() => { selectPosRef.current = isSelectingPosition; }, [isSelectingPosition]);

    // Clear selection when map changes
    useEffect(() => {
        dispatch(clearTokenSelection());
    }, [mapId, dispatch]);

    const charById = useMemo(() => {
        const m = new Map();
        Object.values(charactersById || {}).forEach((c) => {
            if (c?.id) m.set(c.id, c);
        });
        Object.values(locations || {}).forEach((loc) => {
            (loc.characters || []).forEach((c) => {
                if (c?.id) m.set(c.id, c);
            });
        });
        return m;
    }, [charactersById, locations]);
    useEffect(() => { charByIdRef.current = charById; }, [charById]);

    const isDm = isDmRole(profile?.role);

    // Sync selection chrome — soft square + optional pulse
    useEffect(() => {
        const selected = new Set(selectedTokenIds);
        markersRef.current.forEach((entry, id) => {
            setSelectChrome(entry, selected.has(id));
        });
    }, [selectedTokenIds]);

    useEffect(() => {
        if (!viewport || !map || !mapId) return;

        const layer = new PIXI.Container();
        layer.label = "TokenLayer";
        layer.zIndex = RENDER_LAYERS.TOKENS;
        layer.sortableChildren = true;
        viewport.addChild(layer);
        layerRef.current = layer;

        const marquee = new PIXI.Graphics();
        marquee.eventMode = "none";
        marquee.zIndex = 9999;
        layer.addChild(marquee);
        marqueeRef.current = marquee;

        const onMove = (e) => {
            const drag = draggingRef.current;
            if (drag) {
                const wp = viewport.toWorld(e.global.x, e.global.y);
                const nx = wp.x - drag.offsetX;
                const ny = wp.y - drag.offsetY;
                const dx = nx - drag.originX;
                const dy = ny - drag.originY;
                for (const m of drag.members) {
                    m.marker.x = m.startX + dx;
                    m.marker.y = m.startY + dy;
                }
                return;
            }

            const mq = marqueeDragRef.current;
            if (mq) {
                const wp = viewport.toWorld(e.global.x, e.global.y);
                mq.curX = wp.x;
                mq.curY = wp.y;
                const g = marqueeRef.current;
                if (!g) return;
                const x1 = Math.min(mq.startX, mq.curX);
                const y1 = Math.min(mq.startY, mq.curY);
                const w = Math.abs(mq.curX - mq.startX);
                const h = Math.abs(mq.curY - mq.startY);
                g.clear();
                const lw = 1.5 / (viewport.scale?.x || 1);
                g.rect(x1, y1, w, h);
                g.fill({ color: SELECT_MAGENTA, alpha: 0.1 });
                g.rect(x1, y1, w, h);
                g.stroke({ width: lw, color: SELECT_MAGENTA, alpha: 0.95 });
                g.rect(x1, y1, w, h);
                g.stroke({ width: lw * 0.55, color: SELECT_CYAN, alpha: 0.7 });
            }
        };

        const finishMarquee = (e) => {
            const mq = marqueeDragRef.current;
            marqueeDragRef.current = null;
            const g = marqueeRef.current;
            if (g) g.clear();
            if (!mq) return;

            const x1 = Math.min(mq.startX, mq.curX);
            const y1 = Math.min(mq.startY, mq.curY);
            const x2 = Math.max(mq.startX, mq.curX);
            const y2 = Math.max(mq.startY, mq.curY);
            const worldW = Math.abs(mq.curX - mq.startX);
            const worldH = Math.abs(mq.curY - mq.startY);
            const scale = viewport.scale?.x || 1;
            if (worldW * scale < MARQUEE_MIN_PX && worldH * scale < MARQUEE_MIN_PX) {
                if (!e.shiftKey) dispatch(clearTokenSelection());
                return;
            }

            const profileNow = profileRef.current;
            const hits = [];
            markersRef.current.forEach((entry, tokenId) => {
                const char = charByIdRef.current.get(tokenId);
                if (!canControlToken(char || { id: tokenId }, profileNow)) return;
                const mx = entry.marker.x;
                const my = entry.marker.y;
                if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) hits.push(tokenId);
            });

            if (e.shiftKey) {
                const set = new Set(selectedRef.current);
                hits.forEach((id) => set.add(id));
                dispatch(setSelectedTokenIds([...set]));
            } else {
                dispatch(setSelectedTokenIds(hits));
            }
        };

        const onUp = (e) => {
            if (e.button !== 0) return;

            if (marqueeDragRef.current) {
                finishMarquee(e);
                return;
            }

            const drag = draggingRef.current;
            if (!drag) return;
            draggingRef.current = null;
            viewport.plugins?.resume?.("drag");

            const cell = cellSizeRef.current;
            const snapOn = gridConfig?.snap !== false;
            const updates = [];

            for (const m of drag.members) {
                m.marker.cursor = "grab";
                const snapped = snapOn
                    ? snapToGridCenter(m.marker.x, m.marker.y, cell)
                    : { x: m.marker.x, y: m.marker.y };
                gsap.to(m.marker, { x: snapped.x, y: snapped.y, duration: 0.25, ease: "power2.out" });
                const nearest = findNearestLocation(locationsRef.current, snapped.x, snapped.y);
                updates.push({
                    tokenId: m.tokenId,
                    position: buildPositionPayload(m, snapped.x, snapped.y),
                    locationId: nearest?.id ?? null,
                });
            }

            const cid = campaignIdRef.current;
            const mid = mapIdRef.current;
            if (updates.length === 1) {
                const u = updates[0];
                placeTokenOnBoard(cid, mid, u.tokenId, u.position, u.locationId).catch(console.error);
            } else if (updates.length > 1) {
                placeTokensOnBoard(cid, mid, updates).catch(console.error);
            }
        };

        const onViewportDown = (e) => {
            if (e.button !== 0) return;
            if (rulerRef.current || selectPosRef.current) return;
            if (draggingRef.current) return;
            // Only start marquee if the event wasn't claimed by a token
            if (e.target && e.target !== viewport && e.target !== viewport.children?.[0]) {
                // Tokens stopPropagation; empty map hits the viewport itself
            }
            // Pixi: clicks on empty space typically hit the viewport
            const hitToken = e.target?.label === "tokenMarker"
                || (e.target?.parent && markersRef.current.has?.(e.target.parent.__tokenId));
            // Simpler: if any marker is the target chain
            let t = e.target;
            let onToken = false;
            while (t && t !== viewport) {
                if (t.__tokenId) { onToken = true; break; }
                t = t.parent;
            }
            if (onToken) return;

            const wp = viewport.toWorld(e.global.x, e.global.y);
            marqueeDragRef.current = {
                startX: wp.x,
                startY: wp.y,
                curX: wp.x,
                curY: wp.y,
            };
        };

        viewport.on("pointerdown", onViewportDown);
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
            viewport.off("pointerdown", onViewportDown);
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
            marqueeRef.current = null;
        };
    }, [viewport, map, mapId, gridConfig?.snap, dispatch]);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer || !mapId || !map || !viewport) return;

        const mapTokens = tokenPositions[mapId] ?? {};
        const cellSize = resolveCellSize(map, gridConfig);
        const gen = ++buildGenRef.current;
        const dm = isDmRole(profile?.role);

        const bindMarkerUi = (marker, { movable, selectable, tokenId, hoverRing, char }) => {
            marker.removeAllListeners("pointerover");
            marker.removeAllListeners("pointerout");
            marker.removeAllListeners("pointerdown");

            marker.on("pointerover", () => {
                if (hoverRing && !selectedRef.current.includes(tokenId)) hoverRing.visible = true;
            });
            marker.on("pointerout", () => {
                if (hoverRing) hoverRing.visible = false;
            });

            marker.on("pointerdown", (e) => {
                if (e.button === 2) {
                    e.stopPropagation();
                    dispatch(openContextMenu({
                        screenX: e.global.x,
                        screenY: e.global.y,
                        worldX: marker.x,
                        worldY: marker.y,
                        type: "token",
                        location: null,
                        tokenId,
                        tokenName: char?.name ?? tokenId,
                    }));
                    return;
                }
                if (e.button !== 0) return;
                if (!selectable && !movable) return;
                e.stopPropagation();

                const selected = selectedRef.current;
                let nextIds;
                if (e.shiftKey) {
                    nextIds = selected.includes(tokenId)
                        ? selected.filter((id) => id !== tokenId)
                        : selectable ? [...selected, tokenId] : selected;
                    dispatch(setSelectedTokenIds(nextIds));
                    return;
                }

                if (!selected.includes(tokenId)) {
                    nextIds = selectable ? [tokenId] : [];
                } else {
                    nextIds = selected;
                }
                dispatch(setSelectedTokenIds(nextIds));

                if (!movable) return;

                const dragIds = nextIds.filter((id) => {
                    const c = charByIdRef.current.get(id);
                    return canControlToken(c || { id }, profileRef.current);
                });
                if (!dragIds.includes(tokenId)) dragIds.push(tokenId);

                const members = [];
                for (const id of dragIds) {
                    const entry = markersRef.current.get(id);
                    if (!entry) continue;
                    members.push({
                        tokenId: id,
                        marker: entry.marker,
                        startX: entry.marker.x,
                        startY: entry.marker.y,
                        sizeOverride: entry.sizeOverride ?? null,
                        conditions: entry.conditions ?? [],
                        visible: entry.visible,
                    });
                    entry.marker.cursor = "grabbing";
                }
                if (members.length === 0) return;

                const primary = members.find((m) => m.tokenId === tokenId) || members[0];
                const wp = viewport.toWorld(e.global.x, e.global.y);
                viewport.plugins?.pause?.("drag");
                draggingRef.current = {
                    offsetX: wp.x - primary.marker.x,
                    offsetY: wp.y - primary.marker.y,
                    originX: primary.marker.x,
                    originY: primary.marker.y,
                    members,
                };
                if (hoverRing) hoverRing.visible = false;
            });
        };

        const ensureMarker = async (tokenId, pos) => {
            const visible = pos?.visible !== false;
            if (!dm && !visible) {
                const existing = markersRef.current.get(tokenId);
                if (existing) {
                    killGsapDeep(existing.marker);
                    layer.removeChild(existing.marker);
                    existing.marker.destroy({ children: true });
                    markersRef.current.delete(tokenId);
                }
                return;
            }

            const char = charById.get(tokenId);
            const movable = canControlToken(char || { id: tokenId }, profile);
            const selectable = movable; // plan: canControlToken or DM (DM already in canControl)
            const sizeKey = resolveTokenSizeKey(char, pos?.sizeOverride);
            const diameter = resolveTokenDiameter(char, cellSize, pos?.sizeOverride);
            const radius = diameter / 2;
            const color = ringColorForChar(char);
            const conditions = normalizeTokenConditions(pos?.conditions);
            const condKey = conditions.join(",");
            const existing = markersRef.current.get(tokenId);
            const imageKey = tokenVisualKey(char);
            const metaKey = `${sizeKey}|${imageKey}|${condKey}|${visible ? 1 : 0}`;

            if (existing && existing.metaKey === metaKey) {
                const draggingIds = draggingRef.current?.members?.map((m) => m.tokenId) ?? [];
                if (!draggingIds.includes(tokenId)) {
                    gsap.to(existing.marker, {
                        x: pos.x,
                        y: pos.y,
                        duration: 0.3,
                        ease: "power2.out",
                    });
                }
                existing.sizeOverride = pos?.sizeOverride ?? null;
                existing.conditions = conditions;
                existing.visible = visible;
                existing.marker.alpha = !visible && dm ? HIDDEN_ALPHA : 1;
                existing.marker.cursor = movable ? "grab" : "default";
                existing.marker.eventMode = "static";
                bindMarkerUi(existing.marker, {
                    movable,
                    selectable,
                    tokenId,
                    hoverRing: existing.hoverRing,
                    char,
                });
                if (existing.selectRing) {
                    setSelectChrome(existing, selectedRef.current.includes(tokenId), radius);
                }
                existing.radius = radius;
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

            const selectRing = createSelectRing(radius);
            const marker = new PIXI.Container();
            marker.__tokenId = tokenId;
            marker.label = "tokenMarker";
            const hoverRing = createHoverRing(radius);
            const nameLabel = createTokenNameLabel(char?.name ?? tokenId, radius);
            syncTokenNameResolution(nameLabel, viewport);
            const condBadges = createConditionBadges(conditions, radius);

            marker.addChild(visual);
            marker.addChild(selectRing);
            marker.addChild(hoverRing);
            marker.addChild(condBadges);
            marker.addChild(nameLabel);
            if (!visible && dm) {
                marker.addChild(createHiddenBadge(radius));
                marker.alpha = HIDDEN_ALPHA;
            }

            marker.x = pos?.x ?? getMapWidth(map) / 2;
            marker.y = pos?.y ?? getMapHeight(map) / 2;
            marker.eventMode = "static";
            marker.cursor = movable ? "grab" : "default";
            marker.hitArea = new PIXI.Circle(0, 0, radius + 4);

            bindMarkerUi(marker, { movable, selectable, tokenId, hoverRing, char });

            layer.addChild(marker);
            markersRef.current.set(tokenId, {
                marker,
                nameLabel,
                hoverRing,
                selectRing,
                radius,
                sizeKey,
                imageKey,
                metaKey,
                sizeOverride: pos?.sizeOverride ?? null,
                conditions,
                visible,
            });
            setSelectChrome(markersRef.current.get(tokenId), selectedRef.current.includes(tokenId), radius);
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
    }, [tokenPositions, mapId, charById, profile, map, viewport, gridConfig, dispatch, isDm]);

    return null;
}
