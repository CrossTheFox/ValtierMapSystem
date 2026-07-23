# WorldAnvil + IA Narrativa — Referencia completa (Valt6-01)

*Documento unificado. Reemplaza: `plan-memoria-narrativa.md`, `plan-ia-situaciones.md`, `wiki-relaciones-por-entidad.md` y sus predecesores (`architecture.md`, `funcionalidades-futuras.md`, `campos-por-tipo-entidad.md`, `integracion-vtt-especie-organizacion.md`, READMEs de `timeline/`, `glossary/`, `codex/`, `lore/`).*

---

## Parte 1 — Arquitectura del sistema wiki

### 1.1 Estado actual (post-fase 1+2)

| Funcionalidad | Estado |
|---|---|
| Autenticación Firebase (DM/jugadores) | ✅ Live |
| Mapa interactivo Pixi + pins de locación/personaje | ✅ Live |
| `wikiEntities` — modelo unificado para todas las entidades narrativas | ✅ Live |
| `entityRelations` — relaciones explícitas entre entidades | ✅ Live |
| Overlay de archivo narrativo con búsqueda, detalle y editor | ✅ Live |
| Áreas: CHRONICLE, GLOSSARIUM, TIMELINE, CODEX | ✅ Live |
| `entityType: cronica` (migrado desde `encyclopedia`) | ✅ Listo |
| Script de migración `migrateEncyclopediaToWiki.mjs` | ✅ Listo |
| Grafo de relaciones NETWORK (Pixi + pixi-viewport + d3-force) | ✅ Live |
| Imágenes en nodos del grafo (cadena: imageUrl → VTT → símbolo) | ✅ Live |
| `onSnapshot` en wikiSlice (sync realtime) | ✅ Live |
| Reglas Firestore: DM lee todo, jugadores leen solo `players`, solo DM escribe | ✅ Live |
| Campo `imageUrl` top-level en wikiEntity + editor | ✅ Live |
| Línea de tiempo con bandas de arco narrativo | ✅ Live |
| Control de arcos narrativos DM (`WikiNarrativeArcsControl`) | ✅ Live |
| Laboratorio IA (situaciones + cascada + scout) | ✅ Live |
| Logs de sesión (`sessionLogService`) + `WikiSessionLogPanel` | ✅ Live |
| VTT link badge (`WikiVttLinkBadge`, `WikiVttLinkPicker`) | ✅ Live |
| Glosario (`SystemGlossaryDialog`, `GlossaryTextRenderer`) | ✅ Live |

### 1.2 Colecciones Firestore activas

| Colección | Contenido | Notas |
|---|---|---|
| `campaigns/{id}/wikiEntities` | Todas las fichas narrativas | Modelo unificado |
| `campaigns/{id}/entityRelations` | Relaciones entre fichas | con `relationType`, `label` |
| `campaigns/{id}/sessions` | Logs de sesión | `title`, `recap`, `highlights`, `participants` |
| `encyclopedia` | Crónicas legacy | **No borrar** hasta validar migración en producción |
| `players` | Usuarios y rol | Usado por reglas Firestore (rol `"dm"`) |
| `maps`, `locations`, `characters`, `game` | VTT | Sin cambios |

### 1.3 Decisiones de diseño

| Decisión | Resultado |
|---|---|
| Crónica legacy → `wikiEntities` como `entityType: cronica` | Modelo unificado, mismo CRUD que otras fichas |
| Visibilidad en Firestore rules (no solo cliente) | `dm_only` enforced en servidor para evitar filtración a IA |
| Grafo en Pixi (no SVG/React) | Consistencia con mapa VTT; permite escala a miles de nodos |
| Layout panel dividido (lista + grafo + detalle) | Máxima densidad de información sin modal separado |
| `onSnapshot` en lugar de fetch puntual | Datos frescos para IA cuando se pregunten sin reload manual |
| `imageUrl` como campo top-level en wikiEntity | Directo en doc raíz, sin necesidad de scoping en customFields |
| Posiciones del grafo no persistidas (v1) | La simulación recalcula al abrir; simplifica modelo de datos |
| Eras → eliminadas; Arcos narrativos DM-definidos | Arcos son libres, con orden y color, sin divisiones temporales fijas |

