import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

export async function createCharacterDoc(characterData) {
    return await addDoc(collection(db, "characters"), characterData);
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