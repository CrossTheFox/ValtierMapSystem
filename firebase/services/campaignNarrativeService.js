import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

const campaignRef = (campaignId) => doc(db, "campaigns", campaignId);

/**
 * Normalize narrative arcs from Firestore into a stable array.
 * @param {unknown} raw
 * @returns {{ id: string, label: string, order: number, color?: string|null }[]}
 */
export function normalizeNarrativeArcs(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((a) => a && typeof a === "object" && typeof a.id === "string" && a.id)
        .map((a, i) => ({
            id: a.id,
            label: typeof a.label === "string" ? a.label : a.id,
            order: Number.isFinite(a.order) ? a.order : i,
            color: typeof a.color === "string" ? a.color : null,
        }))
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "es"));
}

/**
 * @param {string} campaignId
 * @returns {Promise<{
 *   narrativeDate: string|null,
 *   narrativeCalendar: string|null,
 *   narrativeArcs: ReturnType<typeof normalizeNarrativeArcs>,
 *   activeNarrativeArcId: string|null,
 * }|null>}
 */
export async function getCampaignNarrativeSettings(campaignId) {
    if (!campaignId) return null;
    const snap = await getDoc(campaignRef(campaignId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
        narrativeDate: data.narrativeDate ?? null,
        narrativeCalendar: data.narrativeCalendar ?? null,
        narrativeArcs: normalizeNarrativeArcs(data.narrativeArcs),
        activeNarrativeArcId: data.activeNarrativeArcId ?? null,
    };
}

/**
 * @param {string} campaignId
 * @param {{
 *   narrativeDate?: string|null,
 *   narrativeCalendar?: string|null,
 *   narrativeArcs?: object[],
 *   activeNarrativeArcId?: string|null,
 *   aiRules?: object|null,
 *   aiGeneration?: object|null,
 * }} patch
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
    if (Array.isArray(patch.narrativeArcs)) {
        payload.narrativeArcs = normalizeNarrativeArcs(patch.narrativeArcs);
    }
    if (snap.exists()) {
        await updateDoc(ref, payload);
    } else {
        await setDoc(ref, { ...payload, createdAt: serverTimestamp() }, { merge: true });
    }
    return patch;
}

/** Solar overlay on the campaign doc: `mesa_enlaces` and the sun's place. Not cloned with a Lore. */
export function subscribeCampaignSolar(campaignId, onData, onError) {
    return onSnapshot(
        campaignRef(campaignId),
        (snap) => {
            const data = snap.exists() ? snap.data() : {};
            onData({
                links: Array.isArray(data.mesa_enlaces) ? data.mesa_enlaces : [],
                layoutX: data.layout_x ?? null,
                layoutY: data.layout_y ?? null,
                neutros: Array.isArray(data.neutros) ? data.neutros : [],
                paints: data.pinturas && typeof data.pinturas === "object" ? data.pinturas : {},
            });
        },
        (err) => onError?.(err),
    );
}
