import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const gameRef = (campaignId) => doc(db, "game", campaignId);

/**
 * Ensure the game document exists for the campaign.
 * Uses setDoc+merge so it is safe to call even if the doc already exists.
 */
export async function getOrCreateGameSession(campaignId) {
    const docRef = gameRef(campaignId);
    const snap   = await getDoc(docRef);
    if (!snap.exists()) {
        const initial = { partyPositions: {} };
        await setDoc(docRef, initial);
        return initial;
    }
    return snap.data();
}

/**
 * Write the party position for a specific map.
 * Uses setDoc+merge so the document is created if it does not exist yet.
 */
export async function updatePartyPosition(campaignId, mapId, position) {
    const docRef = gameRef(campaignId);
    await setDoc(
        docRef,
        { partyPositions: { [mapId]: position } },
        { merge: true },
    );
}

export function subscribeToGameSession(campaignId, callback) {
    const docRef = gameRef(campaignId);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) callback(snap.data());
    });
}
