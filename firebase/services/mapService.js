import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
} from "firebase/firestore";

export async function createMapDoc(mapData) {
    return await addDoc(collection(db, "maps"), mapData);
}

function serializeMapFields(data) {
    const clean = {};
    for (const key in data) {
        const value = data[key];
        if (value && typeof value.toDate === "function") {
            clean[key] = value.toDate().toISOString();
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

export async function getMapsByCampaign(campaignId) {
    const q = query(
        collection(db, "maps"),
        where("campaignId", "==", campaignId)
    );

    const snapshot = await getDocs(q);
    // Serialize Timestamps so maps are Redux-safe (loadWorld stores them in world.maps)
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeMapFields(docSnap.data()),
    }));
}

export function subscribeMapsByCampaign(campaignId, callback) {
    const q = query(
        collection(db, "maps"),
        where("campaignId", "==", campaignId)
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
}

export async function updateMapDoc(mapId, partial) {
    await updateDoc(doc(db, "maps", mapId), partial);
}

export async function deleteMapDoc(mapId) {
    await deleteDoc(doc(db, "maps", mapId));
}

export async function countLocationsForMap(mapId) {
    const q = query(collection(db, "locations"), where("mapId", "==", mapId));
    const snap = await getDocs(q);
    return snap.size;
}
