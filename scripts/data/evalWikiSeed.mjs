/**
 * Declarative seed manifest — Reino de Aldermar (genérico, evaluación Lab IA).
 * Mundo de fantasía independiente de Valtia-01. Caso Eval 01: Aldric / Serene / Elara.
 */

/** @typedef {{ slug: string, entityType: string, title: string, summary?: string, body?: string, visibility?: string, tags?: string[], meta?: object, refs?: object, members?: object[], organizations?: object[] }} SeedEntity */
/** @typedef {{ from: string, to: string, relationType: string, strength?: number, label?: string }} SeedRelation */

/** Placeholder — reemplazar tras crear campaña en Firebase test. */
export const SEED_CAMPAIGN_ID = "";

export const CREATION_PHASES = [
    "idioma",
    "ideologia",
    "locacion",
    "especie",
    "organizacion",
    "personaje",
    "reliquia",
    "evento_historico",
    "cronica",
];

/** @type {SeedEntity[]} */
export const ENTITIES = [
    // ── Idiomas ─────────────────────────────────────────────────────────────
    {
        slug: "lengua-comun",
        entityType: "idioma",
        title: "Lengua Común",
        summary: "Idioma mercantil y cortesano del continente.",
        body: "Se habla en @[solhaven], @[northmark] y la mayoría de feudos. Es la lengua de tratados, crónicas y comercio.",
        tags: ["idioma", "aldermar"],
    },
    {
        slug: "runas-antiguas",
        entityType: "idioma",
        title: "Runas Antiguas",
        summary: "Escritura ritual de los primeros reyes.",
        body: "Usada en coronaciones, sellos reales y grimorios de la @[orden-luz-antigua]. Pocos la leen; muchos la temen.",
        tags: ["idioma", "ritual", "magia"],
    },

    // ── Ideologías ──────────────────────────────────────────────────────────
    {
        slug: "derecho-divino",
        entityType: "ideologia",
        title: "Derecho Divino de los Reyes",
        summary: "La corona recibe su mandato de las estrellas.",
        body: "Doctrina oficial de @[aldermar]: el monarca gobierna por designio celestial. Desafiar al rey es desafiar el orden del mundo.",
        tags: ["politica", "aldermar"],
        refs: { holyLanguageEntityId: "runas-antiguas" },
        meta: { ideologyKind: "religion", spread: "regional" },
    },
    {
        slug: "pacto-antiguo",
        entityType: "ideologia",
        title: "Pacto de la Corona y la Sangre",
        summary: "El poder real exige sacrificio personal.",
        body: "Creencia cortesana: cada rey paga un precio oculto por mantener el reino. Algunos lo interpretan como deber; otros como maldición.",
        tags: ["corte", "secreto"],
        meta: { ideologyKind: "filosofia", spread: "local" },
    },

    // ── Locaciones ──────────────────────────────────────────────────────────
    {
        slug: "aldermar",
        entityType: "locacion",
        title: "Reino de Aldermar",
        summary: "Reino feudal costero, gobernado por la Casa Real Alder.",
        body: "Tierras fértiles, puertos prósperos y una corte que projeta estabilidad pese a intrigas internas. @[aldric] ostenta el trono desde hace veinte años.",
        tags: ["reino", "aldermar"],
        refs: {
            dominantLanguageEntityId: "lengua-comun",
            dominantIdeologyEntityId: "derecho-divino",
            dominantSpeciesEntityId: "humano",
        },
        meta: { locationKind: "reino", climate: "templado" },
    },
    {
        slug: "solhaven",
        entityType: "locacion",
        title: "Solhaven",
        summary: "Capital de Aldermar; ciudad de mármol y astilleros.",
        body: "Sede del palacio real y del @[consejo-real]. @[elara] vive aquí como heredera en formación.",
        tags: ["capital", "aldermar"],
        refs: {
            parentLocationEntityId: "aldermar",
            dominantLanguageEntityId: "lengua-comun",
            dominantIdeologyEntityId: "derecho-divino",
        },
        meta: { locationKind: "ciudad", population: "grande" },
    },
    {
        slug: "palacio-aldric",
        entityType: "locacion",
        title: "Palacio Real de Solhaven",
        summary: "Residencia de la Casa Alder.",
        body: "Salones donde se decide el destino del reino. Tras la muerte de @[serene], el palacio guarda silencios incómodos.",
        tags: ["corte", "palacio"],
        refs: { parentLocationEntityId: "solhaven" },
        meta: { locationKind: "edificio" },
    },
    {
        slug: "northmark",
        entityType: "locacion",
        title: "Northmark",
        summary: "Reino rival al norte; frontera disputada.",
        body: "Monarquía más joven, ambiciosa. @[lord-vex] mantiene contactos discretos con facciones northmarianas.",
        tags: ["reino", "rival"],
        refs: { dominantLanguageEntityId: "lengua-comun" },
        meta: { locationKind: "reino" },
    },

    // ── Especies ────────────────────────────────────────────────────────────
    {
        slug: "humano",
        entityType: "especie",
        title: "Humano",
        summary: "Pueblo dominante en Aldermar y Northmark.",
        body: "Varios linajes nobles compiten por influencia. La sangre real Alder se considera tocada por las estrellas.",
        tags: ["especie"],
        refs: { homeworldEntityId: "aldermar", languageEntityIds: ["lengua-comun"] },
    },

    // ── Organizaciones ──────────────────────────────────────────────────────
    {
        slug: "casa-real-alder",
        entityType: "organizacion",
        title: "Casa Real Alder",
        summary: "Dinastía reinante de Aldermar.",
        body: "Linaje que reclama descendencia de los primeros reyes estelares. @[aldric] es su cabeza visible; @[elara] la heredera designada.",
        tags: ["nobleza", "realeza"],
        refs: { headquartersEntityId: "palacio-aldric" },
        members: [
            { kind: "wiki", slug: "aldric", status: "confirmado", role: "Rey" },
            { kind: "wiki", slug: "elara", status: "confirmado", role: "Heredera" },
            { kind: "wiki", slug: "serene", status: "confirmado", role: "Reina (fallecida)" },
        ],
        meta: { orgKind: "casa_noble" },
    },
    {
        slug: "guardia-real",
        entityType: "organizacion",
        title: "Guardia Real de Solhaven",
        summary: "Élite militar que protege al monarca.",
        body: "Leal en apariencia; algunos capitanes recuerdan la noche en que murió @[serene].",
        tags: ["militar", "corte"],
        refs: { headquartersEntityId: "palacio-aldric" },
        members: [{ kind: "wiki", slug: "aldric", status: "confirmado", role: "Comandante en jefe" }],
        meta: { orgKind: "militar" },
    },
    {
        slug: "orden-luz-antigua",
        entityType: "organizacion",
        title: "Orden de la Luz Antigua",
        summary: "Cofradía de magos y cronistas reales.",
        body: "Custodia runas, profecías y reliquias. @[lady-vex] es su voz más audible en corte.",
        tags: ["magia", "cronicas"],
        refs: { headquartersEntityId: "solhaven" },
        members: [{ kind: "wiki", slug: "lady-vex", status: "confirmado", role: "Magistrada" }],
        meta: { orgKind: "orden" },
    },
    {
        slug: "consejo-real",
        entityType: "organizacion",
        title: "Consejo Real",
        summary: "Cuerpo consultivo del trono.",
        body: "Nobles y burócratas que administran impuestos, justicia y diplomacia. @[marcus] lo preside con eficiencia fría.",
        tags: ["politica", "administracion"],
        refs: { headquartersEntityId: "palacio-aldric" },
        members: [{ kind: "wiki", slug: "marcus", status: "confirmado", role: "Gran Canciller" }],
        meta: { orgKind: "institucion" },
    },

    // ── Personajes ──────────────────────────────────────────────────────────
    {
        slug: "aldric",
        entityType: "personaje",
        title: "Rey Aldric Alder",
        summary: "Monarca de Aldermar; viudo desde la muerte de Serene.",
        body: "Respetado por estabilidad y temido por su reserva. Su reinado se fracturó cuando @[serene] murió; @[elara] es su única heredera.",
        tags: ["rey", "aldermar"],
        refs: { speciesEntityId: "humano", birthPlaceEntityId: "solhaven" },
        organizations: [{ slug: "casa-real-alder", status: "confirmado", role: "Rey" }],
        meta: {
            role: "monarca",
            status: "vivo",
            bondNotes: "Serene fue su ancla emocional; su muerte lo convirtió en un rey más duro. Elara es la razón que lo mantiene en el trono.",
        },
    },
    {
        slug: "elara",
        entityType: "personaje",
        title: "Princesa Elara Alder",
        summary: "Heredera al trono; hija de Aldric y Serene.",
        body: "Joven de temple fuerte, entrenada en espada y protocolo. Aún no conoce toda la verdad sobre la muerte de su madre.",
        tags: ["heredera", "aldermar"],
        refs: { speciesEntityId: "humano", birthPlaceEntityId: "solhaven" },
        organizations: [{ slug: "casa-real-alder", status: "confirmado", role: "Heredera" }],
        meta: {
            role: "noble",
            status: "vivo",
            bondNotes: "Aldric es la figura que más respeta y teme. Serene es una ausencia que moldea cada decisión sin que Elara lo admita.",
        },
    },
    {
        slug: "serene",
        entityType: "personaje",
        title: "Reina Serene Alder",
        summary: "Reina fallecida; esposa de Aldric y madre de Elara.",
        body: "Murió cuando @[elara] tenía cuatro años. La corte oficial habla de enfermedad; los rumores nunca cesaron.",
        tags: ["reina", "fallecida"],
        refs: { speciesEntityId: "humano", birthPlaceEntityId: "solhaven", deathPlaceEntityId: "palacio-aldric" },
        organizations: [{ slug: "casa-real-alder", status: "confirmado", role: "Reina consorte" }],
        meta: {
            role: "noble",
            status: "fallecido",
            bondNotes: "Aldric era su equilibrio; Elara era su proyecto de vida. Su ausencia dejó al reino sin brújula emocional.",
        },
    },
    {
        slug: "marcus",
        entityType: "personaje",
        title: "Gran Canciller Marcus",
        summary: "Administrador del reino; mano derecha de Aldric.",
        body: "Pragmático, leal al trono más que a las personas. Sabe más de la noche de @[serene] de lo que dice en público.",
        tags: ["corte", "consejo"],
        refs: { speciesEntityId: "humano", birthPlaceEntityId: "solhaven" },
        organizations: [{ slug: "consejo-real", status: "confirmado", role: "Gran Canciller" }],
        meta: { role: "burocrata", status: "vivo" },
    },
    {
        slug: "lady-vex",
        entityType: "personaje",
        title: "Lady Vex",
        summary: "Magistrada de la Orden de la Luz Antigua.",
        body: "Consejera oculta de @[aldric] en asuntos arcanos. Desconfía de @[northmark] y vigila a @[elara].",
        tags: ["magia", "corte"],
        refs: { speciesEntityId: "humano", birthPlaceEntityId: "solhaven" },
        organizations: [{ slug: "orden-luz-antigua", status: "confirmado", role: "Magistrada" }],
        meta: { role: "mago", status: "vivo" },
    },

    // ── Reliquias ───────────────────────────────────────────────────────────
    {
        slug: "corona-aldermar",
        entityType: "reliquia",
        title: "Corona de las Estrellas",
        summary: "Corona real de Aldermar.",
        body: "Forjada con runas de @[runas-antiguas]. Solo un Alder puede llevarla sin consecuencias, según la tradición.",
        tags: ["reliquia", "corona"],
        refs: { currentHolderEntityId: "aldric", originLocationEntityId: "solhaven" },
        meta: { relicKind: "corona" },
    },
    {
        slug: "espada-elara",
        entityType: "reliquia",
        title: "Espada de la Heredera",
        summary: "Hoja ceremonial entregada a Elara.",
        body: "Regalo de @[aldric] cuando cumplió quince años. Simboliza la sucesión y la expectativa del reino.",
        tags: ["reliquia", "arma"],
        refs: { currentHolderEntityId: "elara", originLocationEntityId: "palacio-aldric" },
        meta: { relicKind: "arma" },
    },

    // ── Eventos ─────────────────────────────────────────────────────────────
    {
        slug: "muerte-serene",
        entityType: "evento_historico",
        title: "Muerte de la Reina Serene",
        summary: "Pérdida de la reina; detonante del aislamiento de Aldric.",
        body: "Ocurrió en el @[palacio-aldric]. La versión oficial habla de fiebre; la corte susurra otras causas.",
        tags: ["evento", "tragedia"],
        meta: {
            date: "Año 12 del reinado de Aldric",
            eventKind: "politico",
            certainty: "canon",
            isCore: true,
            narrativeArc: "secreto-real",
        },
    },
    {
        slug: "coronacion-aldric",
        entityType: "evento_historico",
        title: "Coronación de Aldric",
        summary: "Ascenso de Aldric al trono de Aldermar.",
        body: "Ceremonia en @[solhaven] con la @[corona-aldermar]. @[serene] fue proclamada reina consorte el mismo día.",
        tags: ["evento", "coronacion"],
        meta: { date: "Año 0 Aldermar", eventKind: "politico", certainty: "canon" },
    },

    // ── Crónicas ────────────────────────────────────────────────────────────
    {
        slug: "cronica-fundacion-aldermar",
        entityType: "cronica",
        title: "Crónica de la Fundación de Aldermar",
        summary: "Relato de los primeros reyes estelares.",
        body: "Describe cómo los Alder unieron los feudos costeros bajo una sola corona.",
        tags: ["cronica", "historia"],
        meta: { category: "historia", isLocked: false },
    },
    {
        slug: "cronica-corte-serene",
        entityType: "cronica",
        title: "Retratos de la Corte de Serene",
        summary: "Notas sobre la reina consorte y su círculo.",
        body: "Menciona la devoción de Serene hacia Elara y su tensión creciente con facciones del @[consejo-real].",
        tags: ["cronica", "corte"],
        meta: { category: "corte", isLocked: false },
    },
];

