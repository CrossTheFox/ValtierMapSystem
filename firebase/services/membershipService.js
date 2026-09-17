/**
 * Bidirectional organization-membership sync.
 *
 * Canonical member on an organization is customFields.organizacion.members[].
 * Linked PERSONAJE (has linkedVttCharacterId) is stored as kind=vtt + characterId
 * — never a second wiki-kind row for the same person.
 * Lore-only NPCs stay kind=wiki + entityId.
 *
 * VTT chrome may still mirror organizationMemberships[] on the character doc
 * so the table sheet can list orgs without scanning every wiki org.
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

async function resolveOrgMember(campaignId, member) {
    if (!member?.id) return member;
    if (member.kind === MEMBER_KIND.VTT) return member;
    const snap = await getDoc(wikiDocRef(campaignId, member.id));
    const linked = snap.exists() ? snap.data()?.linkedVttCharacterId : null;
    if (typeof linked === "string" && linked) {
        return { ...member, kind: MEMBER_KIND.VTT, id: linked, _wikiPersonajeId: member.id };
    }
    return { ...member, kind: MEMBER_KIND.WIKI };
}

/**
 * After an organization is saved, push its members[] to each counterpart and
 * remove the org from members that were dropped.
 * Linked PERSONAJE rows are coerced to kind=vtt + characterId.
 */
export async function reconcileOrgMembers(campaignId, orgEntityId, prevMembers = [], nextMembers = []) {
    if (!campaignId || !orgEntityId) return;
    const prevResolved = await Promise.all(prevMembers.map((m) => resolveOrgMember(campaignId, m)));
    const nextResolved = await Promise.all(nextMembers.map((m) => resolveOrgMember(campaignId, m)));
    const nextKeys = new Set(nextResolved.map(memberKey));
    const removed = prevResolved.filter((m) => !nextKeys.has(memberKey(m)));

    const tasks = [];
    for (const m of removed) {
        if (m.kind === MEMBER_KIND.VTT) tasks.push(setCharacterMembership(m.id, orgEntityId, m, true));
        else tasks.push(setPersonajeMembership(campaignId, m.id, orgEntityId, m, true));
    }
    for (const m of nextResolved) {
        if (!m.id) continue;
        if (m.kind === MEMBER_KIND.VTT) {
            tasks.push(setCharacterMembership(m.id, orgEntityId, m, false));
            if (m._wikiPersonajeId) {
                tasks.push(setPersonajeMembership(campaignId, m._wikiPersonajeId, orgEntityId, m, true));
                tasks.push(setOrgMember(campaignId, orgEntityId, { kind: MEMBER_KIND.WIKI, id: m._wikiPersonajeId }, true));
                tasks.push(setOrgMember(campaignId, orgEntityId, m, false));
            }
        } else {
            tasks.push(setPersonajeMembership(campaignId, m.id, orgEntityId, m, false));
        }
    }
    await Promise.allSettled(tasks);
}

/**
 * After a wiki personaje is saved, push its organizations[] into each org.
 * If the PERSONAJE is linked to a VTT token, org.members uses kind=vtt.
 */
export async function reconcilePersonajeMemberships(
    campaignId,
    personajeId,
    prevMemberships = [],
    nextMemberships = [],
    opts = {},
) {
    if (!campaignId || !personajeId) return;
    let linkedVtt = typeof opts.linkedVttCharacterId === "string" ? opts.linkedVttCharacterId : null;
    if (!linkedVtt) {
        const snap = await getDoc(wikiDocRef(campaignId, personajeId));
        const fromDoc = snap.exists() ? snap.data()?.linkedVttCharacterId : null;
        linkedVtt = typeof fromDoc === "string" && fromDoc ? fromDoc : null;
    }
    const member = linkedVtt
        ? { kind: MEMBER_KIND.VTT, id: linkedVtt }
        : { kind: MEMBER_KIND.WIKI, id: personajeId };

    const nextKeys = new Set(nextMemberships.map(membershipKey));
    const removed = prevMemberships.filter((m) => !nextKeys.has(membershipKey(m)));

    const tasks = [];
    for (const m of removed) {
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, { ...member, status: m.status, role: m.role }, true));
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, { kind: MEMBER_KIND.WIKI, id: personajeId, status: m.status, role: m.role }, true));
        if (linkedVtt) {
            tasks.push(setCharacterMembership(linkedVtt, m.organizationEntityId, m, true));
        }
    }
    for (const m of nextMemberships) {
        if (!m.organizationEntityId) continue;
        if (linkedVtt) {
            tasks.push(setOrgMember(campaignId, m.organizationEntityId, { kind: MEMBER_KIND.WIKI, id: personajeId }, true));
            tasks.push(setCharacterMembership(linkedVtt, m.organizationEntityId, m, false));
        }
        tasks.push(setOrgMember(campaignId, m.organizationEntityId, {
            kind: member.kind,
            id: member.id,
            status: m.status,
            role: m.role,
        }, false));
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
