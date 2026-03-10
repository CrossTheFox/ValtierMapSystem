import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";

export async function createCampaignDoc(campaignData) {
    return await addDoc(collection(db, "campaigns"), campaignData);
}

export async function getCampaignsByOwner(ownerId) {
    const q = query(
        collection(db, "campaigns"),
        where("ownerId", "==", ownerId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}