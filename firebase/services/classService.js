import { db } from "../firebaseConfig";
import {
    collection,
    documentId,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    setDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { sanitizeCombatPartial, sanitizeClassResource, sanitizeSpecialMechanic } from "../../src/constants/combatStats.js";

/**
 * @param {string[]} classIds
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function getClaseDocsByIds(classIds) {
    if (!Array.isArray(classIds) || !classIds.length) return [];

    const chunks = [];
    for (let i = 0; i < classIds.length; i += 10) {
        chunks.push(classIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
        chunks.map((chunk) =>
            getDocs(query(collection(db, "clases"), where(documentId(), "in", chunk)))
        )
    );

    return snapshots.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * Ability keys linked to a class (subcollection doc id === global `abilities` doc id).
 * @param {string} classId
 * @returns {string[]}
 */
export async function getAbilityKeysForClase(classId) {
    if (!classId) return [];
    const snap = await getDocs(collection(db, "clases", classId, "abilities"));
    return snap.docs.map((d) => d.id);
}

/** @param {string} classId */
export async function getClaseDoc(classId) {
    if (!classId) return null;
    const ref = doc(db, "clases", classId);
    const snap = await getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * List clases for a campaign (plus docs missing campaignId for legacy).
 * @param {string} campaignId
 */
export async function listClasesForCampaign(campaignId) {
    if (!campaignId) return [];
    const q = query(collection(db, "clases"), where("campaignId", "==", campaignId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {string} classId
 * @param {Record<string, unknown>} combatStats
 */
export async function updateClaseCombatStats(classId, combatStats) {
    if (!classId) return;
    const cleaned = sanitizeCombatPartial(combatStats);
    await updateDoc(doc(db, "clases", classId), {
        combatStats: cleaned,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Create or update a global ability document.
 * @param {string} abilityKey
 * @param {Record<string, unknown>} data
 */
export async function upsertAbilityDoc(abilityKey, data) {
    if (!abilityKey) throw new Error("abilityKey required");
    const ref = doc(db, "abilities", abilityKey);
    const payload = {
        ...data,
        key: abilityKey,
        updatedAt: serverTimestamp(),
    };
    const existing = await getDoc(ref);
    if (existing.exists()) {
        await updateDoc(ref, payload);
    } else {
        await setDoc(ref, {
            ...payload,
            createdAt: serverTimestamp(),
        });
    }
    return abilityKey;
}

/**
 * Link an ability key under a clase subcollection.
 * @param {string} classId
 * @param {string} abilityKey
 */
export async function linkAbilityToClase(classId, abilityKey) {
    if (!classId || !abilityKey) return;
    await setDoc(
        doc(db, "clases", classId, "abilities", abilityKey),
        { abilityKey, linkedAt: serverTimestamp() },
        { merge: true },
    );
}

/**
 * Partial update of clase meta (displayName, classArchetype, combatStats, …).
 * @param {string} classId
 * @param {Record<string, unknown>} partial
 */
export async function updateClaseFields(classId, partial) {
    if (!classId || !partial) return;
    const payload = { ...partial, updatedAt: serverTimestamp() };
    if (partial.combatStats) {
        payload.combatStats = sanitizeCombatPartial(partial.combatStats);
    }
    if (partial.classResource) {
        const cleaned = sanitizeClassResource(partial.classResource);
        if (cleaned) payload.classResource = cleaned;
        else delete payload.classResource;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "specialMechanic")) {
        const cleaned = sanitizeSpecialMechanic(partial.specialMechanic);
        if (cleaned) payload.specialMechanic = cleaned;
        else payload.specialMechanic = null;
    }
    if (Object.prototype.hasOwnProperty.call(partial, "description")) {
        payload.description = String(partial.description || "").trim() || null;
    }
    await updateDoc(doc(db, "clases", classId), payload);
}

function slugifyJobId(label) {
    return String(label || "job")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "job";
}

/**
 * Create a new job/clase document for a campaign.
 * @param {{ campaignId: string, displayName: string, classArchetype?: string, combatStats?: object, id?: string }} opts
 * @returns {Promise<string>} classId
 */
export async function createClaseDoc({
    campaignId,
    displayName,
    classArchetype = "wright",
    combatStats = {},
    classResource = null,
    specialMechanic = null,
    description = null,
    id = null,
    proposed = false,
    proposedBy = null,
}) {
    if (!campaignId) throw new Error("campaignId required");
    const base = slugifyJobId(displayName || id || "job");
    const classId = id || `${base}-${Date.now().toString(36).slice(-4)}`;
    const ref = doc(db, "clases", classId);
    const sm = sanitizeSpecialMechanic(specialMechanic);
    const desc = String(description || "").trim();
    await setDoc(ref, {
        campaignId,
        displayName: displayName || classId,
        classArchetype: String(classArchetype || "wright").toLowerCase(),
        combatStats: sanitizeCombatPartial(combatStats),
        ...(sanitizeClassResource(classResource)
            ? { classResource: sanitizeClassResource(classResource) }
            : {}),
        ...(sm ? { specialMechanic: sm } : {}),
        ...(desc ? { description: desc } : {}),
        ...(proposed
            ? { status: "proposed", proposedBy: proposedBy || null, proposedAt: serverTimestamp() }
            : { status: "active" }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return classId;
}
