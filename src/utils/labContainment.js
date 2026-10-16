/**
 * Qué puede contener cada ficha del Codex, y qué de eso se dibuja como grupo
 * en el Neural Lab.
 *
 * Los verbos no se inventan: salen de la matriz de la memoria
 * (`WIKI_RELATION_PAIR_MATRIX`). Un grupo no es un enlace nuevo. Es leer
 * un enlace que ya significa «está dentro».
 *
 * El tablero dibuja las fichas con impacto neural: afinidad (personaje, lugar,
 * organización, ideología) y los hechos que el circuito ya engancha (especie,
 * reliquia, acontecimiento, idioma). Era, arco, neutro y misión viven en el
 * solar. Crónica y glosario no entran en la cascada.
 */

import { WIKI_RELATION_TYPES as R } from "../constants/wikiRelationTypes.js";

export const LAB_BOARD_TYPES = [
    "personaje",
    "locacion",
    "organizacion",
    "ideologia",
    "especie",
    "reliquia",
    "evento_historico",
    "idioma",
];

/** Card del mock: 148 px de ancho, centro en el mapa, alto de media ficha 64. */
export const LAB_CARD = { w: 148, h: 128, gapX: 220, gapY: 160, originX: 220, originY: 180 };

/** @typedef {{ holds: string, via: string, holderEnd: "from"|"to", labGroup: "organizacion"|"lugar"|null, note: string }} Hold */

/** @type {Record<string, Hold[]>} */
export const CODEX_HOLDS = {
    personaje: [],
    locacion: [
        {
            holds: "locacion",
            via: R.PERTENECIENTE_A,
            holderEnd: "to",
            labGroup: "lugar",
            note: "El lugar menor apunta al más amplio: barrio a ciudad, ciudad a región.",
        },
        {
            holds: "personaje",
            via: R.VIVE_EN,
            holderEnd: "to",
            labGroup: "lugar",
            note: "Quien vive en el lugar.",
        },
        {
            holds: "organizacion",
            via: R.SEDE_EN,
            holderEnd: "to",
            labGroup: "lugar",
            note: "La organización tiene su sede en el lugar.",
        },
        {
            holds: "especie",
            via: R.HABITA_EN,
            holderEnd: "to",
            labGroup: null,
            note: "La especie habita el lugar. No es un grupo del tablero.",
        },
        {
            holds: "evento_historico",
            via: R.OCURRIO_EN,
            holderEnd: "to",
            labGroup: null,
            note: "El acontecimiento ocurrió ahí. El tiempo se ordena en el solar.",
        },
        {
            holds: "reliquia",
            via: R.CUSTODIA,
            holderEnd: "from",
            labGroup: null,
            note: "El lugar custodia la reliquia. El verbo sale del lugar.",
        },
    ],
    organizacion: [
        {
            holds: "personaje",
            via: R.MIEMBRO_CONFIRMADO_DE,
            holderEnd: "to",
            labGroup: "organizacion",
            note: "Miembro confirmado. El personaje apunta a la organización.",
        },
        {
            holds: "personaje",
            via: R.MIEMBRO_DE,
            holderEnd: "to",
            labGroup: "organizacion",
            note: "Miembro, sin el matiz de confirmado o sospechado.",
        },
        {
            holds: "personaje",
            via: R.MIEMBRO_SOSPECHADO_DE,
            holderEnd: "to",
            labGroup: "organizacion",
            note: "Se sospecha que es miembro.",
        },
        {
            holds: "reliquia",
            via: R.CUSTODIA,
            holderEnd: "from",
            labGroup: null,
            note: "La organización custodia la reliquia.",
        },
        {
            holds: "organizacion",
            via: R.CONTROLA,
            holderEnd: "from",
            labGroup: null,
            note: "Control es poder, no un cuarto donde sentar fichas.",
        },
        {
            holds: "locacion",
            via: R.CONTROLA,
            holderEnd: "from",
            labGroup: null,
            note: "La organización controla el lugar. Quien vive ahí sigue en vive_en.",
        },
    ],
    especie: [],
    reliquia: [],
    ideologia: [
        {
            holds: "personaje",
            via: R.PROFESA,
            holderEnd: "to",
            labGroup: null,
            note: "Profesar es afinidad. La ideología no guarda personajes dentro.",
        },
        {
            holds: "organizacion",
            via: R.PROFESA,
            holderEnd: "to",
            labGroup: null,
            note: "La organización profesa la ideología.",
        },
    ],
    idioma: [
        {
            holds: "personaje",
            via: R.HABLA,
            holderEnd: "to",
            labGroup: null,
            note: "Hablar un idioma no agrupa el tablero.",
        },
    ],
    evento_historico: [
        {
            holds: "personaje",
            via: R.PARTICIPO_EN,
            holderEnd: "to",
            labGroup: null,
            note: "El personaje participó en el acontecimiento. El solar ordena el tiempo.",
        },
        {
            holds: "organizacion",
            via: R.PARTICIPO_EN,
            holderEnd: "to",
            labGroup: null,
            note: "La organización participó en el acontecimiento.",
        },
    ],
    cronica: [
        {
            holds: "personaje",
            via: R.DOCUMENTA,
            holderEnd: "from",
            labGroup: null,
            note: "La crónica documenta. No contiene.",
        },
    ],
    glosario: [],
    neutro: [],
    era: [],
    arco: [],
    mision: [],
};

