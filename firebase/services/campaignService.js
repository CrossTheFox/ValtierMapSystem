import { db } from "../firebaseConfig";
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { DEFAULT_RULE_SYSTEM, normalizeRulesSystem } from "../../src/constants/ruleSystems.js";

export async function createCampaignDoc(campaignData) {
    const rulesSystem = normalizeRulesSystem(
        campaignData?.rulesSystem ?? DEFAULT_RULE_SYSTEM,
    );
    return await addDoc(collection(db, "campaigns"), {
        ...campaignData,
        rulesSystem,
    });
}

export async function updateCampaignElement (collectionName, id, data) {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, data);
};

export async function getCampaignsByOwner(ownerId) {
    const q = query(
        collection(db, "campaigns"),
        where("ownerId", "==", ownerId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createCampaignElement(collectionName, data) {
    return await addDoc(collection(db, collectionName), data);
}