### 1.4 Mapa de archivos clave

```
src/
├── constants/
│   ├── wikiEntityTypes.js             — tipos de entidad (incl. cronica)
│   ├── wikiRelationTypes.js           — tipos de relación (27)
│   └── wiki/
│       ├── index.js                   — áreas (CHRONICLE, GLOSSARIUM, TIMELINE, CODEX, NETWORK)
│       ├── entityFieldSchemas.js      — campos estructurados por tipo
│       ├── narrativeAiSchemas.js      — schemas JSON para IA (situation, cascade, impact)
│       ├── narrativeAiConfig.js       — constantes de modelo, proveedor, depth
│       ├── wikiEntityDependencies.js  — orden de creación
│       └── wikiCreationOrder.js       — orden UI
├── store/
│   ├── wikiSlice.js                   — entidades, relaciones, onSnapshot, arcos narrativos
│   └── worldSlice.js                  — mapa, locaciones, personajes
├── components/wiki/
│   ├── NarrativeWikiOverlay.jsx       — overlay principal (incl. vista NETWORK)
│   ├── WikiEntityEditor.jsx           — editor con imageUrl + arco narrativo
│   ├── WikiAiLabPanel.jsx             — laboratorio IA (situaciones, cascada, impactos)
│   ├── WikiTimelineView.jsx           — línea de tiempo con bandas de arco
│   ├── WikiNarrativeArcsControl.jsx   — gestión de arcos (DM)
│   ├── WikiSessionLogPanel.jsx        — logs de sesión
│   └── WikiGraphHud.jsx               — HUD del grafo
├── pixi/wikiGraph/
│   ├── WikiGraphCanvas.jsx            — canvas Pixi para grafo
│   ├── wikiGraphLayout.js             — simulación d3-force
│   └── wikiGraphNodeFactory.js        — fallback imagen (URL → VTT → símbolo)
└── utils/
    ├── buildWikiContextPack.js        — empaquetador de contexto para IA
    ├── buildSituationContext.js       — subgrafo desde ancla por relationType
    ├── applyProposedImpact.js         — aplicar impactos cascade a Firestore en batch
    ├── applyProposedWikiEvent.js      — crear evento histórico desde cascade
    ├── validateAiResponse.js          — validación de respuesta JSON del LLM
    ├── wikiTimeline.js                — helpers de fechas y bandas de arco
    └── wikiTimelineLinks.js           — opciones de filtro para timeline
firebase/
├── aiConfig.js                        — init Firebase AI Logic
└── services/
    ├── narrativeAiService.js          — wrapper unificado (Gemini/OpenRouter, 4 modos)
    ├── aiThreadService.js             — hilos de conversación AI
    ├── wikiEntityService.js           — CRUD wikiEntities
    ├── wikiRelationService.js         — CRUD entityRelations
    ├── sessionLogService.js           — CRUD logs de sesión
    └── campaignNarrativeService.js    — settings narrativos (fecha, arcos)
scripts/
└── migrateEncyclopediaToWiki.mjs      — migración one-shot de encyclopedia → wikiEntities
```

---

## Parte 2 — Sistema de relaciones

### 2.1 Principios de diseño

| Regla | Decisión |
|---|---|
| **Locaciones** | Solo **pasivas** — no inician alianzas, enemistades, búsquedas ni membresías. La autoridad que busca es una **organización** o **personaje**; el territorio solo recibe vínculos espaciales. |
| **Búsqueda** | `busca` = buscador (`personaje` \| `organizacion`) → objetivo (`personaje` \| `reliquia`). Inversa en UI: «Buscado por». |
| **Búsqueda territorial** | `es_buscado_en` = `personaje` → `locacion` («tiene orden de captura / se le busca en esta ciudad»). |
| **Ideología / Especie** | Pueden tener `aliado_de` / `enemigo_de` entre ellas (schismas, especies rivales). |
| **Idioma** | Sin relaciones sociales — solo `origen_de`, `relacionado_con`, `otro`. `habla` solo sale de **personaje**. |
| **Crónica** | Solo relación saliente: `documenta` → cualquier otra entidad. |
| **Evento** | Puede enlazar libremente a personajes, organizaciones, lugares y otros eventos. |

