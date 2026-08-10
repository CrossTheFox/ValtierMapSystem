/**
 * Glosario explicativo de TODOS los conceptos del sistema (archivo narrativo,
 * entidades wiki, relaciones, IA narrativa, VTT y hoja de personaje).
 *
 * Fuente de verdad para la UI de ayuda (SystemGlossaryDialog).
 */

import { WIKI_AREAS, WIKI_ARCHIVE_INTRO } from "./wiki";
import { WIKI_ENTITY_TYPE_LABELS, WIKI_ENTITY_TYPES } from "./wikiEntityTypes";
import {
    AI_MODES,
    AI_MODE_LABELS,
    AI_MODE_TOOLTIPS,
    SITUATION_INTENTS,
    AI_PROVIDER_LABELS,
    AI_PROVIDER_TOOLTIPS,
    CONFIDENCE_TOOLTIPS,
    TONE_LABELS,
} from "./wiki/narrativeAiSchemas";
import {
    AI_CONFIG_CATEGORY_LABELS,
    AI_RULE_PRESETS,
} from "./wiki/narrativeAiConfig";
import {
    DIET_LABELS,
    SIZE_CATEGORY_LABELS,
    POPULATION_SCALE_LABELS,
    CHARACTER_KIND_LABELS,
    LOCATION_KIND_LABELS,
    POPULATION_ORDER_LABELS,
    ORGANIZATION_KIND_LABELS,
    ORGANIZATION_SIZE_LABELS,
    EVENT_KIND_LABELS,
    EVENT_CERTAINTY_LABELS,
    RELIC_KIND_LABELS,
    RELIC_POWER_TIER_LABELS,
    IDEOLOGY_KIND_LABELS,
    IDEOLOGY_SPREAD_LABELS,
    CRONICA_CATEGORY_LABELS,
    MEMBERSHIP_STATUS,
    MEMBERSHIP_STATUS_LABELS,
    REACTION_ARCHETYPE_LABELS,
    REACTION_ARCHETYPE_TOOLTIPS,
    NARRATIVE_STATE_LABELS,
    NARRATIVE_STATE_TOOLTIPS,
    STRESS_RESPONSE_LABELS,
    STRESS_RESPONSE_TOOLTIPS,
    COLLECTIVE_ARCHETYPE_LABELS,
    COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS,
    NARRATIVE_PERSONALITY_SECTION_HELP,
    REACTION_ARCHETYPE_FIELD_HELP,
    NARRATIVE_STATE_FIELD_HELP,
    STRESS_RESPONSE_FIELD_HELP,
    NARRATIVE_TRAITS_FIELD_HELP,
    BOND_NOTES_FIELD_HELP,
} from "./wiki/entityFieldSchemas";
import {
    WIKI_RELATION_TYPE_LABELS,
    WIKI_RELATION_STRENGTH_MIN,
    WIKI_RELATION_STRENGTH_MAX,
} from "./wikiRelationTypes";

/** @typedef {{ term: string, definition: string, tags?: string[] }} GlossaryEntry */
/** @typedef {{ id: string, title: string, description?: string, entries: GlossaryEntry[] }} GlossarySection */

/** Convierte un mapa value→label en lista legible para definiciones. */
function enumList(labelMap) {
    return Object.values(labelMap).join(" · ");
}

/** Entradas derivadas de un mapa label + tooltips opcionales. */
function entriesFromEnum(labelMap, tooltips = {}) {
    return Object.entries(labelMap).map(([key, label]) => ({
        term: label,
        definition: tooltips[key] || `Valor del sistema: ${label}.`,
        tags: [label.toLowerCase()],
    }));
}

