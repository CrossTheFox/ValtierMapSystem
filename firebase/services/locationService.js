import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, query, where } from "firebase/firestore";

export async function createLocationDoc(locationData) {
    return await addDoc(collection(db, "locations"), locationData);
}

export async function getLocation(locationId) {
    const snap = await getDoc(doc(db, "locations", locationId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

export async function updateLocationFields(locationId, data) {
    if (!locationId || !data) return;
    await updateDoc(doc(db, "locations", locationId), data);
}

export async function getLocationsByMap(mapId) {
    const q = query(
        collection(db, "locations"),
        where("mapId", "==", mapId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}