### 2.2 Tipos de relación (27)

**Sociales y de poder**

| Clave | Etiqueta saliente | Etiqueta entrante | Afinidad |
|---|---|---|---|
| `aliado_de` | Aliado de | — | +7 |
| `enemigo_de` | Enemigo de | — | −8 |
| `controla` | Controla | Controlado por | +6 |

**Membresía** (solo personaje → organización)

| Clave | Etiqueta |
|---|---|
| `miembro_confirmado_de` | Miembro confirmado de |
| `miembro_sospechado_de` | Se sospecha que es miembro de |
| `miembro_de` | Miembro de (genérico) |

**Espaciales y territoriales**

| Clave | Saliente | Entrante | Dirección canónica |
|---|---|---|---|
| `vive_en` | Vive en | Residente | `personaje` → `locacion` |
| `perteneciente_a` | Perteneciente a | Sub-ubicación de | locación hija → padre |
| `colinda_con` | Colinda con | Colinda con | `locacion` ↔ `locacion` |
| `sede_en` | Sede en | Sede de | `organizacion` → `locacion` |
| `habita_en` | Habita en | Habitada por | `especie` → `locacion` |
| `es_buscado_en` | Es buscado en | Buscan aquí a | `personaje` → `locacion` |

**Temporales y causales**

| Clave | Saliente | Entrante | Dirección canónica |
|---|---|---|---|
| `ocurrio_en` | Ocurrió en | Escenario de | `evento` → `locacion` |
| `participo_en` | Participó en | Participante en | `personaje` \| `organizacion` → `evento` |
| `desencadeno` | Desencadenó | Desencadenado por | actor → `evento` |

**Linaje y creación**

| Clave | Origen → Destino |
|---|---|
| `sucesor_de` | `personaje`→`personaje`, `organizacion`→`organizacion` |
| `descendiente_de` | `personaje`→`personaje`, `especie`→`especie` |
| `fundo` | `personaje` \| `organizacion` → `organizacion` \| `locacion` |
| `origen_de` | `reliquia` \| `especie` \| `evento` → `locacion` / otras |

**Cultura, objetos y fuentes**

| Clave | Origen → Destino |
|---|---|
| `profesa` | `personaje` \| `organizacion` → `ideologia` |
| `habla` | `personaje` → `idioma` |
| `venera` | `personaje` \| `organizacion` → `personaje` |
| `custodia` | `organizacion` \| `locacion` → `reliquia` |
| `busca` | `personaje` \| `organizacion` → `personaje` \| `reliquia` |
| `documenta` | `cronica` → * |
| `relacionado_con` | Vínculo narrativo sin tipo específico |
| `otro` | Cualquier par permitido + `label` libre |

### 2.3 Matriz por entidad origen

**Personaje →**

| Destino | Tipos permitidos |
|---|---|
| Personaje | aliado, enemigo, sucesor, descendiente, busca, venera, desencadenó, relacionado, otro |
| Locación | vive, es buscado en, controla, fundó, relacionado, otro |
| Organización | miembro (3 variantes), relacionado, otro |
| Evento | participó, desencadenó, relacionado, otro |
| Reliquia | busca, relacionado, otro |
| Ideología | profesa, enemigo, relacionado, otro |
| Idioma | habla, relacionado, otro |
| Especie | relacionado, otro |
| Crónica | otro |

**Organización →**

| Destino | Tipos permitidos |
|---|---|
| Personaje | busca, relacionado, otro |
| Locación | sede, controla, fundó, relacionado, otro |
| Organización | aliado, enemigo, controla, sucesor, fundó, relacionado, otro |
| Evento | participó, desencadenó, relacionado, otro |
| Reliquia | busca, custodia, relacionado, otro |
| Ideología | profesa, aliado, enemigo, relacionado, otro |
| Idioma / Especie | relacionado, otro |
| Crónica | *(ninguno)* |

**Locación → *(solo pasiva)***

