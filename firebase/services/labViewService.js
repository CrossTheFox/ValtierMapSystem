import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    writeBatch,
} from "firebase/firestore";
import { buildPlayerEgo } from "../../src/utils/labGraph.js";

function slimFicha(row) {
    if (!row) return null;
    return {
        id: row.id,
        entity_type: row.entity_type,
        title: row.title || "",
        summary: row.summary || "",
        image_url: row.image_url || null,
        narrative_state: row.narrative_state || null,
        condicion: row.condicion || null,
        condicion_nota: row.condicion_nota || null,
        collective_mood: row.collective_mood || null,
    };
}

function slimEdge(row) {
    return {
        id: row.id,
        from_ficha_id: row.from_ficha_id,
        to_ficha_id: row.to_ficha_id,
        relation_type: row.relation_type,
        label: row.label || "",
        strength: row.strength ?? 0,
    };
}

/**
 * Rewrites one lab view per player who has a character linked to a ficha.
 * Players with no remaining link get an empty list so a stale ego does not linger.
 * @param {{
 *   campaignId: string,
 *   fichas: object[],
 *   relations: object[],
 *   characters: object[],
 *   visibilityByFicha: Record<string, string>,
 * }} args
 */
export async function publishLabViews({
    campaignId,
    fichas = [],
    relations = [],
    characters = [],
    visibilityByFicha = {},
}) {
    if (!campaignId) return;
    const visible = new Set(
        Object.entries(visibilityByFicha)
            .filter(([, value]) => value === "players")
            .map(([id]) => id),
    );
    const byPlayer = new Map();
    for (const character of characters) {
        if (!character?.id || !character.ownerPlayerId) continue;
        const list = byPlayer.get(character.ownerPlayerId) || [];
        list.push(character);
        byPlayer.set(character.ownerPlayerId, list);
    }
    if (byPlayer.size === 0) return;

    const batch = writeBatch(db);
    for (const [uid, owned] of byPlayer) {
        const linked = owned.filter((character) => character.ficha_id);
        const ownIds = linked.map((character) => character.ficha_id);
        const own = new Set(ownIds);
        const egos = linked.map((character) => {
            const ego = buildPlayerEgo({
                fichas,
                relations,
                focusFichaId: character.ficha_id,
                visibleFichaIds: visible,
                ownFichaIds: own,
            });
            return {
                characterId: character.id,
                characterName: character.name || "",
                fichaId: character.ficha_id,
                nodes: ego.nodes.map(slimFicha).filter(Boolean),
                edges: ego.edges.map(slimEdge),
            };
        });
        batch.set(doc(db, "campaigns", campaignId, "labViews", uid), {
            characters: egos,
            updated_at: serverTimestamp(),
        });
    }
    await batch.commit();
}

/**
 * @param {string} campaignId
 * @param {string} uid
 * @param {(view: { characters: object[] }|null) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeLabView(campaignId, uid, onData, onError) {
    return onSnapshot(
        doc(db, "campaigns", campaignId, "labViews", uid),
        (snap) => onData(snap.exists() ? snap.data() : null),
        (err) => onError?.(err),
    );
}

export function subscribeFichaVisibilidad(campaignId, onData, onError) {
    return onSnapshot(
        collection(db, "campaigns", campaignId, "fichaVisibilidad"),
        (snap) => {
            const map = {};
            snap.docs.forEach((row) => {
                map[row.id] = row.data()?.visibility === "players" ? "players" : "dm_only";
            });
            onData(map);
        },
        (err) => onError?.(err),
    );
}

export async function setFichaVisibility(campaignId, fichaId, visibility) {
    await setDoc(doc(db, "campaigns", campaignId, "fichaVisibilidad", fichaId), {
        visibility: visibility === "players" ? "players" : "dm_only",
        updated_at: serverTimestamp(),
    });
}