/** @type {GlossarySection[]} */
export const SYSTEM_GLOSSARY_SECTIONS = [
    {
        id: "archive",
        title: "Archivo narrativo",
        description: "Superficies del NARRATIVE_ARCHIVE y cómo se relacionan.",
        entries: [
            {
                term: "Narrative Archive",
                definition:
                    "Panel principal del lore de campaña. Agrupa crónica desbloqueable, códice de entidades, línea temporal y diario de sesiones. El circuito NEURAL_LAB vive como botón aparte en el VTT.",
            },
            {
                term: "CODEX",
                definition: WIKI_AREAS.find((a) => a.id === "codex")?.description
                    ?? "Fichas del mundo: personajes, locaciones, organizaciones, especies, reliquias, ideologías, idiomas y términos de glosario.",
            },
            {
                term: "TIMELINE",
                definition: WIKI_AREAS.find((a) => a.id === "timeline")?.description
                    ?? "Eventos históricos ordenados en el calendario D.Z., con ramas paralelas opcionales.",
            },
            {
                term: "NEURAL_LAB",
                definition: WIKI_AREAS.find((a) => a.id === "neural_lab")?.description
                    ?? "Circuito Sync-Axis de campaña (overview de personajes + foco) y laboratorio de IA del DJ, fuera del Archive.",
            },
            {
                term: "SESSIONS",
                definition: WIKI_AREAS.find((a) => a.id === "sessions")?.description
                    ?? "Diario de sesiones: título, fecha, participantes y recap. Los recaps alimentan el contexto del Lab IA.",
            },
            {
                term: "CHRONICLE (Crónica)",
                definition: WIKI_AREAS.find((a) => a.id === "lore")?.description
                    ?? "Textos narrativos que el DJ desbloquea para jugadores según avanza la campaña.",
            },
            {
                term: "Intro del códice",
                definition: WIKI_ARCHIVE_INTRO,
            },
            {
                term: "@menciones",
                definition:
                    "En el cuerpo Markdown de una ficha puedes escribir @NombreDeEntidad para enlazar otras fichas. Al leer, el enlace abre la entidad referenciada.",
            },
            {
                term: "Visibilidad: Solo DM",
                definition:
                    "La ficha existe en Firestore pero los jugadores no la ven en modo lectura. Útil para secretos, notas de preparación o borradores.",
            },
            {
                term: "Visibilidad: Jugadores",
                definition:
                    "La ficha es visible en el archivo en modo lectura. El resumen y cuerpo (salvo lore marcado dm_only en generación IA) pueden consultarse en mesa.",
            },
            {
                term: "Etiquetas (tags)",
                definition:
                    "Palabras clave libres para filtrar y buscar fichas (faccción, tema, era). No sustituyen relaciones estructuradas del grafo.",
            },
        ],
    },
    {
        id: "entity_types",
        title: "Tipos de entidad wiki",
        description: "Qué es cada tipo de ficha y para qué sirve en el mundo.",
        entries: Object.entries(WIKI_ENTITY_TYPE_LABELS).map(([type, label]) => {
            const defs = {
                [WIKI_ENTITY_TYPES.PERSONAJE]:
                    "Figura del lore: PNJ, PJ narrativo, deidad o histórico. Puede enlazarse a un token VTT jugable. Incluye cronología, afiliaciones y personalidad para IA.",
                [WIKI_ENTITY_TYPES.LOCACION]:
                    "Lugar del mundo en jerarquía macro→micro (plano, país, ciudad, edificio…). Puede vincularse a un marcador del mapa VTT.",
                [WIKI_ENTITY_TYPES.ORGANIZACION]:
                    "Grupo con identidad propia: gremio, casa noble, facción criminal, estado, culto armado, etc. Tiene sede, integrantes y temperamento colectivo para IA.",
                [WIKI_ENTITY_TYPES.ESPECIE]:
                    "Raza o linaje biológico/cultural. Define dieta, tamaño, escala poblacional, longevidad e idiomas nativos.",
                [WIKI_ENTITY_TYPES.RELIQUIA]:
                    "Objeto, artefacto, maldición o reliquia ICON con creador, portador, origen y nivel de poder.",
                [WIKI_ENTITY_TYPES.IDEOLOGIA]:
                    "Religión, filosofía, culto, ética profesional o movimiento. Puede tener idioma litúrgico, tabúes y figura principal.",
                [WIKI_ENTITY_TYPES.IDIOMA]:
                    "Lengua del mundo. No tiene panel estructurado extra: se documenta con resumen y cuerpo Markdown. Otras entidades referencian idiomas nativos o predominantes.",
                [WIKI_ENTITY_TYPES.EVENTO_HISTORICO]:
                    "Suceso datado en la línea temporal (batalla, tratado, cataclismo…). Aparece en TIMELINE y puede enlazar actores y lugares.",
                [WIKI_ENTITY_TYPES.CRONICA]:
                    "Entrada de lore desbloqueable para jugadores. Puede estar bloqueada hasta cumplir una condición (unlockGoal).",
                [WIKI_ENTITY_TYPES.GLOSARIO]:
                    "Término de reglas o definición breve. Sus alias permiten resaltar la palabra en habilidades, chat y texto wiki con tooltip al pasar el cursor.",
            };
            return {
                term: label,
                definition: defs[type] ?? `Tipo de entidad: ${label}.`,
                tags: [label.toLowerCase(), type],
            };
        }),
    },
    {
        id: "common_fields",
        title: "Campos comunes de toda ficha",
        entries: [
            {
                term: "Título",
                definition:
                    "Nombre canónico de la entidad. Es lo que aparece en listados, grafo, menciones @ y respuestas de la IA (debe coincidir literalmente con el contexto enviado al modelo).",
            },
            {
                term: "Resumen (summary)",
                definition:
                    "Síntesis corta visible en tarjetas, grafo y contexto IA. Ideal para el dato esencial sin spoilers del cuerpo largo.",
            },
            {
                term: "Cuerpo (body)",
                definition:
                    "Texto libre en Markdown: historia, notas de mesa, mecánicas, secretos. Admite imágenes inline y @menciones a otras fichas.",
            },
            {
                term: "Imagen de portada",
                definition:
                    "Retrato, emblema, mapa o ilustración según el tipo. Se usa en listados, detalle y nodos del grafo (con cadena de fallback si falta).",
            },
            {
                term: "Relaciones",
                definition:
                    "Vínculos dirigidos entre dos entidades (ej. «Aliado de», «Vive en», «Custodia»). Cada relación tiene tipo, intensidad opcional (-10 a +10) y etiqueta libre.",
            },
            {
                term: "Intensidad de relación",
                definition:
                    `Número de ${WIKI_RELATION_STRENGTH_MIN} (hostilidad extrema) a ${WIKI_RELATION_STRENGTH_MAX} (vínculo muy fuerte). Algunos tipos traen valor por defecto (ej. enemigo_de ≈ -8, aliado_de ≈ +7).`,
            },
            {
                term: "Mencionado en (backlinks)",
                definition:
                    "Fichas que enlazan a esta entidad mediante @mención en su cuerpo, aunque no exista relación formal en el grafo.",
            },
            {
                term: "Vínculo VTT",
                definition:
                    "En personaje wiki → token jugable del mapa; en locación wiki → marcador del mapa. Prioriza PJs en generación IA y sincroniza lore con la mesa virtual.",
            },
        ],
    },
    {
        id: "personaje",
        title: "Personaje (campos estructurados)",
        entries: [
            {
                term: "Tipo de personaje",
                definition: `Clasificación temporal/narrativa: ${enumList(CHARACTER_KIND_LABELS)}. Los históricos pueden excluirse de reacciones IA a eventos actuales (configurable).`,
            },
            {
                term: "Especie",
                definition: "Referencia a ficha de especie. Define linaje biológico y rasgos culturales base del personaje.",
            },
            {
                term: "Títulos / epítetos",
                definition:
                    "Honores, apodos o cargos formales («Reina de Mirage», «El Sin Nombre»). Chips de texto libre; no son relaciones del grafo.",
            },
            {
                term: "Era activa",
                definition: "Etiqueta de contexto temporal («Era de Cenizas») para orientar en qué momento del lore está activo el personaje.",
            },
            {
                term: "Ocupación",
                definition: "Oficio, rol social o función habitual (soldado, embajador, cosechador de reliquias…).",
            },
            {
                term: "Presentación de género",
                definition: "Cómo se presenta el personaje en lore y mesa; campo descriptivo, no mecánico.",
            },
            {
                term: "Es una deidad",
                definition:
                    "Marca entidades divinas. Puede excluirlas de propagación casual de ondas IA salvo que sean ancla o se mencionen en el evento.",
            },
            {
                term: "Nacimiento / Muerte (calendario D.Z.)",
                definition:
                    "Fechas en el calendario de campaña. Si hay fecha de muerte, el personaje se considera fallecido: la IA puede excluirlo de propagación e impacts (reglas configurables).",
            },
            {
                term: "Lugar de nacimiento / muerte",
                definition: "Referencias a locaciones wiki donde nació o murió el personaje.",
            },
            {
                term: "Afiliaciones (organizaciones)",
                definition:
                    "Lista de organizaciones a las que pertenece, con estado confirmado o sospechado y rol opcional (capitán, espía, iniciado…). Se sincroniza bidireccionalmente con la lista de integrantes de la organización.",
            },
            {
                term: "Estado de membresía: Confirmado",
                definition: MEMBERSHIP_STATUS_LABELS[MEMBERSHIP_STATUS.CONFIRMADO] + ". La pertenencia es un hecho conocido en el lore o en mesa.",
            },
            {
                term: "Estado de membresía: Sospechado",
                definition:
                    MEMBERSHIP_STATUS_LABELS[MEMBERSHIP_STATUS.SOSPECHADO] + ". Vínculo no confirmado públicamente; útil para intriga y revelaciones.",
            },
        ],
    },
    {
        id: "narrative_ai_personality",
        title: "Personalidad narrativa (IA)",
        description: NARRATIVE_PERSONALITY_SECTION_HELP,
        entries: [
            {
                term: "Sección Personalidad narrativa",
                definition: NARRATIVE_PERSONALITY_SECTION_HELP,
            },
            {
                term: "Arquetipo de reacción",
                definition: REACTION_ARCHETYPE_FIELD_HELP,
            },
            ...entriesFromEnum(REACTION_ARCHETYPE_LABELS, REACTION_ARCHETYPE_TOOLTIPS),
            {
                term: "Estado narrativo actual",
                definition: NARRATIVE_STATE_FIELD_HELP,
            },
            ...entriesFromEnum(NARRATIVE_STATE_LABELS, NARRATIVE_STATE_TOOLTIPS),
            {
                term: "Patrón de estrés / trauma",
                definition: STRESS_RESPONSE_FIELD_HELP,
            },
            ...entriesFromEnum(STRESS_RESPONSE_LABELS, STRESS_RESPONSE_TOOLTIPS),
            {
                term: "Rasgos narrativos",
                definition: NARRATIVE_TRAITS_FIELD_HELP,
            },
            {
                term: "Anclas emocionales (bondNotes)",
                definition: BOND_NOTES_FIELD_HELP,
            },
        ],
    },
    {
        id: "collective_ai",
        title: "Temperamento colectivo (locación / organización)",
        description: "Cómo reaccionan grupos enteros en el modo Evento narrativo.",
        entries: [
            {
                term: "Arquetipo colectivo",
                definition:
                    "Tendencia estable de una locación u organización como actor único (no individuos). Guía collectiveImpacts en propagación por ondas.",
            },
            ...Object.entries(COLLECTIVE_ARCHETYPE_LABELS).map(([key, label]) => ({
                term: label,
                definition: COLLECTIVE_ARCHETYPE_AI_DESCRIPTIONS[key] ?? label,
            })),
            {
                term: "Estado colectivo actual (collectiveMood)",
                definition:
                    "Texto libre sobre el clima interno del grupo («tensión fiscal», «lealtad al trono intacta»). La IA lo prioriza sobre el arquetipo para reacciones colectivas puntuales.",
            },
        ],
    },
    {
        id: "locacion",
        title: "Locación",
        entries: [
            {
                term: "Tipo de locación",
                definition: `Jerarquía espacial de amplio a concreto: ${enumList(LOCATION_KIND_LABELS)}. El padre debe ser más amplio que el hijo.`,
            },
            {
                term: "Población (escala)",
                definition: `Densidad o escala: ${enumList(POPULATION_ORDER_LABELS)}. En asentamientos no se ofrecen «nación/imperio»; en países/regiones sí la escala macro completa.`,
            },
            {
                term: "Locación padre",
                definition: "Contenedor geográfico inmediato (ciudad dentro de región, región dentro de país, etc.).",
            },
            {
                term: "Clima",
                definition: "Descripción ambiental breve para lore y ambientación.",
            },
            {
                term: "Idioma / ideología / especie predominantes",
                definition:
                    "Cultura dominante del lugar. Requiere haber creado antes las fichas referenciadas (orden recomendado: idioma → ideología → locación macro → especie).",
            },
            {
                term: "Fundación / Destrucción",
                definition: "Fechas D.Z. de creación del asentamiento o de su ruina/desaparición.",
            },
            {
                term: "Es un asentamiento habitable",
                definition: "Indica si el lugar está pensado para población residente (afecta lectura de escala y contexto IA).",
            },
        ],
    },
    {
        id: "organizacion",
        title: "Organización",
        entries: [
            {
                term: "Organización",
                definition:
                    "Entidad colectiva con identidad, sede y miembros. Puede ser gremio, facción, estado, culto, célula terrorista, etc.",
            },
            {
                term: "Tipo de organización",
                definition: enumList(ORGANIZATION_KIND_LABELS),
            },
            {
                term: "Alcance (tamaño)",
                definition: `Extensión geográfica o operativa: ${enumList(ORGANIZATION_SIZE_LABELS)}.`,
            },
            {
                term: "Sede principal",
                definition: "Locación wiki donde tiene su cuartel general, templo, palacio o base operativa.",
            },
            {
                term: "Lema",
                definition: "Frase identificativa o lema público de la facción.",
            },
            {
                term: "Fundación / Disolución",
                definition: "Fechas D.Z. de creación y, si aplica, de disolución o derrota definitiva.",
            },
            {
                term: "Cara pública",
                definition: "Cómo se presenta la organización ante el mundo (fachada legal, propaganda, cover story).",
            },
            {
                term: "Simbología",
                definition: "Chips de iconografía: colores, estandartes, emblemas, gestos ritualizados.",
            },
            {
                term: "Integrantes",
                definition:
                    "Lista de miembros como ficha wiki (personaje narrativo) o personaje VTT (jugable). Cada uno tiene estado confirmado/sospechado y rol opcional.",
            },
        ],
    },
    {
        id: "especie",
        title: "Especie",
        entries: [
            {
                term: "Dieta",
                definition: enumList(DIET_LABELS),
            },
            {
                term: "Tamaño (categoría)",
                definition: enumList(SIZE_CATEGORY_LABELS),
            },
            {
                term: "Escala poblacional",
                definition: `Cuán común es la especie en el mundo: ${enumList(POPULATION_SCALE_LABELS)}.`,
            },
            {
                term: "Longevidad / Madurez",
                definition:
                    "Longevidad típica (texto), edad de madurez y longevidad máxima en años. Útil para líneas temporales y PJ longevos.",
            },
            {
                term: "Mundo / origen",
                definition: "Locación de origen evolutivo o homeworld de la especie.",
            },
            {
                term: "Idiomas nativos",
                definition: "Uno o más idiomas wiki asociados culturalmente a la especie.",
            },
            {
                term: "Rasgos narrativos",
                definition: "Chips de rasgos distintivos (visión nocturna, anfibio, telepatía limitada…).",
            },
            {
                term: "Afinidad de clase ICON",
                definition: "Clases del sistema ICON con las que la especie suele identificarse en mesa (Wright, Stalwart…).",
            },
            {
                term: "Notas de reproducción",
                definition: "Detalles biológicos o culturales sobre reproducción, si son relevantes al lore.",
            },
        ],
    },
    {
        id: "reliquia",
        title: "Reliquia",
        entries: [
            {
                term: "Tipo de reliquia",
                definition: enumList(RELIC_KIND_LABELS),
            },
            {
                term: "Nivel de poder",
                definition: enumList(RELIC_POWER_TIER_LABELS),
            },
            {
                term: "Creador / Portador actual",
                definition: "Personajes wiki responsables de forjarla y de poseerla ahora.",
            },
            {
                term: "Origen (locación)",
                definition: "Lugar donde fue creada, encontrada o consagrada.",
            },
            {
                term: "Condición de activación",
                definition: "Requisito narrativo o mecánico para usar el objeto («solo bajo luna roja», «sangre real»…).",
            },
            {
                term: "Es única",
                definition: "Si está marcada, solo existe un ejemplar en el mundo.",
            },
        ],
    },
    {
        id: "ideologia",
        title: "Ideología",
        entries: [
            {
                term: "Tipo de ideología",
                definition: enumList(IDEOLOGY_KIND_LABELS),
            },
            {
                term: "Difusión",
                definition: enumList(IDEOLOGY_SPREAD_LABELS),
            },
            {
                term: "Tono / talante",
                definition: "Matiz general: fatalista, militante, místico, mercantilista…",
            },
            {
                term: "Figura / deidad principal",
                definition: "Personaje wiki venerado, profetizado o considerado fundador espiritual.",
            },
            {
                term: "Idioma litúrgico",
                definition: "Idioma usado en rituales y textos sagrados.",
            },
            {
                term: "Tabúes",
                definition: "Chips de prohibiciones culturales o religiosas.",
            },
            {
                term: "Prácticas",
                definition: "Chips de rituales, peregrinajes, ofrendas u observancias habituales.",
            },
        ],
    },
    {
        id: "evento_cronica",
        title: "Evento histórico y crónica",
        entries: [
            {
                term: "Tipo de evento",
                definition: enumList(EVENT_KIND_LABELS),
            },
            {
                term: "Certeza del evento",
                definition: enumList(EVENT_CERTAINTY_LABELS) + ". Indica si el lore lo trata como hecho, leyenda o disputado.",
            },
            {
                term: "Fecha D.Z. y rama temporal",
                definition:
                    "Posición en TIMELINE: fecha en calendario de campaña y rama (centro, izquierda o derecha) para líneas paralelas.",
            },
            {
                term: "Categoría de crónica",
                definition: enumList(CRONICA_CATEGORY_LABELS),
            },
            {
                term: "Crónica bloqueada (isLocked)",
                definition:
                    "Si está activo, los jugadores no ven el texto hasta que el DJ lo desbloquee.",
            },
            {
                term: "Meta de desbloqueo (unlockGoal)",
                definition:
                    "Condición narrativa descrita para el DJ («cuando descubran el sello en Mirage»). No se valida automáticamente: es recordatorio de mesa.",
            },
        ],
    },
    {
        id: "glosario_entity",
        title: "Entidad Glosario (términos con tooltip)",
        entries: [
            {
                term: "Entrada de glosario",
                definition:
                    "Ficha wiki de tipo Glosario. Su título es el término principal; el cuerpo explica la definición. Aparece en el CODEX junto a otras entidades.",
            },
            {
                term: "Aliases (sinónimos)",
                definition:
                    "Variantes del término que también activan el tooltip (ej. «Rush» y «Embestida»). Pueden coincidir con tags de la ficha.",
            },
            {
                term: "Resaltado automático",
                definition:
                    "En habilidades de personaje, chat VTT y texto wiki, el sistema detecta términos del glosario y muestra la definición al pasar el cursor (GlossaryTextRenderer).",
            },
        ],
    },
    {
        id: "relaciones",
        title: "Relaciones del grafo",
        description: "Tipos de vínculo entre entidades. Solo algunos pares de tipos son válidos.",
        entries: Object.entries(WIKI_RELATION_TYPE_LABELS).map(([key, label]) => {
            const hints = {
                aliado_de: "Vínculo positivo activo entre personajes u organizaciones.",
                enemigo_de: "Hostilidad declarada o conflicto abierto.",
                miembro_confirmado_de: "Pertenencia verificada a una organización.",
                miembro_sospechado_de: "Se cree que pertenece, sin prueba pública.",
                vive_en: "Residencia habitual de un personaje.",
                sede_en: "Sede física de una organización.",
                controla: "Dominio político, militar o económico sobre un lugar u otra facción.",
                participo_en: "Actor presente en un evento histórico.",
                desencadeno: "Causó o detonó un suceso.",
                profesa: "Adhiere a una ideología.",
                habla: "Domina un idioma.",
                venera: "Culto o reverencia hacia personaje/deidad.",
                custodia: "Guarda o protege una reliquia.",
                busca: "Persigue activamente entidad u objeto.",
                documenta: "Crónica que registra otra entidad.",
                relacionado_con: "Vínculo genérico cuando no aplica un tipo específico.",
                otro: "Relación personalizada; conviene etiqueta libre descriptiva.",
            };
            return {
                term: label,
                definition: hints[key] ?? `Relación wiki: ${label}.`,
                tags: [label.toLowerCase(), key],
            };
        }),
    },
    {
        id: "ai_lab",
        title: "Laboratorio IA (NEURAL_LAB)",
        entries: [
            {
                term: "LAB IA",
                definition:
                    "Panel del DJ en NEURAL_LAB para generar ideas y cambios narrativos anclados al subgrafo de entidades seleccionadas. Requiere API configurada (Gemini u OpenRouter).",
            },
            ...Object.values(AI_MODES).map((mode) => ({
                term: AI_MODE_LABELS[mode],
                definition: AI_MODE_TOOLTIPS[mode],
                tags: ["ia", mode],
            })),
            ...SITUATION_INTENTS.map(({ label, tooltip }) => ({
                term: `Intención: ${label}`,
                definition: tooltip,
                tags: ["ia", "situación"],
            })),
            {
                term: "Ancla / entidad focal",
                definition:
                    "Nodo seleccionado en el grafo desde el que se construye el subgrafo de contexto. Las situaciones y ondas parten de sus relaciones reales.",
            },
            {
                term: "Profundidad de ondas (cascade)",
                definition:
                    "Cuántas capas BFS de personajes relacionados se incluyen al propagar un evento. Más profundidad = más NPCs afectados, más tokens y latencia.",
            },
            {
                term: "Subgrafo de contexto",
                definition:
                    "Recorte del wiki enviado al modelo: entidades, relaciones, rasgos narrativos y reglas de campaña. La IA no debe inventar fuera de este pack.",
            },
            {
                term: "Confianza (alta / media / baja)",
                definition: Object.entries(CONFIDENCE_TOOLTIPS)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" "),
            },
            {
                term: "Tonos de situación",
                definition: Object.entries(TONE_LABELS)
                    .map(([k, v]) => `${v} (${k})`)
                    .join(" · "),
            },
            {
                term: "Ideas de escena (salida)",
                definition:
                    "Cada situación incluye título, gancho (hook), stakes, tono, entidades implicadas con justificación, preguntas dramáticas y notas DM. No modifica el wiki automáticamente.",
            },
            {
                term: "Ondas narrativas (salida)",
                definition:
                    "Propone cambios concretos en relaciones (añadir, quitar, actualizar) con razón y confianza. Cada cambio requiere confirmación del DJ antes de guardar.",
            },
            {
                term: "Evento narrativo / cascade (salida)",
                definition:
                    "Propaga un evento por ondas: impacts por personaje (reacción, cambio de estado, relaciones) y collectiveImpacts para locaciones/organizaciones. Puede proponer evento en timeline.",
            },
            {
                term: "Hilo de conversación IA",
                definition:
                    "Historial de turnos usuario/asistente en una sesión del Lab. Permite iterar sobre una generación previa sin perder contexto inmediato.",
            },
            {
                term: "Estimación de tokens",
                definition:
                    "Aproximación del tamaño del contexto enviado al modelo. Útil para no saturar el límite con subgrafos muy grandes.",
            },
            ...Object.entries(AI_PROVIDER_LABELS).map(([key, label]) => ({
                term: label,
                definition: AI_PROVIDER_TOOLTIPS[key],
                tags: ["ia", "proveedor"],
            })),
        ],
    },
    {
        id: "ai_config",
        title: "Configuración de IA narrativa",
        entries: [
            {
                term: "Reglas de campaña (customPromptRules)",
                definition:
                    "Texto libre añadido a todo prompt: tono valtiense, tabúes, spoilers permitidos, convenciones de mesa.",
            },
            {
                term: "Temperatura",
                definition:
                    "Creatividad del modelo (0 = muy literal, 1+ = más variado). Por defecto ~0.8 para narrativa.",
            },
            {
                term: "Top P",
                definition: "Muestreo nucleus: diversidad de vocabulario sin disparar la aleatoriedad total.",
            },
            {
                term: "Máximo de tokens de salida",
                definition:
                    "Tope opcional de longitud de respuesta. Vacío = límite del modelo.",
            },
            ...AI_RULE_PRESETS.map((p) => ({
                term: p.label,
                definition: `[${AI_CONFIG_CATEGORY_LABELS[p.category]}] ${p.tooltip}`,
                tags: ["ia", "config", p.category],
            })),
        ],
    },
    {
        id: "session_log",
        title: "Diario de sesiones",
        entries: [
            {
                term: "Entrada de sesión",
                definition:
                    "Registro de una sesión de juego: título, fecha, lista de participantes y recap narrativo de lo ocurrido.",
            },
            {
                term: "Recap de sesión",
                definition:
                    "Resumen en prosa de la sesión. Se puede incluir en el contexto del Lab IA para ideas alineadas con lo jugado recientemente.",
            },
        ],
    },
    {
        id: "vtt_character",
        title: "Personaje VTT (hoja ICON)",
        description: "Conceptos de la ficha jugable en el mapa, distinta de la ficha wiki narrativa.",
        entries: [
            {
                term: "Personaje VTT vs ficha wiki",
                definition:
                    "El VTT guarda stats, habilidades ICON, bond y pools de sesión. La ficha wiki guarda lore, relaciones y personalidad para IA. Pueden enlazarse bidireccionalmente.",
            },
            {
                term: "STATS",
                definition: "Atributos numéricos del sistema ICON en la hoja (fuerza, destreza, etc.).",
            },
            {
                term: "BIO",
                definition:
                    "Biografía jugable y enlace al codex si la ficha wiki está vinculada.",
            },
            {
                term: "SKILLS / SKILL_MATRIX",
                definition:
                    "Habilidades de clase y job ICON. El texto de cada habilidad puede resaltar términos del glosario wiki.",
            },
            {
                term: "BOND",
                definition:
                    "Vínculo especial ICON del personaje: nombre, descripción y poderes asociados (bondPowers). Mecánica de mesa, distinta de bondNotes narrativos del wiki.",
            },
            {
                term: "Effort (esfuerzo)",
                definition:
                    "Recurso unificado de sesión (narrativo/táctico). Por defecto 3 pips; se gestiona en el HUD de combate y en la ficha.",
            },
            {
                term: "VIT / HP",
                definition:
                    "Vitalidad del personaje. HP máximo de hoja = VIT × 4. En sesión, cada VIT perdido reduce el HP máximo en ¼ (HP_sesión = VIT_actual × 4). Si el HP llega a 0, se pierde 1 VIT y el HP se rellena al nuevo máximo; con el último VIT, el personaje cae.",
            },
            {
                term: "Estados de sesión",
                definition:
                    "Marcadores temporales en la hoja (herido, enfocado, etc.) activables desde el HUD para recordar condiciones en mesa.",
            },
            {
                term: "Clase ICON",
                definition:
                    "Arquetipo táctico (Stalwart, Vagabond, Mendicant, Wright) que define la matriz de habilidades base.",
            },
            {
                term: "Job",
                definition:
                    "Especialización de clase elegida en progresión ICON. Filtra habilidades visibles en la matriz.",
            },
            {
                term: "PC / NPC (badge)",
                definition:
                    "PC = personaje jugador asignado a un usuario; NPC = controlado por el DJ en el mapa.",
            },
        ],
    },
    {
        id: "vtt_map",
        title: "Mesa virtual (mapa)",
        entries: [
            {
                term: "Token",
                definition: "Representación visual de un personaje VTT sobre el grid del mapa.",
            },
            {
                term: "Locación en mapa",
                definition:
                    "Marcador geográfico en PixiJS enlazable a ficha wiki de locación para lore contextual.",
            },
            {
                term: "Chat VTT",
                definition:
                    "Mensajes de mesa con resaltado de glosario. Permite invocar habilidades al chat con formato especial.",
            },
            {
                term: "Quick Actions",
                definition: "Barra de acciones rápidas del DJ/jugador en el mapa (dados, habilidades, utilidades).",
            },
            {
                term: "Map HUD (CHARS / LORE / ARCHIVE)",
                definition:
                    "Panel superior izquierdo del mapa: selector de mapa publicado + IconButtons a personajes globales, lore y Narrative Archive.",
            },
        ],
    },
];

/** Aplana todas las entradas con sección para búsqueda. */
export function flattenGlossaryEntries(sections = SYSTEM_GLOSSARY_SECTIONS) {
    return sections.flatMap((section) =>
        section.entries.map((entry) => ({
            ...entry,
            sectionId: section.id,
            sectionTitle: section.title,
        }))
    );
}

/**
 * Filtra entradas por texto (término, definición, tags, sección).
 * @param {string} query
 * @param {GlossarySection[]} [sections]
 */
export function searchGlossary(query, sections = SYSTEM_GLOSSARY_SECTIONS) {
    const q = query.trim().toLowerCase();
    if (!q) return sections;

    return sections
        .map((section) => {
            const entries = section.entries.filter((entry) => {
                const haystack = [
                    entry.term,
                    entry.definition,
                    section.title,
                    section.description ?? "",
                    ...(entry.tags ?? []),
                ]
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(q);
            });
            return entries.length ? { ...section, entries } : null;
        })
        .filter(Boolean);
}
