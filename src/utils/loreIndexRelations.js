/**
 * The solar index and the structural edge are the same fact.
 * `participo_en` is a person on the node; `ocurrio_en` is a place.
 * Dropping one side drops the other.
 */

import { idList } from "./archiveTimeline.js";

function typeOf(row) {
    return row?.relation_type || row?.relationType || "";
}

function endsOf(row) {
    return [row?.from_ficha_id || row?.fromEntityId || "", row?.to_ficha_id || row?.toEntityId || ""];
}

/**
 * Edges of this node that name someone no longer in its own index.
 * @param {object[]} relaciones
 * @param {string} nodeId
 * @param {string[]} people
 * @param {string[]} places
 */
export function relationsDroppedByIndex(relaciones, nodeId, people, places) {
    const keepPeople = new Set(people || []);
    const keepPlaces = new Set(places || []);
    return (relaciones || []).filter((row) => {
        const [from, to] = endsOf(row);
        if (from !== nodeId && to !== nodeId) return false;
        const other = from === nodeId ? to : from;
        const type = typeOf(row);
        if (type === "participo_en") return !keepPeople.has(other);
        if (type === "ocurrio_en") return !keepPlaces.has(other);
        return false;
    });
}

/**
 * Index lists that still name an endpoint of a dropped structural edge.
 * @param {object[]} fichas
 * @param {object} relation
 * @returns {{ id: string, patch: object }[]}
 */
export function indexPatchesAfterDrop(fichas, relation) {
    const type = typeOf(relation);
    const field = type === "participo_en" ? "index_personajes" : type === "ocurrio_en" ? "index_lugares" : "";
    if (!field) return [];
    const ends = new Set(endsOf(relation).filter(Boolean));
    const patches = [];
    for (const node of fichas || []) {
        if (!node?.id) continue;
        const list = idList(node[field] ?? (field === "index_personajes" ? node.people : node.places));
        const next = list.filter((id) => id === node.id || !ends.has(id));
        if (next.length !== list.length) patches.push({ id: node.id, patch: { [field]: next } });
    }
    return patches;
}
