/**
 * Deterministic campaign Neural Lab overview: all personaje nodes, no hub.
 * Default: PJ inner oval / NPC outer oval. Saved positions override defaults.
 */

import {
    CIRCUIT_HUB_X,
    CIRCUIT_HUB_Y,
    CIRCUIT_NODE_H,
    CIRCUIT_NODE_W,
    CIRCUIT_WORLD_H,
    CIRCUIT_WORLD_W,
} from "./circuitLayout.js";
import { isKnownPlayerCharacterName, isPlayerCharacter } from "./characterRosterKind.js";
import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes.js";

const MUTED = "#aaaaaa";
const PJ_COLOR = "#00f2ea";

/** Inner oval radii (PJ). */
const PJ_RX = 280;
const PJ_RY = 200;
/** Outer oval radii (NPC). */
const NPC_RX = 520;
const NPC_RY = 340;

/**
 * @param {object} entity wiki entity
 * @param {Record<string, object>} charactersById
 * @returns {'pj'|'npc'}
 */
export function classifyWikiPersonajeKind(entity, charactersById = {}) {
    if (!entity || entity.entityType !== WIKI_ENTITY_TYPES.PERSONAJE) return "npc";
    const vttId = entity.linkedVttCharacterId;
    if (vttId && charactersById[vttId]) {
        return isPlayerCharacter(charactersById[vttId]) ? "pj" : "npc";
    }
    if (isKnownPlayerCharacterName(entity.title)) return "pj";
    return "npc";
}

/**
 * @param {object[]} entities
 * @param {Record<string, object>} [charactersById]
 * @returns {object[]}
 */
export function listCampaignPersonajeEntities(entities = [], charactersById = {}) {
    return (entities || [])
        .filter((e) => e?.id && e.entityType === WIKI_ENTITY_TYPES.PERSONAJE)
        .map((e) => ({
            entity: e,
            kind: classifyWikiPersonajeKind(e, charactersById),
        }))
        .sort((a, b) => {
            const ka = a.kind === "pj" ? 0 : 1;
            const kb = b.kind === "pj" ? 0 : 1;
            if (ka !== kb) return ka - kb;
            return String(a.entity.title || a.entity.id).localeCompare(
                String(b.entity.title || b.entity.id),
                "es",
            );
        });
}

function placeOnOval(items, rx, ry, startDeg = -90) {
    const n = items.length;
    if (n === 0) return [];
    return items.map((item, i) => {
        const ang = ((startDeg + (360 * i) / n) * Math.PI) / 180;
        return {
            ...item,
            x: Math.round(CIRCUIT_HUB_X + Math.cos(ang) * rx),
            y: Math.round(CIRCUIT_HUB_Y + Math.sin(ang) * ry),
        };
    });
}

/**
 * @param {{
 *   entities?: object[],
 *   charactersById?: Record<string, object>,
 *   imagePathFor?: (entity: object) => string|null,
 *   positions?: Record<string, { x: number, y: number }>,
 * }} opts
 * @returns {{ nodes: object[], edges: object[], hubId: null, worldW: number, worldH: number }}
 */
export function buildCampaignCharacterOverviewLayout({
    entities = [],
    charactersById = {},
    imagePathFor = null,
    positions = null,
} = {}) {
    const listed = listCampaignPersonajeEntities(entities, charactersById);
    const pjs = placeOnOval(
        listed.filter((x) => x.kind === "pj"),
        PJ_RX,
        PJ_RY,
        -90,
    );
    const npcs = placeOnOval(
        listed.filter((x) => x.kind === "npc"),
        NPC_RX,
        NPC_RY,
        -70,
    );

    const nodes = [...pjs, ...npcs].map(({ entity, kind, x, y }) => {
        const isPj = kind === "pj";
        const saved = positions?.[entity.id];
        const useX = Number.isFinite(saved?.x) ? Math.round(saved.x) : x;
        const useY = Number.isFinite(saved?.y) ? Math.round(saved.y) : y;
        const linkedChar = entity.linkedVttCharacterId
            ? (charactersById[entity.linkedVttCharacterId] || null)
            : null;
        return {
            id: entity.id,
            entityId: entity.id,
            kind: "satellite",
            title: entity.title || entity.id,
            entityType: entity.entityType,
            rankLabel: isPj ? "PJ" : "NPC",
            rankColor: isPj ? PJ_COLOR : MUTED,
            color: isPj ? PJ_COLOR : MUTED,
            x: useX,
            y: useY,
            w: CIRCUIT_NODE_W,
            h: CIRCUIT_NODE_H,
            sync: null,
            relationLabel: isPj ? "Operador" : "Contacto",
            imagePath: typeof imagePathFor === "function" ? imagePathFor(entity) : null,
            avatarStatus: linkedChar?.status || "alive",
            avatarCrop: linkedChar?.tokenCrop || null,
            overviewKind: kind,
            positionSaved: Boolean(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)),
        };
    });

    return {
        nodes,
        edges: [],
        hubId: null,
        worldW: CIRCUIT_WORLD_W,
        worldH: CIRCUIT_WORLD_H,
    };
}
