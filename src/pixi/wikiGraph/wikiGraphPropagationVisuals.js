/**
 * Lightweight propagation visuals — updates existing node containers without rebuild.
 */

import { NODE_ALPHA_DIMMED, NODE_COLORS } from "./wikiGraphTypes";
import { attachNodePulse, detachNodePulse } from "./wikiGraphNodePulse";
import { WIKI_NODE_PULSE_PRESET } from "./wikiGraphNodePulse";

/** @param {Array<{ nodeIds?: string[] }>} waves */
export function buildPreviewWaveMap(waves) {
    const m = new Map();
    for (const [wi, wave] of (waves ?? []).entries()) {
        for (const id of wave.nodeIds ?? []) m.set(id, wi);
    }
    return m;
}

/**
 * @param {string} entityId
 * @param {{ isSelected: boolean, isNeighbor: boolean, selectedEntityId: string|null, propagation: object|null, previewWaveMap: Map<string,number>|null, maxWave: number }} ctx
 */
export function computeNodeAlpha(entityId, ctx) {
    const {
        isSelected,
        isNeighbor,
        selectedEntityId,
        propagation,
        previewWaveMap,
        maxWave,
    } = ctx;

    if (isSelected) return 1;

    const isLive    = propagation?.mode === "live" && propagation?.active;
    const isPreview = propagation?.mode === "preview";

    if (!isLive && !isPreview) {
        if (selectedEntityId && !isNeighbor) return NODE_ALPHA_DIMMED;
        return 1;
    }

    if (isPreview && previewWaveMap) {
        const wi = previewWaveMap.get(entityId);
        if (wi == null) return 0.22;
        const mw = Math.max(maxWave, 1);
        return 0.32 + (1 - wi / mw) * 0.68;
    }

    const litSet = new Set(propagation?.litNodeIds ?? []);
    if (!litSet.has(entityId)) return NODE_ALPHA_DIMMED;
    return 1;
}

/**
 * @param {Map<string, { container: import("pixi.js").Container, pulsing?: boolean, pulseWave?: number }>} registry
 * @param {import("pixi.js").Application} app
 * @param {object|null} propagation
 * @param {string|null} selectedEntityId
 * @param {Map<string, object>} entityById
 */
export function syncNodePulses(app, registry, propagation, selectedEntityId, entityById) {
    if (!app?.ticker || !registry?.size) return;

    const isLive = propagation?.mode === "live" && propagation?.active;
    const currentWave = propagation?.currentWave ?? -1;
    const currentWaveIds = isLive
        ? new Set(propagation.waves?.[currentWave]?.nodeIds ?? [])
        : null;

    for (const [entityId, entry] of registry) {
        const isSelected = entityId === selectedEntityId;
        const isWaveNode = isLive && currentWaveIds?.has(entityId);
        const shouldPulse = isSelected || isWaveNode;

        if (!shouldPulse) {
            if (entry.pulsing) {
                detachNodePulse(app, entry.container);
                entry.pulsing = false;
                entry.pulseWave = -1;
            }
            continue;
        }

        const nodeColor = NODE_COLORS[entityById.get(entityId)?.entityType] ?? 0x888888;
        const preset = isWaveNode && !isSelected
            ? { ...WIKI_NODE_PULSE_PRESET, alphaMax: 0.55, scaleMax: 1.45, pulseDuration: 1.0 }
            : {};
        const pulseKey = isWaveNode ? currentWave : -1;

        if (entry.pulsing && entry.pulseWave === pulseKey) continue;

        if (entry.pulsing) detachNodePulse(app, entry.container);
        attachNodePulse(app, entry.container, nodeColor, preset);
        entry.pulsing = true;
        entry.pulseWave = pulseKey;
    }
}

/**
 * @param {Map<string, { container: import("pixi.js").Container, lastAlpha?: number }>} registry
 * @param {object|null} propagation
 * @param {string|null} selectedEntityId
 * @param {object[]} links
 */
export function applyPropagationNodeVisuals(registry, propagation, selectedEntityId, links) {
    if (!registry?.size) return;

    const isLive    = propagation?.mode === "live" && propagation?.active;
    const isPreview = propagation?.mode === "preview";
    const isAny     = isLive || isPreview;
    const previewWaveMap = isPreview ? buildPreviewWaveMap(propagation?.waves) : null;
    const maxWave = Math.max(0, (propagation?.waves?.length ?? 1) - 1);

    let neighborIds = null;
    if (selectedEntityId && !isAny) {
        neighborIds = new Set();
        for (const l of links) {
            const from = l.source?.id ?? l.source;
            const to = l.target?.id ?? l.target;
            if (from === selectedEntityId || to === selectedEntityId) {
                neighborIds.add(from);
                neighborIds.add(to);
            }
        }
    }

    for (const [entityId, entry] of registry) {
        const isSelected = entityId === selectedEntityId;
        const isNeighbor = neighborIds
            ? neighborIds.has(entityId) && !isSelected
            : false;

        const alpha = computeNodeAlpha(entityId, {
            isSelected,
            isNeighbor,
            selectedEntityId,
            propagation: isAny ? propagation : null,
            previewWaveMap,
            maxWave,
        });

        if (entry.lastAlpha === alpha) continue;
        entry.container.alpha = alpha;
        entry.lastAlpha = alpha;
    }
}
