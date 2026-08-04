import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useSelector, useDispatch } from "react-redux";
import {
    openContextMenu,
    setRulerDraftA,
    clearRulerDraft,
} from "../store/uiSlice";
import { useViewport } from "../context/ViewportContext";
import { createPixiTooltip } from "./PixiTooltip";
import { killGsapDeep, safeDestroy } from "./pixiCleanup";
import { lerpColor } from "../helpers/colors";
import { RENDER_LAYERS } from "../constants/renderLayers";
import { UI_COLORS } from "../constants/uiColors";
import { buildRulerMeasure, snapWorldToGridPoint } from "../utils/gridMath";
import { addMapRuler } from "../../firebase/services/gameService";
import gsap from "gsap";

import locationIconPath from "../assets/LocationNode.svg";

const RIGHT_CLICK_DRAG_THRESHOLD = 5;

const getHex = (color) => {
    if (typeof color === "number") return color;
    return new PIXI.Color(color).toNumber();
};

const NORMAL_TINT = getHex(UI_COLORS.accent       || "#ff66ff");
const HOVER_TINT  = getHex(UI_COLORS.accentStrong || "#ff1493");

function destroyLocationMarker(entry) {
    const { container, icon, colorState } = entry;
    container.removeAllListeners();
    killGsapDeep(icon);
    killGsapDeep(icon?.scale);
    killGsapDeep(colorState);
    safeDestroy(container, { children: true });
}

function createLocationMarker(locId, texture, dispatch, rulerRef, locationsRef, sessionRef) {
    const locationContainer = new PIXI.Container();
    locationContainer.eventMode = "static";
    locationContainer.cursor    = "pointer";
    locationContainer.hitArea   = new PIXI.Circle(0, 0, 40);

    const icon = new PIXI.Sprite(texture);
    icon.anchor.set(0.5);
    const BASE_SCALE = 1;
    icon.scale.set(BASE_SCALE);
    icon.tint = NORMAL_TINT;

    gsap.to(icon.scale, {
        x: BASE_SCALE + 0.05,
        y: BASE_SCALE + 0.05,
        duration: 2 + Math.random(),
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
    });

    gsap.to(icon, {
        rotation: Math.PI * 2,
        duration: 20 + Math.random() * 10,
        repeat: -1,
        ease: "none",
    });

    const tooltip    = createPixiTooltip({ text: "" });
    const colorState = { t: 0 };

    locationContainer.on("pointerover", () => {
        gsap.killTweensOf(colorState);
        gsap.to(colorState, {
            t: 1, duration: 0.3, ease: "power2.out",
            onUpdate: () => { icon.tint = lerpColor(NORMAL_TINT, HOVER_TINT, colorState.t); },
        });
        tooltip.show();
    });

    locationContainer.on("pointerout", () => {
        gsap.killTweensOf(colorState);
        gsap.to(colorState, {
            t: 0, duration: 0.3, ease: "power2.out",
            onUpdate: () => { icon.tint = lerpColor(NORMAL_TINT, HOVER_TINT, colorState.t); },
        });
        tooltip.hide();
    });

    let pressStart = null;

    const openLocationMenu = (event, loc) => {
        dispatch(openContextMenu({
            screenX:  event.global.x,
            screenY:  event.global.y,
            worldX:   loc.position.x,
            worldY:   loc.position.y,
            type:     "location",
            location: loc,
        }));
        tooltip.hide();
    };

    locationContainer.on("pointerdown", (event) => {
        event.stopPropagation();
        const loc = locationsRef.current?.[locId];
        if (!loc) return;

        if (event.button === 2) {
            pressStart = { x: event.global.x, y: event.global.y, button: 2 };
            return;
        }

        if (event.button !== 0) return;

        const ruler = rulerRef.current;
        if (ruler?.active && loc.position) {
            const session = sessionRef.current || {};
            const point = snapWorldToGridPoint(
                loc.position.x,
                loc.position.y,
                session.map,
                session.gridConfig,
            );
            if (!ruler.draftA) {
                dispatch(setRulerDraftA(point));
            } else if (session.campaignId && session.mapId) {
                const measure = buildRulerMeasure(ruler.draftA, point, session.map);
                addMapRuler(session.campaignId, {
                    mapId: session.mapId,
                    a: ruler.draftA,
                    b: point,
                    straight: measure.straight,
                    diagonal: measure.diagonal,
                    totalCells: measure.totalCells,
                    meters: measure.meters,
                    distanceLabel: measure.distanceLabel,
                    createdBy: session.uid ?? null,
                    createdByName: session.nickname ?? null,
                }).catch(console.error);
                dispatch(clearRulerDraft());
            }
            return;
        }

        pressStart = { x: event.global.x, y: event.global.y, button: 0 };
    });

    locationContainer.on("pointerup", (event) => {
        event.stopPropagation();
        const loc = locationsRef.current?.[locId];
        if (!loc || !pressStart) return;
        if (event.button !== pressStart.button) return;
        const dist = Math.hypot(
            event.global.x - pressStart.x,
            event.global.y - pressStart.y,
        );
        const button = pressStart.button;
        pressStart = null;
        if (dist >= RIGHT_CLICK_DRAG_THRESHOLD) return;
        if (button !== 0 && button !== 2) return;

        // Cancel in-progress ruler instead of opening the location menu
        const ruler = rulerRef.current;
        if (button === 2 && ruler?.active && ruler?.draftA) {
            dispatch(clearRulerDraft());
            return;
        }

        openLocationMenu(event, loc);
    });

    locationContainer.on("pointerupoutside", () => { pressStart = null; });

    locationContainer.addChild(tooltip.container, icon);

    return { container: locationContainer, tooltip, icon, colorState };
}

