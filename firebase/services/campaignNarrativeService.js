import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";

const campaignRef = (campaignId) => doc(db, "campaigns", campaignId);

/**
 * @param {string} campaignId
 * @returns {Promise<{ narrativeDate: string|null, narrativeCalendar: string|null }|null>}
 */
export async function getCampaignNarrativeSettings(campaignId) {
    if (!campaignId) return null;
    const snap = await getDoc(campaignRef(campaignId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        narrativeDate: data.narrativeDate ?? null,
        narrativeCalendar: data.narrativeCalendar ?? null,
    };
}

/**
 * @param {string} campaignId
 * @param {{ narrativeDate?: string, narrativeCalendar?: string }} patch
 * @param {string} [uid]
 */
export async function updateCampaignNarrativeSettings(campaignId, patch, uid) {
    if (!campaignId) throw new Error("campaignId requerido");
    const ref = campaignRef(campaignId);
    const snap = await getDoc(ref);
    const payload = {
        ...patch,
        narrativeUpdatedAt: serverTimestamp(),
        ...(uid ? { narrativeUpdatedBy: uid } : {}),
    };
    if (snap.exists()) {
        await updateDoc(ref, payload);
    } else {
        await setDoc(ref, { ...payload, createdAt: serverTimestamp() }, { merge: true });
    }
    return patch;
}
