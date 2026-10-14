/** Codex types, order and copy from the Archive mock (`memoria-archive-en-app.html`, TYPES / ORDER / FORM_ORDER). */
export const CODEX_TYPES = {
    personaje: { label: "Personaje", plural: "Personajes", code: "PE", color: "#ff66ff" },
    locacion: { label: "Lugar", plural: "Lugares", code: "LU", color: "#00f2ea" },
    organizacion: { label: "Organización", plural: "Organizaciones", code: "OR", color: "#ffaa00" },
    especie: { label: "Especie", plural: "Especies", code: "ES", color: "#88ff44" },
    reliquia: { label: "Reliquia", plural: "Reliquias", code: "RE", color: "#ff6644" },
    ideologia: { label: "Ideología", plural: "Ideologías", code: "ID", color: "#aa66ff" },
    idioma: { label: "Idioma", plural: "Idiomas", code: "LG", color: "#66ddaa" },
    evento_historico: { label: "Acontecimiento", plural: "Acontecimientos", code: "EV", color: "#7777ff" },
    neutro: { label: "Neutro", plural: "Neutros", code: "NE", color: "#d5d8e0" },
    era: { label: "Era", plural: "Eras", code: "ER", color: "#f5c542" },
    arco: { label: "Arco", plural: "Arcos", code: "AR", color: "#ff66aa" },
    mision: { label: "Misión", plural: "Misiones", code: "MI", color: "#66ccff" },
    cronica: { label: "Crónica", plural: "Crónicas", code: "CR", color: "#aaaaaa" },
    glosario: { label: "Glosario", plural: "Glosario", code: "GL", color: "#dddddd" },
};

export const CODEX_ORDER = [
    "personaje", "locacion", "organizacion", "especie", "reliquia", "ideologia", "idioma",
    "evento_historico", "neutro", "era", "arco", "mision", "cronica", "glosario",
];

/** Form order is a suggestion, not a lock. Neutro, era, arco and acontecimiento are fichas and solar nodes. */
export const CODEX_FORM_ORDER = [
    "idioma", "glosario", "cronica", "ideologia", "especie", "locacion", "organizacion",
    "reliquia", "mision", "personaje", "evento_historico", "neutro", "era", "arco",
];

export const CODEX_AUTOSAVE_MS = 650;
export const CODEX_SAVED_CLEAR_MS = 1600;

export const CODEX_COPY = {
    groupHelp: "Cada grupo se abre y se cierra por separado. Filtrar no los vuelve a abrir.",
    formOrder: "Orden sugerido: idioma y glosario, luego crónica, ideología y especie. No impide crear un personaje sin idioma.",
    bodyHelp: "Escribe @ para mencionar. Los nombres sin enlazar se cuentan abajo.",
    bodyPlaceholder: "Escribe el texto de la ficha. Usa @ para mencionar.",
    affinityHelp: "Barra −10…+10. Es la misma del Dossier y la mueve la cascada del Neural Lab.",
    factsHelp: "Vínculos fijos, agrupados por tipo. Sin barra de sync y sin id en la pastilla.",
    noAffinity: "Sin afinidades todavía.",
    noFacts: "Sin hechos. Son vínculos sin sync: idioma que habla, evento en que participó…",
    newInRail: "La ficha nueva aparece en el índice al guardarla.",
    pickOne: "Elige una ficha.",
    deleteConfirm: (title) => `¿Eliminar «${title}»? Caen sus vínculos. Un hijo queda con el padre en blanco y conserva su fecha.`,
    deleteBlockedVtt: (title) => `«${title}» tiene una instancia VTT. El borrado se detiene: desvincula primero.`,
    deleteBlockedPin: (title) => `«${title}» tiene un pin de mesa. El borrado se detiene: desvincula primero.`,
};

export function codexTitleFallback(entityType) {
    return entityType === "evento_historico" ? "Nuevo acontecimiento" : "Sin título";
}
