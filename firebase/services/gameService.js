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
