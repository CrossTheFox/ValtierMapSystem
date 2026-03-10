import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

export async function createLocationDoc(locationData) {
    return await addDoc(collection(db, "locations"), locationData);
}

export async function getLocationsByMap(mapId) {
    const q = query(
        collection(db, "locations"),
        where("mapId", "==", mapId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}