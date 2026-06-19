import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import gsap from "gsap";
import { useSelector } from "react-redux";
import { useViewport } from "../context/ViewportContext";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { createPixiTooltip } from "./PixiTooltip";
import { killGsapDeep, safeDestroy } from "./pixiCleanup";
import { updatePartyPosition } from "../../firebase/services/gameService";

const GOLD      = 0xffd700;
const GOLD_DIM  = 0xff9900;

function buildMarkerGraphics() {
    const container = new PIXI.Container();

    // Outer pulsing ring
    const ring = new PIXI.Graphics();
    ring.lineStyle(2, GOLD, 0.7);
    ring.drawCircle(0, 0, 18);
    container.addChild(ring);

    // Glow halo
    const halo = new PIXI.Graphics();
    halo.lineStyle(6, GOLD_DIM, 0.2);
    halo.drawCircle(0, 0, 24);
    container.addChild(halo);

    // Solid inner circle
    const inner = new PIXI.Graphics();
    inner.beginFill(GOLD, 0.9);
    inner.drawCircle(0, 0, 10);
    inner.endFill();
    container.addChild(inner);

    // Crosshair ticks
    const cross = new PIXI.Graphics();
    cross.lineStyle(1.5, GOLD, 0.8);
    cross.moveTo(-24, 0); cross.lineTo(-6, 0);
    cross.moveTo(6,   0); cross.lineTo(24, 0);
    cross.moveTo(0, -24); cross.lineTo(0, -6);
    cross.moveTo(0,   6); cross.lineTo(0, 24);
    container.addChild(cross);

    // Sword label
    const label = new PIXI.Text("⚔", { fontFamily: "Arial", fontSize: 10, fill: 0x000000 });
    label.anchor.set(0.5);
    container.addChild(label);

    // GSAP animations
    gsap.to(ring,  { alpha: 0.25, duration: 1.3, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(halo,  { alpha: 0,    duration: 1.3, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(container.scale, { x: 1.07, y: 1.07, duration: 2, repeat: -1, yoyo: true, ease: "sine.inOut" });

    return container;
}

export default function PartyLayer() {
    const viewport       = useViewport();
    const partyPositions = useSelector((s) => s.game?.partyPositions ?? {});
    const campaignId     = useSelector((s) => s.world.selectedCampaignId);
    const mapId          = useSelector((s) => s.world.map?.id);
    const map            = useSelector((s) => s.world.map);

    const layerRef       = useRef(null);
    const markerRef      = useRef(null);
    const isDraggingRef  = useRef(false);
    const dragOffsetRef  = useRef({ x: 0, y: 0 });
    const campaignIdRef  = useRef(campaignId);
    const mapIdRef       = useRef(mapId);

    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);
    useEffect(() => { mapIdRef.current      = mapId;      }, [mapId]);

    // ── Build layer + marker when viewport / map are ready ────────
    useEffect(() => {
        if (!viewport || !map) return;

        const layer = new PIXI.Container();
        layer.name   = "PartyLayer";
        layer.zIndex = RENDER_LAYERS.PARTY;
        viewport.addChild(layer);
        layerRef.current = layer;

        const marker       = buildMarkerGraphics();
        marker.eventMode   = "static";
        marker.cursor      = "grab";
        marker.hitArea     = new PIXI.Circle(0, 0, 26);

        // Start at saved position or map centre
        const initPos = partyPositions[map.id];
        marker.x = initPos?.x ?? map.width  / 2;
        marker.y = initPos?.y ?? map.height / 2;

        // Tooltip
        const tooltip = createPixiTooltip({ text: "PARTY" });
        marker.addChild(tooltip.container);
        marker.on("pointerover", () => { if (!isDraggingRef.current) tooltip.show(); });
        marker.on("pointerout",  () => tooltip.hide());

        // Drag: start
        const onMarkerDown = (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            isDraggingRef.current = true;
            marker.cursor         = "grabbing";
            tooltip.hide();
            viewport.plugins?.pause?.("drag");
            const wp = viewport.toWorld(e.global.x, e.global.y);
            dragOffsetRef.current = { x: wp.x - marker.x, y: wp.y - marker.y };
        };

        // Drag: move (attached to viewport so pointer can leave the token)
        const onViewportMove = (e) => {
            if (!isDraggingRef.current) return;
            const wp = viewport.toWorld(e.global.x, e.global.y);
            marker.x = wp.x - dragOffsetRef.current.x;
            marker.y = wp.y - dragOffsetRef.current.y;
        };

        // Drag: end
        const onViewportUp = (e) => {
            if (!isDraggingRef.current || e.button !== 0) return;
            isDraggingRef.current = false;
            marker.cursor         = "grab";
            viewport.plugins?.resume?.("drag");
            updatePartyPosition(
                campaignIdRef.current,
                mapIdRef.current,
                { x: marker.x, y: marker.y },
            ).catch(console.error);
        };

        marker.on("pointerdown", onMarkerDown);
        viewport.on("pointermove", onViewportMove);
        viewport.on("pointerup",   onViewportUp);

        layer.addChild(marker);
        markerRef.current = marker;

        return () => {
            marker.off("pointerdown", onMarkerDown);
            viewport.off("pointermove", onViewportMove);
            viewport.off("pointerup",   onViewportUp);
            killGsapDeep(marker);
            safeDestroy(layer, { children: true });
            layerRef.current  = null;
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewport, map]);

    // ── Sync Firestore position → marker (when not dragging) ─────
    useEffect(() => {
        const marker = markerRef.current;
        if (!marker || !mapId || isDraggingRef.current) return;
        const pos = partyPositions[mapId];
        if (!pos) return;
        marker.x = pos.x;
        marker.y = pos.y;
    }, [partyPositions, mapId]);

    return null;
}
