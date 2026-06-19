/**
 * Generic helpers for the per-entityType structured `customFields` of wiki
 * entities. Mirrors the wikiTimeline.js pattern but MERGES namespaces instead
 * of replacing the whole `customFields` object (the timeline builder replaced
 * everything, which would clobber other namespaces).
 *
 * Storage shape:
 *   customFields: {
 *     timeline?:     {...}   // evento_historico (legacy key kept for compat)
 *     especie?:      {...}
 *     personaje?:    {...}   // incl. organizations[]
 *     locacion?:     {...}
 *     organizacion?: {...}   // incl. members[]
 *     reliquia?:     {...}
 *     ideologia?:    {...}
 *   }
 */

import { WIKI_ENTITY_TYPES } from "../constants/wikiEntityTypes";
import { MEMBERSHIP_STATUS, MEMBER_REF_KIND } from "../constants/wiki/entityFieldSchemas";

/** entityType -> customFields namespace key. Idioma intentionally absent (markdown-only). */
export const CUSTOM_FIELD_NAMESPACE = {
    [WIKI_ENTITY_TYPES.EVENTO_HISTORICO]: "timeline",
    [WIKI_ENTITY_TYPES.ESPECIE]: "especie",
    [WIKI_ENTITY_TYPES.PERSONAJE]: "personaje",
    [WIKI_ENTITY_TYPES.LOCACION]: "locacion",
    [WIKI_ENTITY_TYPES.ORGANIZACION]: "organizacion",
    [WIKI_ENTITY_TYPES.RELIQUIA]: "reliquia",
    [WIKI_ENTITY_TYPES.IDEOLOGIA]: "ideologia",
};

export function getNamespaceKey(entityType) {
    return CUSTOM_FIELD_NAMESPACE[entityType] || null;
}

export function hasCustomFieldPanel(entityType) {
    return Boolean(getNamespaceKey(entityType));
}

/**
 * Read the structured namespace for an entity type.
 * @param {object} entity — { customFields }
 * @param {string} entityType
 * @returns {object} the namespace object (never null)
 */
export function getEntityMeta(entity, entityType) {
    const ns = getNamespaceKey(entityType);
    if (!ns) return {};
    return entity?.customFields?.[ns] || {};
}

/**
 * Merge a partial into the namespace of the given type, preserving all other
 * namespaces already present in customFields.
 * @param {object} existing — current customFields object
 * @param {string} entityType
 * @param {object} partial — fields to set/override in the namespace
 * @returns {object} new customFields
 */
export function mergeCustomFields(existing = {}, entityType, partial = {}) {
    const ns = getNamespaceKey(entityType);
    if (!ns) return existing || {};
    return {
        ...(existing || {}),
        [ns]: { ...(existing?.[ns] || {}), ...partial },
    };
}

/* ------------------------------------------------------------------ */
/* Membership: organization <-> character / personaje                  */
/* ------------------------------------------------------------------ */

/** Org-side member entry: which character/personaje belongs to this org. */
export function normalizeMember(entry = {}) {
    return {
        kind: entry.kind === MEMBER_REF_KIND.WIKI ? MEMBER_REF_KIND.WIKI : MEMBER_REF_KIND.VTT,
        id: entry.id || "",
        status:
            entry.status === MEMBERSHIP_STATUS.SOSPECHADO
                ? MEMBERSHIP_STATUS.SOSPECHADO
                : MEMBERSHIP_STATUS.CONFIRMADO,
        role: entry.role || "",
    };
}

/** Character/personaje-side entry: which org they belong to. */
export function normalizeMembership(entry = {}) {
    return {
        organizationEntityId: entry.organizationEntityId || "",
        status:
            entry.status === MEMBERSHIP_STATUS.SOSPECHADO
                ? MEMBERSHIP_STATUS.SOSPECHADO
                : MEMBERSHIP_STATUS.CONFIRMADO,
        role: entry.role || "",
    };
}

/** Members array stored on an organization wikiEntity. */
export function getOrgMembers(orgEntity) {
    const arr = orgEntity?.customFields?.organizacion?.members;
    return Array.isArray(arr) ? arr.map(normalizeMember) : [];
}

/** organizationMemberships array stored on a VTT character document. */
export function getCharacterMemberships(character) {
    const arr = character?.organizationMemberships;
    return Array.isArray(arr) ? arr.map(normalizeMembership) : [];
}

/** organizations array stored on a wiki personaje (customFields.personaje.organizations). */
export function getPersonajeMemberships(personajeEntity) {
    const arr = personajeEntity?.customFields?.personaje?.organizations;
    return Array.isArray(arr) ? arr.map(normalizeMembership) : [];
}

function sameMember(a, b) {
    return a.kind === b.kind && a.id === b.id;
}

export function upsertMember(members = [], member) {
    const next = normalizeMember(member);
    if (!next.id) return members;
    const existing = members.map(normalizeMember);
    const idx = existing.findIndex((m) => sameMember(m, next));
    if (idx === -1) return [...existing, next];
    const copy = existing.slice();
    copy[idx] = next;
    return copy;
}

export function removeMember(members = [], kind, id) {
    return members.map(normalizeMember).filter((m) => !(m.kind === kind && m.id === id));
}

export function upsertMembership(memberships = [], membership) {
    const next = normalizeMembership(membership);
    if (!next.organizationEntityId) return memberships;
    const existing = memberships.map(normalizeMembership);
    const idx = existing.findIndex((m) => m.organizationEntityId === next.organizationEntityId);
    if (idx === -1) return [...existing, next];
    const copy = existing.slice();
    copy[idx] = next;
    return copy;
}

export function removeMembership(memberships = [], organizationEntityId) {
    return memberships
        .map(normalizeMembership)
        .filter((m) => m.organizationEntityId !== organizationEntityId);
}