| Destino | Tipos permitidos |
|---|---|
| Locación | perteneciente, colinda, otro |
| Personaje | vive *(normaliza a personaje→locación)* |
| Organización | sede *(normaliza a org→locación)* |
| Reliquia | custodia, relacionado, otro |
| Ideología / Idioma / Especie | relacionado, otro |
| Evento / Crónica | *(ninguno — usar `ocurrió_en` desde el evento)* |

**Evento histórico →**

| Destino | Tipos permitidos |
|---|---|
| Locación | ocurrió, relacionado, otro |
| Personaje / Organización | participó *(normaliza a actor→evento)*, relacionado, otro |
| Evento | desencadenó, relacionado, otro |
| Reliquia / Ideología | origen, relacionado, otro |
| Especie / Idioma / Crónica | relacionado, otro |

**Reliquia →**

| Destino | Tipos permitidos |
|---|---|
| Locación | origen, relacionado, otro |
| Personaje / Organización / Evento | relacionado, otro |
| Reliquia / Ideología / Idioma | relacionado, otro |
| Especie | origen, relacionado, otro |
| Crónica | otro |

**Ideología →**

| Destino | Tipos permitidos |
|---|---|
| Ideología | aliado, enemigo, relacionado, otro |
| Personaje / Organización / Locación / Evento / Reliquia / Especie / Idioma | relacionado, otro |
| Crónica | *(ninguno)* |

**Especie →**

| Destino | Tipos permitidos |
|---|---|
| Especie | aliado, enemigo, descendiente, relacionado, otro |
| Locación | habita, origen, relacionado, otro |
| Idioma / Ideología / Personaje / Organización / Evento / Reliquia | relacionado, otro |
| Crónica | *(ninguno)* |

**Idioma →**

| Destino | Tipos permitidos |
|---|---|
| Idioma | origen, relacionado, otro |
| Ideología / Especie / Locación / Organización / Evento / Reliquia | relacionado, otro |
| Personaje / Crónica | *(ninguno)* |

**Crónica →**

| Destino | Tipos permitidos |
|---|---|
| Cualquier otra entidad | **documenta** |
| Crónica | *(ninguno)* |

### 2.4 Ejemplos narrativos

| Situación | Relación correcta |
|---|---|
| La guardia de Valdheim busca al PJ Kael | `organizacion` (Guardia) → `busca` → `personaje` (Kael) |
| Kael tiene cartel en Valdheim y también en el puerto | `personaje` → `es_buscado_en` → cada `locacion` |
| La catedral guarda la reliquia | `locacion` → `custodia` → `reliquia` |
| Schisma entre dos cultos | `ideologia` ↔ `enemigo_de` ↔ `ideologia` |
| Elfos y orcos en guerra fría | `especie` ↔ `enemigo_de` ↔ `especie` |
| Crónica del Diluvio menciona la ciudad | `cronica` → `documenta` → `locacion` / `evento` |
| ~~Valdheim es enemiga de Kael~~ | ❌ Usar org que gobierna Valdheim → `busca` o `enemigo_de` → Kael |

### 2.5 API del código

```js
getAllowedRelationTypes(fromType, toType)      // tipos del par directo
getRelationTypeOptionsForContext(from, to)     // + pares bidireccionales UI
suggestRelationTypeForPair(from, to)           // default al elegir destino
resolveRelationEndpoints(from, to, type)       // dirección canónica en Firestore
getRelationDisplayLabel(type, isOutgoing)      // etiquetas entrante/saliente
isRelationValid(type, fromType, toType)        // validación
```

Conteo: 27 tipos, ~56 de 72 pares direccionales tienen al menos un tipo; ~15 pares sin relación posible (ej. `cronica`↔`cronica`, `idioma`→`personaje`).

---

## Parte 3 — Sistema de IA narrativa

### 3.1 Decisiones de arquitectura

