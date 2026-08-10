/**
 * Campaign Neural Lab overview positions (DM-arranged card layout).
 * Stored on campaigns/{id}.neuralLabLayout
 */

import { db } from "../firebaseConfig";
import {
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";
import {
    parseNeuralLabLayout,
} from "../../src/utils/neuralLabLayout.js";

export { normalizeNeuralLabPositions, parseNeuralLabLayout } from "../../src/utils/neuralLabLayout.js";

const campaignRef = (campaignId) => doc(db, "campaigns", campaignId);

/**
 * @param {string} campaignId
 * @param {(layout: { positions: Record<string, { x: number, y: number }> }) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function subscribeNeuralLabLayout(campaignId, onData, onError) {
    if (!campaignId) {
        onData?.({ positions: {} });
        return () => {};
    }
    return onSnapshot(
        campaignRef(campaignId),
        (snap) => {
            onData?.(parseNeuralLabLayout(snap.exists() ? snap.data() : null));
        },
        (err) => {
            onError?.(err instanceof Error ? err : new Error(String(err)));
        },
    );
}

/**
 * @param {string} campaignId
 * @param {string} entityId
 * @param {{ x: number, y: number }} pos
 * @param {string} [uid]
 */
export async function updateNeuralLabNodePosition(campaignId, entityId, pos, uid) {
    if (!campaignId) throw new Error("campaignId requerido");
    if (!entityId) throw new Error("entityId requerido");
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("posición inválida");
    }
    const rounded = { x: Math.round(x), y: Math.round(y) };
    const ref = campaignRef(campaignId);
    const payload = {
        [`neuralLabLayout.positions.${entityId}`]: rounded,
        "neuralLabLayout.updatedAt": serverTimestamp(),
        ...(uid ? { "neuralLabLayout.updatedBy": uid } : {}),
    };
    const snap = await getDoc(ref);
    if (snap.exists()) {
        await updateDoc(ref, payload);
    } else {
        await setDoc(
            ref,
            {
                neuralLabLayout: {
                    positions: { [entityId]: rounded },
                    updatedAt: serverTimestamp(),
                    ...(uid ? { updatedBy: uid } : {}),
                },
            },
            { merge: true },
        );
    }
    return rounded;
}
