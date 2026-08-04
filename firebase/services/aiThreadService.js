import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";

const threadsCol = (campaignId) => collection(db, "campaigns", campaignId, "aiThreads");
const messagesCol = (campaignId, threadId) =>
    collection(db, "campaigns", campaignId, "aiThreads", threadId, "messages");

export async function listAiThreads(campaignId, max = 20) {
    const q = query(threadsCol(campaignId), orderBy("updatedAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAiThread(campaignId, { title, anchorEntityId, mode }) {
    const ref = await addDoc(threadsCol(campaignId), {
        title: title || "Nuevo hilo",
        anchorEntityId: anchorEntityId ?? null,
        mode: mode ?? "situation",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function appendAiThreadMessage(campaignId, threadId, { role, content, mode, tokenUsage }) {
    await addDoc(messagesCol(campaignId, threadId), {
        role,
        content,
        mode: mode ?? null,
        tokenUsage: tokenUsage ?? null,
        createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "campaigns", campaignId, "aiThreads", threadId), {
        updatedAt: serverTimestamp(),
    });
}

export async function getAiThreadMessages(campaignId, threadId, max = 30) {
    const q = query(messagesCol(campaignId, threadId), orderBy("createdAt", "asc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