| Tema | Decisión |
|---|---|
| Proveedor LLM | Firebase AI Logic + Gemini Developer API (prototipo); fallback REST directo; OpenRouter como alternativa |
| Modelo inicial | `gemini-2.5-flash` → fallback `gemini-2.5-flash-lite` (automático, 3 reintentos con backoff) |
| Dónde corre v1 | **Cliente**, solo UI visible para DM |
| Formato de salida | **JSON estructurado** (no chat libre) |
| Contexto | **Subgrafo** desde ancla (locación/ficha), no wiki completo |
| Persistencia v1 | MVP — situación → crónica borrador; cascade → evento + impactos con revisión de texto; `@menciones` al guardar |

### 3.2 Modos disponibles

| Modo | Descripción | Token limit |
|---|---|---|
| `situation` | 1–3 situaciones jugables desde ancla | 8192 |
| `narrative_impact` | Impactos en entidades existentes desde un evento | 8192 |
| `cascade` | Onda catalizadora: cómo un evento se propaga por la red | 6144 |
| `cascade_scout` | Scout previo para decidir si lanzar cascade completo | 2048 |

### 3.3 Schema JSON de respuesta (situaciones)

```json
{
  "situations": [
    {
      "title": "string",
      "hook": "string — qué ven los PJ al entrar en escena",
      "stakes": "string — consecuencias si ignoran o fallan",
      "tone": "tension | humor | misterio | combate | intriga",
      "involvedEntities": [
        {
          "title": "string — debe existir en el contexto",
          "role": "string — protagonista, antagonista, testigo, etc.",
          "why": "string — qué relación del grafo lo justifica"
        }
      ],
      "dramaticQuestions": ["string — 2-3 preguntas abiertas para la mesa"],
      "dmNotes": "string — secretos, no revelar a jugadores",
      "confidence": "alta | media | baja"
    }
  ]
}
```

### 3.4 Estrategia de contexto

**Ancla** (orden de prioridad):
1. Entidad wiki actualmente seleccionada en el overlay
2. Si es locación VTT sin ficha: resolver vía `linkedVttLocationId`
3. Si nada seleccionado: autocomplete de locaciones para el DM

**Expansión por `relationType`** (máx. 2 saltos):

| Tipo | Prioridad | Uso narrativo |
|---|---|---|
| `vive_en` | Alta | Residentes de la ciudad |
| `sede_en` | Alta | Organizaciones presentes |
| `controla` | Alta | Poder político local |
| `enemigo_de` / `aliado_de` | Alta | Tensiones y alianzas |
| `miembro_confirmado_de` | Media | Afiliaciones de personajes |
| `perteneciente_a` | Media | Jerarquía territorial |
| `ocurrio_en` | Media | Eventos históricos en el lugar |
| `relacionado_con` | Baja | Solo si strength ≠ 0 o tiene label |
| `origen_de` | Baja | Contexto de fondo |

**Límites recomendados (v1):**
```
maxDepth:      2
maxEntities:   25
maxRelations:  40
maxChars:      10_000
```

### 3.5 Estado de fases

| Fase | Descripción | Estado |
|---|---|---|
| 0 | Validar prompt sin UI: `buildSituationContext`, scripts CLI | ✅ Completo |
| 1 | MVP en UI DM: botón + tarjetas de resultado | ✅ Completo |
| 2 | Subgrafo inteligente: expansión por tipo, backlinks, métricas | ✅ Completo |
| 3 | Persistencia y flujo de aceptación | ✅ Completo (MVP) |
| 4 | Endurecimiento (Cloud Functions, Remote Config, jugadores) | 🔜 Post-MVP |

**Fase 3 — detalle:**

| # | Tarea | Estado |
|---|---|---|
| 3.1 | Botón «Guardar como borrador» → `entityType: cronica` | ✅ Listo (`WikiAiLabPanel` → `saveWikiEntity`) |
| 3.2 | Crear evento desde CASCADE → `evento_historico` + `participo_en` | ✅ Listo |
| 3.3 | Regenerar con variación («otra idea», mismo ancla) | ✅ Listo (temp ↑ + hint de variación) |
| 3.4 | Enlazar entidades mencionadas como `@mención` al guardar | ✅ Listo (`linkMentionsInText`) |
| 3.5 | Validación endurecida: `missingImpacts`, tests, CLI cascade | ✅ Listo |
| — | Edit-before-save de cuerpo + peso de relaciones (−10…+10) | ✅ Listo (`WikiCascadeResult` diálogo Revisar y aplicar) |