function syncLocationMarker(entry, loc) {
    const { container, tooltip } = entry;
    const hasPosition = loc.position?.x != null && loc.position?.y != null;
    container.visible = hasPosition;
    if (!hasPosition) return;
    container.x = loc.position.x;
    container.y = loc.position.y;
    tooltip.setText(loc.name);
}

export default function LocationsLayer() {
    const viewport  = useViewport();
    const locations = useSelector((s) => s.world.locations);
    const dispatch  = useDispatch();
    const rulerTool = useSelector((s) => s.ui.rulerTool);
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const profile = useSelector((s) => s.player.profile);

    const rulerRef = useRef(rulerTool);
    const sessionRef = useRef({});
    const locationsRef  = useRef(locations);
    const layerRef      = useRef(null);
    const markersRef    = useRef(new Map());
    const textureRef    = useRef(null);

    useEffect(() => { rulerRef.current = rulerTool; }, [rulerTool]);
    useEffect(() => {
        sessionRef.current = {
            map,
            gridConfig,
            campaignId,
            mapId,
            uid: profile?.uid,
            nickname: profile?.nickname,
        };
    }, [map, gridConfig, campaignId, mapId, profile]);
    useEffect(() => { locationsRef.current = locations; }, [locations]);

    // ── Layer container (once per viewport) ───────────────────────
    useEffect(() => {
        if (!viewport) return;

        const layerContainer = new PIXI.Container();
        layerContainer.name   = "LocationsLayer";
        layerContainer.zIndex = RENDER_LAYERS.LOCATIONS;
        viewport.addChild(layerContainer);
        layerRef.current = layerContainer;

        return () => {
            for (const entry of markersRef.current.values()) {
                destroyLocationMarker(entry);
            }
            markersRef.current.clear();
            textureRef.current = null;
            safeDestroy(layerContainer, { children: false });
            layerRef.current = null;
        };
    }, [viewport]);

    // ── Incremental marker sync (no full rebuild on unrelated updates) ─
    useEffect(() => {
        const layer = layerRef.current;
        if (!layer || !locations) return;

        let cancelled = false;

        const applySync = (texture) => {
            if (cancelled) return;
            textureRef.current = texture;

            const markers = markersRef.current;
            const ids     = new Set(Object.keys(locations));

            for (const [id, entry] of markers) {
                if (!ids.has(id)) {
                    layer.removeChild(entry.container);
                    destroyLocationMarker(entry);
                    markers.delete(id);
                }
            }

            for (const loc of Object.values(locations)) {
                let entry = markers.get(loc.id);
                if (!entry) {
                    entry = createLocationMarker(
                        loc.id, texture, dispatch, rulerRef, locationsRef, sessionRef,
                    );
                    syncLocationMarker(entry, loc);
                    layer.addChild(entry.container);
                    markers.set(loc.id, entry);
                } else {
                    syncLocationMarker(entry, loc);
                }
            }
        };

        if (textureRef.current) {
            applySync(textureRef.current);
        } else {
            PIXI.Assets.load(locationIconPath).then((texture) => applySync(texture));
        }

        return () => { cancelled = true; };
    }, [viewport, locations, dispatch]);

    return null;
}