/** @type {SeedRelation[]} */
export const RELATIONS = [
    // Jerarquía territorial
    { from: "solhaven", to: "aldermar", relationType: "perteneciente_a", strength: 0 },
    { from: "palacio-aldric", to: "solhaven", relationType: "perteneciente_a", strength: 0 },
    { from: "aldric", to: "aldermar", relationType: "controla", strength: 10 },
    { from: "aldric", to: "solhaven", relationType: "vive_en", strength: 0 },
    { from: "elara", to: "palacio-aldric", relationType: "vive_en", strength: 0 },
    { from: "serene", to: "palacio-aldric", relationType: "vive_en", strength: 0 },
    { from: "marcus", to: "solhaven", relationType: "vive_en", strength: 0 },
    { from: "lady-vex", to: "solhaven", relationType: "vive_en", strength: 0 },

    // Casa real — triángulo Caso Eval 01
    { from: "aldric", to: "casa-real-alder", relationType: "miembro_confirmado_de", strength: 10 },
    { from: "elara", to: "casa-real-alder", relationType: "miembro_confirmado_de", strength: 8 },
    { from: "serene", to: "casa-real-alder", relationType: "miembro_confirmado_de", strength: 8 },
    { from: "elara", to: "aldric", relationType: "descendiente_de", strength: 9 },
    { from: "elara", to: "serene", relationType: "descendiente_de", strength: 9 },
    { from: "serene", to: "aldric", relationType: "relacionado_con", strength: 9, label: "esposa de" },

    // Otras organizaciones
    { from: "marcus", to: "consejo-real", relationType: "miembro_confirmado_de", strength: 9 },
    { from: "lady-vex", to: "orden-luz-antigua", relationType: "miembro_confirmado_de", strength: 8 },
    { from: "consejo-real", to: "palacio-aldric", relationType: "sede_en", strength: 0 },
    { from: "guardia-real", to: "palacio-aldric", relationType: "sede_en", strength: 0 },
    { from: "orden-luz-antigua", to: "solhaven", relationType: "sede_en", strength: 0 },

    // Ideología y lenguas
    { from: "aldric", to: "derecho-divino", relationType: "profesa", strength: 7 },
    { from: "aldric", to: "lengua-comun", relationType: "habla", strength: 0 },
    { from: "elara", to: "lengua-comun", relationType: "habla", strength: 0 },
    { from: "serene", to: "lengua-comun", relationType: "habla", strength: 0 },
    { from: "lady-vex", to: "runas-antiguas", relationType: "habla", strength: 5 },
    { from: "derecho-divino", to: "runas-antiguas", relationType: "relacionado_con", strength: 4 },

    // Reliquias
    { from: "aldric", to: "corona-aldermar", relationType: "relacionado_con", strength: 8, label: "portador" },
    { from: "elara", to: "espada-elara", relationType: "relacionado_con", strength: 7 },

    // Eventos
    { from: "muerte-serene", to: "palacio-aldric", relationType: "ocurrio_en", strength: 0 },
    { from: "coronacion-aldric", to: "solhaven", relationType: "ocurrio_en", strength: 0 },
    { from: "serene", to: "muerte-serene", relationType: "participo_en", strength: 0 },
    { from: "aldric", to: "muerte-serene", relationType: "participo_en", strength: 0 },
    { from: "coronacion-aldric", to: "aldric", relationType: "participo_en", strength: 0 },
    { from: "coronacion-aldric", to: "serene", relationType: "participo_en", strength: 0 },

    // Crónicas
    { from: "cronica-fundacion-aldermar", to: "aldermar", relationType: "documenta", strength: 0 },
    { from: "cronica-corte-serene", to: "serene", relationType: "documenta", strength: 0 },
    { from: "cronica-corte-serene", to: "palacio-aldric", relationType: "documenta", strength: 0 },

    // Tensiones externas
    { from: "lady-vex", to: "northmark", relationType: "relacionado_con", strength: -3, label: "vigila" },
    { from: "aldric", to: "northmark", relationType: "relacionado_con", strength: -5, label: "rival" },
];

/** Prompt estándar para protocolo de evaluación (Caso Eval 01). */
export const EVAL_CASO_01_INSTRUCTION =
    "Se descubre que Aldric, el padre de Elara, asesinó a Serene, su esposa (y madre de Elara) para salvarla, ya que esta quería asesinarla.";

export const EVAL_CASO_01_ANCHOR = "elara";