### 3.6 Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Alucinación de NPCs | JSON schema + regla «solo entidades del contexto» + `confidence: baja` |
| Lore secreto filtrado a jugadores | Solo DM ve el panel; filtrar `dm_only`; no exponer en v1 |
| Contexto demasiado largo | Subgrafo + truncar bodies del anillo exterior |
| Coste API | Flash + límite de regeneraciones + App Check |
| Relaciones con dirección invertida | Usar datos normalizados (`vive_en` siempre personaje→locación) — resuelto en `resolveRelationEndpoints` |

### 3.7 Historial de iteraciones

| Fecha | Fase | Qué se hizo |
|---|---|---|
| 2025-06-08 | — | Plan creado. Relaciones `vive_en` / `perteneciente_a` en seed y UI. |
| 2026-06-12 | 0–2 + 3 parcial | Laboratorio IA live (3 modos). Tests `validateAiResponse`. CLI `--mode=cascade`. `missingImpacts` en validador. Botón «Crear evento» desde CASCADE. Arquetipos PANGeA en seed. |
| 2026-06-12 | Unificación | **Evento narrativo unificado + profundidad + memoria de personalidad.** Modo único «Evento narrativo». Campos de personalidad en UI y seed. `cascadeOptsForDepth(2–8)`. Schema extendido: `personalityShift`, `entity_state_update`, `collectiveImpacts`. `applyProposedImpact.js`. Tests: 27 en verde. CLI `--depth=N`. |
| 2026-07-21 | 3 MVP | **Aceptación punta a punta:** Guardar borrador → crónica `dm_only`; «Otra idea» (variación); `linkMentionsInText` en evento/impactos/borrador; diálogo editar body de impacto antes de aplicar. Tests `linkWikiMentions`. |

---

## Parte 4 — Línea de tiempo (TIMELINE)

### 4.1 Estado actual

- Vertical, antiguo ↑ → reciente ↓
- Chips de vínculos en tarjeta (locación `ocurrio_en`, actor `participo_en`)
- Filtros por lente: todos / ciudad / personaje / tema (`eventKind`) / **arco** (`narrativeArc`)
- **Escala narrativa**: comprime huecos largos entre fechas (~50+ años)
- Estilo por `certainty` (canon / legendario / disputado)
- Causalidad `desencadeno` como texto ↳ en tarjeta
- **Fecha presente** editable por DM en `campaigns/{id}` (`narrativeDate`, `narrativeCalendar`); fallback Valtia `7036-02-12 D.Z.`
- **Bandas de arco narrativo**: agrupación visual coloreada por arco DM-definido, con badge en tarjeta
- Arco narrativo editable en `WikiEntityEditor` (dropdown vinculado al catálogo de arcos)

### 4.2 Gestión de arcos narrativos

- Arcos son DM-definidos: `{ id, label, order, color }[]`, persistidos en `campaigns/{id}.narrativeArcs`
- `WikiNarrativeArcsControl`: crear, renombrar, reordenar, marcar activo, eliminar arcos
- `activeNarrativeArcId` permite al DM marcar el arco «en curso»
- No hay «eras» — los arcos son la única agrupación temporal narrativa

---

## Parte 5 — Análisis pre-testing: qué falta y qué pulir

### 5.1 Pendientes críticos (bloquean testing serio)

| Item | Problema | Acción |
|---|---|---|
| **Migración `encyclopedia` → `wikiEntities`** | La colección legacy sigue en producción; datos reales no están en el modelo unificado | Ejecutar `npm run migrate-encyclopedia -- --campaignId=<id>` en prod y validar |
| **Reglas Firestore** | Las reglas nuevas no están desplegadas en producción | `npx -y firebase-tools@latest deploy --only firestore:rules` |
| **Seed de relaciones en campaña real** | El grafo y la IA no tienen suficiente contexto sin relaciones reales | `npm run seed-valtia-wiki -- --campaignId=<id>` + crear relaciones manuales en la campaña |
| **App Check** | Sin App Check, la clave API de Gemini queda expuesta en cliente | Habilitar en Firebase Console antes de uso intensivo |

