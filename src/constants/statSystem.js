/** Fallback when no `stat_systems/system_{campaignId}` document exists */
export const DEFAULT_STAT_SYSTEM = [
    { key: "sneak", label: "Sneak", description: "Moverse con sigilo y silencio." },
    { key: "traverse", label: "Traverse", description: "Escalar, nadar, saltar, volar." },
    { key: "sense", label: "Sense", description: "Escanear y evaluar un área." },
    { key: "study", label: "Study", description: "Analizar detalles e investigar." },
    { key: "charm", label: "Charm", description: "Influir con carisma o diplomacia." },
    { key: "command", label: "Command", description: "Liderar o intimidar." },
    { key: "tinker", label: "Tinker", description: "Tecnología o alquimia." },
    { key: "excel", label: "Excel", description: "Precisión y equilibrio extremo." },
    { key: "smash", label: "Smash", description: "Fuerza física o mágica bruta." },
    { key: "endure", label: "Endure", description: "Soportar dolor o entornos hostiles." }
];

/** @deprecated Use DEFAULT_STAT_SYSTEM or load via useStatSystem */
export const STAT_SYSTEM = DEFAULT_STAT_SYSTEM;

/** Default ICON-style pools; override per campaign via stat_systems.resourceTracks */
export const DEFAULT_RESOURCE_TRACKS = [
    { key: "effort", label: "Effort", maxDefault: 3, stateKey: "exhausted", stateLabel: "Exhausted" },
    { key: "strain", label: "Strain", maxDefault: 5, stateKey: "broken", stateLabel: "Broken" }
];

/** Empty bond object — one per character in Firestore field `bond` */
export const emptyBond = () => ({
    name: "",
    archetype: "",
    description: "",
    specialAbility: "",
    secondWind: "",
    ideals: [],
    notes: ""
});

/** @param {typeof DEFAULT_STAT_SYSTEM} statDefs */
export const defaultStatsFromDefinitions = (statDefs) =>
    statDefs.reduce((acc, s) => ({ ...acc, [s.key]: 0 }), {});

export const defaultEffort = (max = 3) => ({
    current: 0,
    max,
    exhausted: false
});

export const defaultStrain = (max = 5) => ({
    current: 0,
    max,
    broken: false
});