import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, deleteField, updateDoc } from "firebase/firestore";
import { updateCharacterFields } from "./characterService";

const gameRef = (campaignId) => doc(db, "game", campaignId);

/**
 * Ensure the game document exists for the campaign.
 */
export async function getOrCreateGameSession(campaignId) {
    const docRef = gameRef(campaignId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
        const initial = {
            partyPositions: {},
            tokenPositions: {},
            activeMapId: null,
            rulers: {},
            pings: {},
            sessionPools: {},
        };
        await setDoc(docRef, initial);
        return initial;
    }
    return snap.data();
}

export async function updatePartyPosition(campaignId, mapId, position) {
    const docRef = gameRef(campaignId);
    await setDoc(
        docRef,
        { partyPositions: { [mapId]: position } },
        { merge: true },
    );
}

/**
 * @param {object|null} position — `{ x, y, sizeOverride? }` or null to remove
 */
export async function updateTokenPosition(campaignId, mapId, tokenId, position) {
    const docRef = gameRef(campaignId);
    if (position == null) {
        await updateDoc(docRef, {
            [`tokenPositions.${mapId}.${tokenId}`]: deleteField(),
        });
        return;
    }
    await setDoc(
        docRef,
        { tokenPositions: { [mapId]: { [tokenId]: position } } },
        { merge: true },
    );
}

export async function setActiveMapForPlayers(campaignId, mapId) {
    const docRef = gameRef(campaignId);
    await setDoc(docRef, { activeMapId: mapId }, { merge: true });
}

export async function spawnTokenOnMap(campaignId, mapId, tokenId, position) {
    return updateTokenPosition(campaignId, mapId, tokenId, position);
}

/**
 * Place/move a token and optionally sync narrative `locationId`.
 * Caller resolves nearest location (see `findNearestLocation`).
 */
export async function placeTokenOnBoard(campaignId, mapId, tokenId, position, locationId = null) {
    await updateTokenPosition(campaignId, mapId, tokenId, position);
    if (locationId) {
        await updateCharacterFields(tokenId, { locationId });
    }
}

export async function removeTokenFromMap(campaignId, mapId, tokenId) {
    return updateTokenPosition(campaignId, mapId, tokenId, null);
}

export async function updateTokenSizeOverride(campaignId, mapId, tokenId, sizeOverride, existingPos) {
    const base = existingPos && typeof existingPos === "object" ? existingPos : { x: 0, y: 0 };
    return updateTokenPosition(campaignId, mapId, tokenId, {
        x: base.x ?? 0,
        y: base.y ?? 0,
        sizeOverride: sizeOverride || null,
    });
}

export function subscribeToGameSession(campaignId, callback) {
    const docRef = gameRef(campaignId);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) callback(snap.data());
    });
}

function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Persist a finished ruler so the whole table can see it.
 * @param {object} ruler — omit `id`; server/client assigns one
 */
export async function addMapRuler(campaignId, ruler) {
    const id = ruler?.id || newId("ruler");
    const docRef = gameRef(campaignId);
    const payload = {
        id,
        mapId: ruler.mapId,
        a: ruler.a,
        b: ruler.b,
        straight: ruler.straight ?? 0,
        diagonal: ruler.diagonal ?? 0,
        totalCells: ruler.totalCells ?? 0,
        meters: ruler.meters ?? 0,
        distanceLabel: ruler.distanceLabel ?? "",
        createdBy: ruler.createdBy ?? null,
        createdByName: ruler.createdByName ?? null,
        createdAt: ruler.createdAt ?? Date.now(),
    };
    await setDoc(docRef, { rulers: { [id]: payload } }, { merge: true });
    return payload;
}

export async function removeMapRuler(campaignId, rulerId) {
    if (!campaignId || !rulerId) return;
    const docRef = gameRef(campaignId);
    await updateDoc(docRef, {
        [`rulers.${rulerId}`]: deleteField(),
    });
}

/** Broadcast a map ping (auto-expires client-side; writer also prunes). */
export async function publishMapPing(campaignId, ping, { ttlMs = 5000 } = {}) {
    const id = ping?.id || newId("ping");
    const createdAt = ping.createdAt ?? Date.now();
    const expiresAt = ping.expiresAt ?? createdAt + ttlMs;
    const docRef = gameRef(campaignId);
    const payload = {
        id,
        mapId: ping.mapId,
        x: ping.x,
        y: ping.y,
        col: ping.col,
        row: ping.row,
        createdBy: ping.createdBy ?? null,
        createdByName: ping.createdByName ?? null,
        createdAt,
        expiresAt,
    };
    await setDoc(docRef, { pings: { [id]: payload } }, { merge: true });

    // Best-effort cleanup after TTL so the doc doesn't grow forever.
    setTimeout(() => {
        updateDoc(docRef, { [`pings.${id}`]: deleteField() }).catch(() => {});
    }, ttlMs + 250);

    return payload;
}

export async function removeMapPing(campaignId, pingId) {
    if (!campaignId || !pingId) return;
    await updateDoc(gameRef(campaignId), {
        [`pings.${pingId}`]: deleteField(),
    });
}

/**
 * Shared session combat pools (HP / Effort / tracks) for the table.
 * Stored at game/{campaignId}.sessionPools.{characterId}
 */
export async function updateCharacterSessionPools(campaignId, characterId, pools) {
    if (!campaignId || !characterId || !pools) return;
    await setDoc(
        gameRef(campaignId),
        {
            sessionPools: {
                [characterId]: {
                    ...pools,
                    updatedAt: Date.now(),
                },
            },
        },
        { merge: true },
    );
}
