import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    deleteDoc,
    onSnapshot,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";

const sessionsCol = (campaignId) => collection(db, "campaigns", campaignId, "sessions");

/**
 * Live list of a campaign's sessions (Timeline marks and hung sessions).
 * @returns {() => void} unsubscribe
 */
export function subscribeSessionLogs(campaignId, onData, onError) {
    return onSnapshot(
        query(sessionsCol(campaignId), orderBy("sessionDate", "asc")),
        (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => onError?.(err),
    );
}

/**
 * Hang a session on an acontecimiento. Only `eventIds` (and `inGame` when given) change;
 * the event's D.Z. date is never copied into `inGame`.
 */
export async function linkSessionEvent(campaignId, sessionId, eventId, inGame) {
    const patch = { eventIds: arrayUnion(eventId), updatedAt: serverTimestamp() };
    if (typeof inGame === "string") patch.inGame = inGame;
    await updateDoc(doc(db, "campaigns", campaignId, "sessions", sessionId), patch);
}

export async function unlinkSessionEvent(campaignId, sessionId, eventId) {
    await updateDoc(doc(db, "campaigns", campaignId, "sessions", sessionId), {
        eventIds: arrayRemove(eventId),
        updatedAt: serverTimestamp(),
    });
}

export async function listSessionLogs(campaignId, max = 20) {
    const q = query(sessionsCol(campaignId), orderBy("sessionDate", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSessionLog(campaignId, data) {
    const ref = await addDoc(sessionsCol(campaignId), {
        title: data.title ?? "Sesión sin título",
        recap: data.recap ?? "",
        sessionDate: data.sessionDate ?? new Date().toISOString().slice(0, 10),
        dateTo: data.dateTo ?? data.sessionDate ?? "",
        inGame: data.inGame ?? "",
        arcId: data.arcId ?? "",
        arc: data.arc ?? "",
        participants: data.participants ?? [],
        links: data.links ?? [],
        eventIds: data.eventIds ?? [],
        acta: data.acta ?? [],
        highlights: data.highlights ?? [],
        n: data.n ?? null,
        loreSessionId: data.loreSessionId ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateSessionLog(campaignId, sessionId, data) {
    await updateDoc(doc(db, "campaigns", campaignId, "sessions", sessionId), {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteSessionLog(campaignId, sessionId) {
    await deleteDoc(doc(db, "campaigns", campaignId, "sessions", sessionId));
}