### 5.2 Flujo de IA — gaps post-MVP (código ya no bloquea testing)

| Item | Problema |
|---|---|
| **Hilo de conversación** | `aiThreadService.js` existe pero no hay UI para listar/retomar hilos (persistencia sí) |
| **Cascade scout** | `CASCADE_SCOUT_THRESHOLD` hardcoded; sin slider DM |
| **Fallback de modelo silencioso** | Caída flash → flash-lite sin toast |

### 5.2b Checklist pre-testing (ops, no código)

Hacer **antes** de sesiones intensivas de Lab IA:

1. [ ] Desplegar Firestore rules: `npx -y firebase-tools@latest deploy --only firestore:rules`
2. [ ] Migrar encyclopedia en campaña de prueba: `npm run migrate-encyclopedia -- --campaignId=<id>`
3. [ ] Seed / relaciones reales: `npm run seed-valtia-wiki -- --campaignId=<id>` (+ vínculos manuales si hace falta)
4. [ ] App Check en Firebase Console (antes de uso intensivo con clave en cliente)
5. [ ] Smoke UI:
   - [ ] Situación → Generar → Otra idea → Guardar borrador (aparece crónica `dm_only`)
   - [ ] Cascade → Crear evento (summary/body con `@menciones`) → Revisar y aplicar impacto (editar body)

### 5.3 Wiki y editor — gaps a probar

| Item | Problema |
|---|---|
| **Timeline sin arco asignado** | No hay banda «sin arco» (fallback visual); los eventos sin `narrativeArcId` simplemente no aparecen en ninguna banda |
| **Grafo NETWORK con datos reales** | Sin prueba de carga; necesita medición con 50+ nodos y relaciones en red real |
| **VTT link integration** | `wikiVttLinkService.js` + `WikiVttLinkPicker` existen pero el flujo DM para vincular una ficha wiki a un pin del mapa no está verificado de extremo a extremo |
| **Glosario en body de ficha** | `GlossaryTextRenderer` está integrado en el chat VTT pero **no** en el body/descripción de las fichas wiki |
| **Validación de imagen** | `WikiImageUpload` no tiene guard de tamaño máximo ni filtro de formato; un archivo grande romperá la subida sin mensaje claro |
| **`WikiMentionInput` con muchas entidades** | No hay prueba de stress con >100 entidades en el autocomplete; potencial lag en el render |
| **Logs de sesión — enlace a timeline** | `sessionLogService` crea logs independientes; no hay vínculo bidireccional entre un log y los eventos históricos que generó en esa sesión |

### 5.4 Qué dejar para después

| Tema | Por qué esperar |
|---|---|
| Cloud Functions para llamada a Gemini | Si App Check no basta o hay que ocultar prompts |
| Remote Config para nombre de modelo | Cambiar modelo sin deploy |
| Propuestas para jugadores | Cuando el filtrado de secretos esté probado |
| Chat multi-turno | Solo si JSON estructurado ya funciona bien |
| Embeddings / búsqueda semántica | Cuando el wiki supere ~200 fichas |
| Pulido visual del grafo | v1 funcional; animaciones + persistencia de posiciones en v2 |
| Registro de viajes / grafo temporal | Fuera de alcance actual |
| Inventario / stats de reliquias | Sin sistema mecánico aún |
| Organigrama interactivo | Alta complejidad, poco valor para IA v1 |
| Borrar colección `encyclopedia` | Solo después de validar migración |
| Calendarios de fantasía | D.Z. en Valtia; gregoriano legacy en editor |

---

## Comandos útiles

```bash
# Migrar encyclopedia a wikiEntities
npm run migrate-encyclopedia -- --campaignId=<id>

# Seed de relaciones en campaña
npm run seed-valtia-wiki -- --campaignId=<id>

# Desplegar reglas Firestore
npx -y firebase-tools@latest deploy --only firestore:rules

# Tests de respuesta IA
npm run test:memoria

# Probar contexto de situación (dry run)
node scripts/testSituationPrompt.mjs --anchor=galathia --dry

# Probar cascade con profundidad
npm run test:caso02:context
```
