import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

/**
 * Loads the stat system document for a campaign.
 * Firestore path: stat_systems / system_{campaignId}
 *
 * Expected shape (extend as needed):
 * {
 *   campaignId: string,
 *   systemName: string,
 *   stats: [{ key, label, description? }],
 *   resourceTracks?: [{ key, label, maxDefault, exhaustedLabel?, brokenLabel? }]
 * }
 */
export async function getStatSystemForCampaign(campaignId) {
    if (!campaignId) return null;
    const ref = doc(db, "stat_systems", `system_${campaignId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}
