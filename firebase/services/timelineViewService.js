import { db } from "../firebaseConfig";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

/**
 * Published mesa line: one doc the DM rewrites from the Lore it reads.
 * Players never read the Lore; they read this (`src/utils/timelinePublish.js`).
 */
const viewRef = (campaignId) => doc(db, "campaigns", campaignId, "timelineViews", "published");

export async function publishTimelineView(campaignId, view) {
    await setDoc(viewRef(campaignId), { ...view, updated_at: serverTimestamp() });
}

/**
 * @param {(view: object|null) => void} onData null while the DM has not published yet
 */
export function subscribeTimelineView(campaignId, onData, onError) {
    return onSnapshot(
        viewRef(campaignId),
        (snap) => onData(snap.exists() ? snap.data() : null),
        (err) => onError?.(err),
    );
}
