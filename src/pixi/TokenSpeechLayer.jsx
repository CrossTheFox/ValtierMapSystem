import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import gsap from "gsap";
import { useDispatch, useSelector } from "react-redux";
import { useViewport } from "../context/ViewportContext";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { dismissTokenSpeech, pruneExpiredTokenSpeech } from "../store/uiSlice";
import { killGsapDeep, safeDestroy } from "./pixiCleanup";
import {
    bindViewportLabelSync,
    createCrispText,
    syncScreenSpaceLabel,
} from "../utils/pixiCrispText";
import {
    resolveCellSize,
    resolveTokenDiameter,
    resolveTokenSizeKey,
} from "../utils/gridMath";

const BUBBLE_MAX_WIDTH = 220;
const BUBBLE_PAD_X = 12;
const BUBBLE_PAD_Y = 8;
const CLOSE_HIT = 18;

function buildSpeechBubble(text, onClose) {
    const root = new PIXI.Container();
    root.eventMode = "static";
    root.cursor = "default";

    const body = createCrispText(text, {
        fontSize: 13,
        fontWeight: "500",
        align: "left",
        wordWrap: true,
        wordWrapWidth: BUBBLE_MAX_WIDTH - BUBBLE_PAD_X * 2 - 16,
        stroke: { color: 0x0a0a12, width: 3, join: "round" },
        fill: 0xffffff,
    });
    body.anchor.set(0, 0);

    const tw = body.width;
    const th = body.height;
    const w = Math.min(BUBBLE_MAX_WIDTH, tw + BUBBLE_PAD_X * 2 + 16);
    const h = th + BUBBLE_PAD_Y * 2 + 4;

    const bg = new PIXI.Graphics();
    bg.lineStyle(1.5, 0xff66ff, 0.75);
    bg.beginFill(0x12121a, 0.92);
    bg.drawRoundedRect(-w / 2, -h, w, h, 8);
    bg.endFill();
    // Tail
    bg.beginFill(0x12121a, 0.92);
    bg.drawPolygon([-6, 0, 0, 8, 6, 0]);
    bg.endFill();

    body.x = -w / 2 + BUBBLE_PAD_X;
    body.y = -h + BUBBLE_PAD_Y;

    const close = createCrispText("×", {
        fontSize: 16,
        fontWeight: "700",
        fill: 0xff66ff,
        stroke: { color: 0x000000, width: 2, join: "round" },
    });
    close.anchor.set(0.5);
    close.x = w / 2 - 12;
    close.y = -h + 12;
    close.eventMode = "static";
    close.cursor = "pointer";
    close.hitArea = new PIXI.Rectangle(-CLOSE_HIT / 2, -CLOSE_HIT / 2, CLOSE_HIT, CLOSE_HIT);
    close.on("pointertap", (e) => {
        e.stopPropagation();
        onClose?.();
    });

    root.addChild(bg, body, close);
    root.alpha = 0;
    gsap.to(root, { alpha: 1, duration: 0.18, ease: "power2.out" });

    return { root, body, bg };
}

export default function TokenSpeechLayer() {
    const viewport = useViewport();
    const dispatch = useDispatch();
    const tokenSpeech = useSelector((s) => s.ui.tokenSpeech);
    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});

    const layerRef = useRef(null);
    const bubblesRef = useRef(new Map());

    useEffect(() => {
        if (!viewport || !map) return;
        const layer = new PIXI.Container();
        layer.label = "TokenSpeechLayer";
        layer.zIndex = RENDER_LAYERS.LABELS;
        layer.sortableChildren = true;
        viewport.addChild(layer);
        layerRef.current = layer;

        const syncAll = () => {
            bubblesRef.current.forEach((entry) => {
                if (entry.bubble) syncScreenSpaceLabel(entry.bubble, viewport);
            });
        };
        const unbind = bindViewportLabelSync(viewport, syncAll);

        return () => {
            unbind();
            bubblesRef.current.forEach((entry) => {
                killGsapDeep(entry.anchor);
                safeDestroy(entry.anchor, { children: true });
            });
            bubblesRef.current.clear();
            safeDestroy(layer, { children: true });
            layerRef.current = null;
        };
    }, [viewport, map]);

    // Prune expired speeches on a short interval
    useEffect(() => {
        const id = setInterval(() => {
            dispatch(pruneExpiredTokenSpeech());
        }, 500);
        return () => clearInterval(id);
    }, [dispatch]);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer || !mapId || !viewport) return;

        const mapTokens = tokenPositions[mapId] ?? {};
        const cellSize = resolveCellSize(map, gridConfig);
        const charById = new Map();
        Object.values(charactersById || {}).forEach((c) => {
            if (c?.id) charById.set(c.id, c);
        });
        Object.values(locations || {}).forEach((loc) => {
            (loc.characters || []).forEach((c) => {
                if (c?.id) charById.set(c.id, c);
            });
        });

        const activeIds = new Set(Object.keys(tokenSpeech || {}));

        // Remove stale bubbles
        bubblesRef.current.forEach((entry, charId) => {
            if (!activeIds.has(charId) || !mapTokens[charId]) {
                killGsapDeep(entry.anchor);
                layer.removeChild(entry.anchor);
                safeDestroy(entry.anchor, { children: true });
                bubblesRef.current.delete(charId);
            }
        });

        Object.entries(tokenSpeech || {}).forEach(([charId, speech]) => {
            const pos = mapTokens[charId];
            if (!pos || !speech?.text) return;

            const char = charById.get(charId);
            const sizeKey = resolveTokenSizeKey(char, pos?.sizeOverride);
            const diameter = resolveTokenDiameter(char, cellSize, pos?.sizeOverride);
            const radius = diameter / 2;
            const existing = bubblesRef.current.get(charId);

            if (existing && existing.messageId === speech.messageId) {
                existing.anchor.x = pos.x;
                existing.anchor.y = pos.y;
                existing.bubble._tokenRadius = radius;
                existing.bubble._screenPad = 14;
                existing.bubble._anchor = "above";
                syncScreenSpaceLabel(existing.bubble, viewport);
                return;
            }

            if (existing) {
                killGsapDeep(existing.anchor);
                layer.removeChild(existing.anchor);
                safeDestroy(existing.anchor, { children: true });
                bubblesRef.current.delete(charId);
            }

            const { root: bubble } = buildSpeechBubble(speech.text, () => {
                dispatch(dismissTokenSpeech(charId));
            });
            bubble._tokenRadius = radius;
            bubble._screenPad = 14;
            bubble._anchor = "above";

            const anchor = new PIXI.Container();
            anchor.x = pos.x;
            anchor.y = pos.y;
            anchor.zIndex = 10;
            anchor.addChild(bubble);
            syncScreenSpaceLabel(bubble, viewport);
            layer.addChild(anchor);
            bubblesRef.current.set(charId, {
                anchor,
                bubble,
                messageId: speech.messageId,
            });
        });
    }, [tokenSpeech, tokenPositions, mapId, map, gridConfig, locations, charactersById, viewport, dispatch]);

    return null;
}
