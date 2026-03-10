import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

export async function createMapDoc(mapData) {
    return await addDoc(collection(db, "maps"), mapData);
}

export async function getMapsByCampaign(campaignId) {
    const q = query(
        collection(db, "maps"),
        where("campaignId", "==", campaignId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}