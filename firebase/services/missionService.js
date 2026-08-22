/**
 * Campaign missions — generic (all players) or personal (assignees).
 * Path: campaigns/{campaignId}/missions/{missionId}
 */

import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";
import {
    emptyMission,
    normalizeMission,
} from "../../src/utils/campaignMissions";

const missionsCol = (campaignId) =>
    collection(db, "campaigns", campaignId, "missions");

const missionDoc = (campaignId, missionId) =>
    doc(db, "campaigns", campaignId, "missions", missionId);

function serializeMission(snap) {
    const data = snap.data() || {};
    const createdAt = data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ?? null;
    const updatedAt = data.updatedAt?.toDate?.()
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt ?? null;
    return normalizeMission({
        ...data,
        id: snap.id,
        createdAt,
        updatedAt,
    });
}

/**
 * @param {string} campaignId
 * @returns {Promise<object[]>}
 */
export async function listCampaignMissions(campaignId) {
    if (!campaignId) return [];
    const snap = await getDocs(missionsCol(campaignId));
    return snap.docs.map(serializeMission).filter(Boolean);
}

/**
 * Realtime listener for campaign missions.
 * @param {string} campaignId
 * @param {(missions: object[]) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} unsubscribe
 */
export function subscribeCampaignMissions(campaignId, onData, onError) {
    if (!campaignId) {
        onData?.([]);
        return () => {};
    }
    return onSnapshot(
        missionsCol(campaignId),
        (snap) => {
            const list = snap.docs.map(serializeMission).filter(Boolean);
            onData?.(list);
        },
        (err) => {
            console.error("[missionService] subscribe", err);
            onError?.(err);
        }
    );
}

/**
 * @param {string} campaignId
 * @param {object} [partial]
 * @param {string} uid
 * @returns {Promise<object>}
 */
export async function createCampaignMission(campaignId, partial, uid) {
    if (!campaignId) throw new Error("createCampaignMission: missing campaignId");
    const mission = emptyMission({
        ...partial,
        campaignId,
        createdBy: uid || null,
    });
    const payload = {
        ...mission,
        campaignId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid || null,
    };
    // Don't store client-side ISO timestamps as Firestore Timestamp fields conflict
    delete payload.id;
    await setDoc(missionDoc(campaignId, mission.id), payload);
    return { ...mission, campaignId, createdBy: uid || null };
}

/**
 * @param {string} campaignId
 * @param {string} missionId
 * @param {object} data
 * @param {string} uid
 */
export async function updateCampaignMission(campaignId, missionId, data, uid) {
    if (!campaignId || !missionId) return null;
    const { id: _id, createdAt: _c, ...rest } = data || {};
    const payload = {
        ...rest,
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
    };
    await updateDoc(missionDoc(campaignId, missionId), payload);
    return normalizeMission({ id: missionId, ...rest, campaignId });
}

/**
 * Replace full mission document fields (normalized).
 * @param {string} campaignId
 * @param {object} mission
 * @param {string} uid
 */
export async function saveCampaignMission(campaignId, mission, uid) {
    const m = normalizeMission(mission);
    if (!campaignId || !m?.id) throw new Error("saveCampaignMission: invalid mission");
    const payload = {
        campaignId,
        title: m.title,
        scope: m.scope,
        assigneeCharacterIds: m.assigneeCharacterIds,
        clockSize: m.clockSize,
        clockFilled: m.clockFilled,
        objectives: m.objectives,
        reward: m.reward,
        grantedBy: m.grantedBy,
        status: m.status,
        summary: m.summary,
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
    };
    await setDoc(missionDoc(campaignId, m.id), payload, { merge: true });
    return { ...m, campaignId };
}

/**
 * @param {string} campaignId
 * @param {string} missionId
 */
export async function deleteCampaignMission(campaignId, missionId) {
    if (!campaignId || !missionId) return;
    await deleteDoc(missionDoc(campaignId, missionId));
}
