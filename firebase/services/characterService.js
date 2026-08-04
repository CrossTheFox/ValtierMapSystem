import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, getDoc, query, where, documentId, doc, updateDoc } from "firebase/firestore";

export async function createCharacterDoc(characterData) {
    return await addDoc(collection(db, "characters"), characterData);
}

/** @param {string} characterId */
export async function getCharacterById(characterId) {
    if (!characterId) return null;
    const snap = await getDoc(doc(db, "characters", characterId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getCharactersByLocation(locationId) {
    const q = query(
        collection(db, "characters"),
        where("locationId", "==", locationId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCharactersByPlayer(uid) {
    const q = query(
        collection(db, "characters"),
        where("ownerPlayerId", "==", uid)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCharactersByIds(characterIds) {
    if (!characterIds.length) return [];

    const q = query(collection(db, "characters"), where(documentId(), "in", characterIds));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function setPlayerActiveCharacter(playerId, characterId) {
    await updateDoc(doc(db, "players", playerId), { activeCharacterId: characterId });
}

/** Actualiza campos sueltos del documento personaje (p. ej. `activeClassId`). */
export async function updateCharacterFields(characterId, partial) {
    if (!characterId || !partial || typeof partial !== "object") return;
    await updateDoc(doc(db, "characters", characterId), partial);
}

/**
 * Persiste la URL del banner del personaje (imagen cuadrilateral del dossier).
 * Campo Firestore: `bannerUrl` — independiente de `imageUrl` (token/retrato).
 */
export async function updateCharacterBanner(characterId, bannerUrl) {
    if (!characterId) return;
    await updateDoc(doc(db, "characters", characterId), { bannerUrl: bannerUrl ?? null });
}

export async function getAbilitiesByIds(abilityIds) {
    if (!abilityIds.length) return [];

    const chunks = [];
    for (let i = 0; i < abilityIds.length; i += 10) {
        chunks.push(abilityIds.slice(i, i + 10));
    }

    const fetchPromises = chunks.map(chunk => {
        const q = query(collection(db, "abilities"), where(documentId(), "in", chunk));
        return getDocs(q);
    });

    const snapshots = await Promise.all(fetchPromises);
    return snapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}