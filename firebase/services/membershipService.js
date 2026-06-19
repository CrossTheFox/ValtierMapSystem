/**
 * Bidirectional organization-membership sync.
 *
 * Membership is stored on BOTH sides (source-of-truth arrays):
 *   - organization wikiEntity: customFields.organizacion.members[]  = { kind, id, status, role }
 *   - VTT character doc:        organizationMemberships[]            = { organizationEntityId, status, role }
 *   - wiki personaje:           customFields.personaje.organizations[] = { organizationEntityId, status, role }
 *
 * The side being saved pushes its truth to the counterpart docs (diff-based).
 * This avoids a server function but can drift if both sides are edited
 * concurrently — documented as a known limitation in funcionalidades-futuras.md.
 */

import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const MEMBER_KIND = { VTT: "vtt", WIKI: "wiki" };

const charDocRef = (characterId) => doc(db, "characters", characterId);
const wikiDocRef = (campaignId, entityId) => doc(db, "campaigns", campaignId, "wikiEntities", entityId);

function membershipKey(m) {
    return m.organizationEntityId;
}

function memberKey(m) {
    return `${m.kind}:${m.id}`;
}

/* ---- counterpart writers (org membership on a character / personaje) ---- */

async function setCharacterMembership(characterId, orgEntityId, entry, remove) {
    const ref = charDocRef(characterId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    let arr = Array.isArray(data.organizationMemberships) ? [...data.organizationMemberships] : [];
    arr = arr.filter((m) => m.organizationEntityId !== orgEntityId);
    if (!remove) {
        arr.push({ organizationEntityId: orgEntityId, status: entry.status, role: entry.role || "" });
    }
    await updateDoc(ref, { organizationMemberships: arr });
}

async function setPersonajeMembership(campaignId, personajeId, orgEntityId, entry, remove) {
    const ref = wikiDocRef(campaignId, personajeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const cf = data.customFields || {};
    const ns = cf.personaje || {};
    let arr = Array.isArray(ns.organizations) ? [...ns.organizations] : [];
    arr = arr.filter((m) => m.organizationEntityId !== orgEntityId);
    if (!remove) {
        arr.push({ organizationEntityId: orgEntityId, status: entry.status, role: entry.role || "" });
    }
    await updateDoc(ref, {
        customFields: { ...cf, personaje: { ...ns, organizations: arr } },
    });
}

/* ---- counterpart writer (member entry on an organization) ---- */

async function setOrgMember(campaignId, orgEntityId, member, remove) {
    const ref = wikiDocRef(campaignId, orgEntityId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const cf = data.customFields || {};
    const ns = cf.organizacion || {};
    let arr = Array.isArray(ns.members) ? [...ns.members] : [];
    arr = arr.filter((m) => !(m.kind === member.kind && m.id === member.id));
    if (!remove) {
        arr.push({ kind: member.kind, id: member.id, status: member.status, role: member.role || "" });
    }
    await updateDoc(ref, {
        customFields: { ...cf, organizacion: { ...ns, members: arr } },
    });
}

/* ------------------------------------------------------------------ */
/* Public reconcilers                                                  */
/* ------------------------------------------------------------------ */

/**
 * After an organization is saved, push its members[] to each counterpart and
 * remove the org from members that were dropped.
 */
export async function reconcileOrgMembers(campaignId, orgEntityId, prevMembers = [], nextMembers = []) {
    if (!campaignId || !orgEntityId) return;
    const nextKeys = new Set(nextMembers.map(memberKey));
    const removed = prevMembers.filter((m) => !nextKeys.has(memberKey(m)));

    const tasks = [];
    for (const m of removed) {
        if (m.kind === MEMBER_KIND.VTT) tasks.push(setCharacterMembership(m.id, orgEntityId, m, true));
        else tasks.push(setPersonajeMembership(campaignId, m.id, orgEntityId, m, true));
    }
    for (const m of nextMembers) {
        if (!m.id) continue;
        if (m.kind === MEMBER_KIND.VTT) tasks.push(setCharacterMembership(m.id, orgEntityId, m, false));
        else tasks.push(setPersonajeMembership(campaignId, m.id, orgEntityId, m, false));
    }
    await Promise.allSettled(tasks);
}

/**
 * After a wiki personaje is saved, push its organizations[] into each org's
 * members[] (kind = wiki) and remove from dropped orgs.
 */
export async function reconcilePersonajeMemberships(campaignId, personajeId, prevMemberships = [], nextMemberships = []) {
    if (!campaignId || !personajeId) return;
    const nextKeys = new Set(nextMemberships.map(membershipKey));
    const removed = prevMemberships.filter((m) => !nextKeys.has(membershipKey(m)));

    const tasks = [];
    for (const m of removed) {
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, { kind: MEMBER_KIND.WIKI, id: personajeId, status: m.status, role: m.role }, true));
    }
    for (const m of nextMemberships) {
        if (!m.organizationEntityId) continue;
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, { kind: MEMBER_KIND.WIKI, id: personajeId, status: m.status, role: m.role }, false));
    }
    await Promise.allSettled(tasks);
}

/**
 * After a VTT character is saved, push its organizationMemberships[] into each
 * org's members[] (kind = vtt) and remove from dropped orgs.
 */
export async function reconcileCharacterMemberships(campaignId, characterId, prevMemberships = [], nextMemberships = []) {
    if (!campaignId || !characterId) return;
    const nextKeys = new Set(nextMemberships.map(membershipKey));
    const removed = prevMemberships.filter((m) => !nextKeys.has(membershipKey(m)));

    const tasks = [];
    for (const m of removed) {
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, { kind: MEMBER_KIND.VTT, id: characterId, status: m.status, role: m.role }, true));
    }
    for (const m of nextMemberships) {
        if (!m.organizationEntityId) continue;
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, { kind: MEMBER_KIND.VTT, id: characterId, status: m.status, role: m.role }, false));
    }
    await Promise.allSettled(tasks);
}
