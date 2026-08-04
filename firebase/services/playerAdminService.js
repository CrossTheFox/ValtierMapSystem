import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    arrayUnion,
    arrayRemove,
    writeBatch,
} from "firebase/firestore";

async function syncCampaignPlayerIds(campaignId, uid, action) {
    const ref = doc(db, "campaigns", campaignId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
        playerIds: action === "add" ? arrayUnion(uid) : arrayRemove(uid),
    });
}

/** Suscripción en vivo a jugadores con acceso a la campaña. */
export function subscribePlayersByCampaign(campaignId, callback) {
    const q = query(
        collection(db, "players"),
        where("campaignIds", "array-contains", campaignId)
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() })));
    });
}

export async function updatePlayerRole(uid, role) {
    await updateDoc(doc(db, "players", uid), { role });
}

export async function addPlayerToCampaign(uid, campaignId) {
    await updateDoc(doc(db, "players", uid), {
        campaignIds: arrayUnion(campaignId),
    });
    await syncCampaignPlayerIds(campaignId, uid, "add");
}

export async function removePlayerFromCampaign(uid, campaignId) {
    await updateDoc(doc(db, "players", uid), {
        campaignIds: arrayRemove(campaignId),
    });
    await syncCampaignPlayerIds(campaignId, uid, "remove");
}

/**
 * Assign VTT characters a player may control (move/deploy tokens).
 * Syncs `players.characterIds` and `characters.controlledByPlayerIds`.
 * Sets `ownerPlayerId` only when the character has no owner yet.
 */
export async function updatePlayerCharacterRoster(uid, characterIds, previousIds = []) {
    const nextIds = Array.isArray(characterIds) ? characterIds.filter(Boolean) : [];
    const prevIds = Array.isArray(previousIds) ? previousIds.filter(Boolean) : [];
    const nextSet = new Set(nextIds);
    const prevSet = new Set(prevIds);

    await updateDoc(doc(db, "players", uid), { characterIds: nextIds });

    const batch = writeBatch(db);
    let ops = 0;

    for (const charId of nextIds) {
        const ref = doc(db, "characters", charId);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data = snap.data() || {};
        const patch = { controlledByPlayerIds: arrayUnion(uid) };
        if (!data.ownerPlayerId && !prevSet.has(charId)) {
            patch.ownerPlayerId = uid;
        }
        batch.update(ref, patch);
        ops += 1;
    }

    for (const charId of prevIds) {
        if (nextSet.has(charId)) continue;
        const ref = doc(db, "characters", charId);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data = snap.data() || {};
        const patch = { controlledByPlayerIds: arrayRemove(uid) };
        if (data.ownerPlayerId === uid) {
            patch.ownerPlayerId = null;
        }
        batch.update(ref, patch);
        ops += 1;
    }

    if (ops > 0) await batch.commit();
}

/** Tras registerPlayer: enlaza jugador nuevo a campaña y playerIds. */
export async function linkNewPlayerToCampaign(uid, campaignId) {
    if (!uid || !campaignId) return;
    await addPlayerToCampaign(uid, campaignId);
}