export const LAB_GROUP_MODES = [
    { id: "libre", label: "Libre" },
    { id: "organizacion", label: "Por organización" },
    { id: "lugar", label: "Por lugar" },
];

export const LAB_GROUP_RULES = Object.entries(CODEX_HOLDS).flatMap(([holder, rows]) =>
    rows.filter((row) => row.labGroup).map((row) => ({ ...row, holder })),
);

export function holdsOf(entityType) {
    return CODEX_HOLDS[entityType] || [];
}

function relType(row) {
    return row?.relation_type || row?.relationType || "";
}

function endId(row, end) {
    if (end === "from") return row?.from_ficha_id || row?.fromEntityId || "";
    return row?.to_ficha_id || row?.toEntityId || "";
}

/**
 * Enlaces de contención ya guardados.
 * @returns {{ parentId: string, childId: string, relation: string, group: string }[]}
 */
export function containmentLinks(entities = [], relations = [], group = "") {
    const byId = new Map((entities || []).filter((row) => row?.id).map((row) => [row.id, row]));
    const rules = LAB_GROUP_RULES.filter((rule) => !group || rule.labGroup === group);
    const out = [];
    for (const rel of relations || []) {
        const type = relType(rel);
        const from = byId.get(endId(rel, "from"));
        const to = byId.get(endId(rel, "to"));
        if (!from || !to) continue;
        for (const rule of rules) {
            if (type !== rule.via) continue;
            const holder = rule.holderEnd === "from" ? from : to;
            const held = rule.holderEnd === "from" ? to : from;
            if (holder.entityType !== rule.holder || held.entityType !== rule.holds) continue;
            out.push({
                parentId: holder.id,
                childId: held.id,
                relation: rule.via,
                group: rule.labGroup,
            });
        }
    }
    return out;
}

/**
 * Cajas que envuelven a un contenedor y lo que tiene dentro, con la posición actual.
 * Una ficha puede caer en más de una caja si pertenece a dos grupos.
 */
export function groupHulls(entities = [], relations = [], positions = {}, group = "") {
    if (!group || group === "libre") return [];
    const links = containmentLinks(entities, relations, group);
    const byParent = new Map();
    for (const link of links) {
        const bucket = byParent.get(link.parentId) || [];
        bucket.push(link.childId);
        byParent.set(link.parentId, bucket);
    }
    const hulls = [];
    for (const [parentId, childIds] of byParent) {
        const ids = [parentId, ...childIds];
        const boxes = ids.map((id) => positions[id]).filter((pos) => pos && Number.isFinite(pos.x));
        if (!boxes.length) continue;
        const minX = Math.min(...boxes.map((pos) => pos.x)) - 28;
        const minY = Math.min(...boxes.map((pos) => pos.y)) - 36;
        const maxX = Math.max(...boxes.map((pos) => pos.x + LAB_CARD.w)) + 28;
        const maxY = Math.max(...boxes.map((pos) => pos.y + LAB_CARD.h)) + 28;
        hulls.push({
            parentId,
            memberIds: childIds,
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
        });
    }
    return hulls;
}

function titleOf(entity) {
    return String(entity?.title || "").trim() || "Sin título";
}

/**
 * Acomoda cada contenedor en su columna y lo que contiene debajo.
 * El resto conserva su lugar. Devuelve solo las posiciones que cambian.
 */
export function packGroupPositions(entities = [], relations = [], positions = {}, group = "") {
    if (!group || group === "libre") return {};
    const links = containmentLinks(entities, relations, group);
    const byId = new Map(entities.filter((row) => row?.id).map((row) => [row.id, row]));
    const byParent = new Map();
    const claimed = new Set();
    for (const link of links) {
        if (!byId.has(link.parentId) || claimed.has(link.childId)) continue;
        claimed.add(link.childId);
        const list = byParent.get(link.parentId) || [];
        list.push(link.childId);
        byParent.set(link.parentId, list);
    }
    const parents = [...byParent.keys()].sort((a, b) =>
        titleOf(byId.get(a)).localeCompare(titleOf(byId.get(b)), "es"),
    );
    const next = {};
    parents.forEach((parentId, index) => {
        const x = LAB_CARD.originX + index * (LAB_CARD.w + LAB_CARD.gapX);
        const y = LAB_CARD.originY;
        next[parentId] = { x, y };
        const children = (byParent.get(parentId) || []).sort((a, b) =>
            titleOf(byId.get(a)).localeCompare(titleOf(byId.get(b)), "es"),
        );
        children.forEach((childId, row) => {
            next[childId] = { x, y: y + 140 + row * LAB_CARD.gapY };
        });
    });
    const changed = {};
    for (const [id, pos] of Object.entries(next)) {
        const prev = positions[id];
        if (!prev || prev.x !== pos.x || prev.y !== pos.y) changed[id] = pos;
    }
    return changed;
}

/**
 * Ofertas al seleccionar varias fichas. El padre es el único contenedor de la selección.
 * Los hijos apuntan hacia él con el verbo que ya permite la matriz.
 */
export function groupOffers(selected = []) {
    const list = (selected || []).filter((row) => row?.id);
    const orgs = list.filter((row) => row.entityType === "organizacion");
    const places = list.filter((row) => row.entityType === "locacion");
    const people = list.filter((row) => row.entityType === "personaje");
    const offers = [];
    if (orgs.length === 1 && people.length >= 1 && places.length === 0) {
        offers.push({
            id: "miembros",
            label: `Miembros de ${titleOf(orgs[0])}`,
            relation: R.MIEMBRO_CONFIRMADO_DE,
            parentId: orgs[0].id,
            childIds: people.map((row) => row.id),
        });
    }
    if (places.length === 1 && people.length >= 1 && orgs.length === 0) {
        offers.push({
            id: "viven",
            label: `Viven en ${titleOf(places[0])}`,
            relation: R.VIVE_EN,
            parentId: places[0].id,
            childIds: people.map((row) => row.id),
        });
    }
    if (places.length === 1 && orgs.length >= 1 && people.length === 0) {
        offers.push({
            id: "sede",
            label: `Sede en ${titleOf(places[0])}`,
            relation: R.SEDE_EN,
            parentId: places[0].id,
            childIds: orgs.map((row) => row.id),
        });
    }
    if (places.length >= 2 && orgs.length === 0 && people.length === 0) {
        const parent = places[0];
        offers.push({
            id: "pertenece",
            label: `Pertenecen a ${titleOf(parent)}`,
            relation: R.PERTENECIENTE_A,
            parentId: parent.id,
            childIds: places.slice(1).map((row) => row.id),
        });
    }
    return offers;
}
