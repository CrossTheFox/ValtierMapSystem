# Plan — Propuestas de situación con IA (Valt6-01)

*Documento guía para iterar el sistema de propuestas narrativas asistidas por LLM.*  
*Última actualización: 2025-06-08*

> **Para el agente / próxima sesión:** lee este archivo **antes** de implementar cualquier cosa relacionada con IA, Gemini, prompts, `buildSituationContext`, o UI de propuestas. Sigue las fases en orden; no saltes a chat libre ni a Cloud Functions hasta completar la Fase 1.

---

## 0. Punto de partida (estado actual)

### Ya listo

| Pieza | Ubicación | Notas |
|-------|-----------|-------|
| Fichas unificadas | `campaigns/{id}/wikiEntities` | Tipos: personaje, locación, org, evento, etc. |
| Relaciones binarias | `campaigns/{id}/entityRelations` | Incluye `vive_en`, `perteneciente_a`, `enemigo_de`, etc. |
| Empaquetador de contexto | `src/utils/buildWikiContextPack.js` | Foco + vecinos + relaciones → texto para prompt |
| Sync realtime | `src/store/wikiSlice.js` → `startWikiSync` | Datos frescos para el DJ |
| Visibilidad lore | `visibility: "players" \| "dm_only"` | Filtrar antes de enviar al LLM |
| Grafo NETWORK | `src/pixi/wikiGraph/` | Visualización; no es prerrequisito de IA v1 |
| Seed Valtia | `scripts/seedValtiaWiki.mjs` | Relaciones `vive_en` / `perteneciente_a` en seed |

### Pendiente antes de IA en producción

- [ ] Ejecutar `npm run seed-valtia-wiki -- --campaignId=<id>` (o relaciones nuevas) en la campaña real
- [ ] Validar migración `encyclopedia` → `wikiEntities` en producción
- [ ] Desplegar reglas Firestore: `npx firebase-tools deploy --only firestore:rules`

### Decisión de arquitectura (tomada)

| Tema | Decisión |
|------|----------|
| Proveedor LLM | **Firebase AI Logic** + Gemini Developer API (prototipo) |
| Modelo inicial | `gemini-2.5-flash` (rápido, barato, structured output) |
| Dónde corre v1 | **Cliente**, solo UI visible para DJ |
| Formato de salida | **JSON estructurado** (no chat libre) |
| Contexto | **Subgrafo** desde ancla (locación/ficha), no wiki completo |
| Persistencia v1 | **Ninguna** — el DJ acepta o descarta en UI |

---

## 1. Visión del producto (MVP)

**Usuario:** DJ únicamente.  
**Trigger:** botón «Proponer situación» desde Narrative Archive o ficha de locación activa.  
**Input opcional:** intención (`conflicto`, `misterio`, `social`, `combate`, `revelación`).  
**Output:** 1–3 tarjetas con situación jugable, basadas **solo** en entidades y relaciones del contexto.

### Esquema JSON de respuesta (contrato)

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

### System prompt (borrador — no hardcodear en UI hasta Fase 1)

```
Eres un asistente de preparación de sesiones para ICON TTRPG, campaña Valtia-01.

REGLAS:
1. Usa SOLO entidades y relaciones del contexto proporcionado.
2. Si falta información, indícalo en dmNotes; no inventes NPCs, ciudades ni organizaciones.
3. Las relaciones son hechos: "X → [vive_en] → Y" = residencia; "enemigo_de" = tensión activa.
4. Lore marcado como secreto va solo en dmNotes.
5. Propón situaciones jugables en mesa: gancho claro, stakes, 2-3 preguntas dramáticas.
6. Tono: cyberpunk gótico valtiense (domo, seis metrópolis, sangre Zarken, política imperial).
7. Responde ÚNICAMENTE con JSON válido según el esquema acordado.
```

---

## 2. Fases de implementación

### Fase 0 — Validar prompt sin UI ✅

**Objetivo:** confirmar que el contexto + prompt producen situaciones coherentes antes de escribir integración.

| # | Tarea | Archivo / comando | Hecho |
|---|-------|-------------------|-------|
| 0.1 | Crear `buildSituationContext.js` (extensión de context pack con expansión por `relationType`) | `src/utils/buildSituationContext.js` | [x] |
| 0.2 | Crear script CLI que imprime el pack y opcionalmente llama a Gemini | `scripts/testSituationPrompt.mjs` | [x] |
| 0.3 | Probar con anclas: `galathia`, `mirage`, `engel` | `node scripts/testSituationPrompt.mjs --anchor=galathia` | [x] |
| 0.4 | Ajustar límites (`maxNodes`, `maxChars`) hasta evitar truncado crítico | ver sección 3 | [x] |
| 0.5 | Documentar 2–3 ejemplos buenos/malos en este archivo (apéndice) | § Apéndice A + `docs/memoria/casos-prueba-ia.md` | [x] |

**Criterio de salida:** 3 ejecuciones seguidas sin inventar entidades inexistentes.

---

### Fase 1 — MVP en UI (solo DJ) ✅

**Objetivo:** un botón, loading, tarjetas de resultado.

| # | Tarea | Archivo | Hecho |
|---|-------|---------|-------|
| 1.1 | Instalar / inicializar Firebase AI Logic | `firebase/aiConfig.js` | [x] |
| 1.2 | Servicio wrapper unificado (3 modos) | `firebase/services/narrativeAiService.js` | [x] |
| 1.3 | Constantes: schema, intents, system prompt | `src/constants/wiki/narrativeAiSchemas.js` | [x] |
| 1.4 | Panel UI: botón + selector de intención + tarjetas | `src/components/wiki/WikiAiLabPanel.jsx` | [x] |
| 1.5 | Integrar en overlay (DM only) | `src/components/wiki/NarrativeWikiOverlay.jsx` | [x] |
| 1.6 | Ancla automática: entidad seleccionada o locación VTT vinculada | reutilizar `linkedVttLocationId` | [x] |
| 1.7 | Habilitar App Check antes de uso intensivo | Firebase Console | [ ] |

**Criterio de salida:** DJ abre Galathia → clic → ve 1–3 situaciones en <15 s.

---

### Fase 2 — Subgrafo inteligente ✅

**Objetivo:** contexto más relevante, menos ruido.

| # | Tarea | Detalle | Hecho |
|---|-------|---------|-------|
| 2.1 | Expansión por tipo de relación desde ancla | Ver matriz § 3 | [x] |
| 2.2 | Incluir backlinks `@mención` como vecinos débiles | `expandMentionNeighbors` en `buildSituationContext.js` | [x] |
| 2.3 | Excluir entidades `dm_only` si el rol no es DM | filtro `role` en context builders | [x] |
| 2.4 | Resumen de relaciones separado del body largo | `compact` en anillo exterior | [x] |
| 2.5 | Métricas en UI: `N fichas, M relaciones, truncado sí/no` | `ctx.meta` en `WikiAiLabPanel` | [x] |

**Extra (no en plan original):** modo `cascade` (Onda catalizadora), `validateAiResponse.js`, tests unitarios.

---

### Fase 3 — Persistencia y flujo de aceptación (parcial)

**Objetivo:** propuesta aceptada → memoria en el archivo.

| # | Tarea | Detalle | Hecho |
|---|-------|---------|-------|
| 3.1 | Botón «Guardar como borrador» → `entityType: cronica` | `wikiEntityService.create` | [ ] |
| 3.2 | Crear evento desde CASCADE → `evento_historico` + `participo_en` | `applyProposedWikiEvent.js` + `WikiCascadeResult` | [x] |
| 3.3 | Regenerar con variación («otra idea», mismo ancla) | re-prompt con temperature ↑ | [ ] |
| 3.4 | Enlazar entidades mencionadas como `@mención` al guardar | `buildMentionToken` | [ ] |
| 3.5 | Validación endurecida: `missingImpacts`, tests, CLI cascade | `validateAiResponse.test.mjs`, `npm run test:caso01:context` | [x] |

---

### Fase 4 — Endurecimiento (post-MVP)

| Tema | Cuándo |
|------|--------|
| Cloud Function para llamada a Gemini | Si App Check no basta o quieres ocultar prompts |
| Remote Config para nombre de modelo | Cambiar modelo sin deploy |
| Propuestas para jugadores (lore `players` only) | Cuando el filtrado de secretos esté probado |
| Chat multi-turno | Solo si el JSON estructurado ya funciona bien |
| Embeddings / búsqueda semántica | Cuando el wiki supere ~200 fichas |

---

## 3. Estrategia de contexto (subgrafo)

### Ancla

Orden de prioridad al abrir el panel:

1. Entidad wiki actualmente seleccionada en el overlay
2. Si es locación VTT sin ficha: resolver vía `linkedVttLocationId`
3. Si nada seleccionado: pedir al DJ que elija ancla (autocomplete de locaciones)

### Expansión por `relationType` (máx. 2 saltos)

| Tipo | Prioridad | Uso narrativo |
|------|-----------|---------------|
| `vive_en` | Alta | Residentes de la ciudad |
| `sede_en` | Alta | Organizaciones presentes |
| `controla` | Alta | Poder político local |
| `enemigo_de` / `aliado_de` | Alta | Tensiones y alianzas |
| `miembro_confirmado_de` | Media | Afiliaciones de personajes |
| `perteneciente_a` | Media | Jerarquía territorial |
| `ocurrio_en` | Media | Eventos históricos en el lugar |
| `relacionado_con` | Baja | Solo si strength ≠ 0 o tiene label |
| `origen_de` | Baja | Contexto de fondo |

### Límites recomendados (v1)

```
maxDepth:      2
maxEntities:   25
maxRelations:  40
maxChars:      10_000
```

Si se trunca: reducir body de entidades a `summary` solamente (no `body` completo) para las del anillo exterior.

### Función objetivo

```js
// src/utils/buildSituationContext.js (por crear)
buildSituationContext(entities, relations, {
  anchorEntityId,   // requerido
  intent,           // opcional: "conflicto" | "misterio" | ...
  role: "dm",
  maxDepth: 2,
  maxEntities: 25,
})
// → { text, meta: { entityCount, relationCount, anchorTitle, truncated, relationTypesUsed } }
```

Reutilizar internamente `buildWikiContextPack` o extraer serializadores compartidos.

---

## 4. Mapa de archivos (objetivo final)

```
src/
├── constants/wiki/
│   ├── plan-ia-situaciones.md          ← ESTE ARCHIVO (guía)
│   ├── plan-memoria-narrativa.md       ← arquitectura general wiki
│   └── situationProposalSchema.js      ← (Fase 1) schema + intents + prompt
├── utils/
│   ├── buildWikiContextPack.js         ← ✅ existe
│   └── buildSituationContext.js        ← (Fase 0) subgrafo por relaciones
├── components/wiki/
│   ├── SituationProposalPanel.jsx      ← (Fase 1) UI DJ
│   └── NarrativeWikiOverlay.jsx        ← integración del panel
firebase/
├── aiConfig.js                         ← (Fase 1) init Firebase AI Logic
└── services/
    └── situationAiService.js           ← (Fase 1) generateContent + schema
scripts/
└── testSituationPrompt.mjs             ← (Fase 0) validación CLI
```

---

## 5. Checklist de sesión (copiar al empezar)

```markdown
## Sesión IA — YYYY-MM-DD

- [ ] Leí `plan-ia-situaciones.md` y confirmé fase actual: ___
- [ ] Datos: seed/migración al día en campaña ___
- [ ] Tarea de hoy (una sola fase): ___
- [ ] Ancla de prueba: ___
- [ ] Resultado / bloqueo: ___
- [ ] Siguiente paso: ___
```

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Alucinación de NPCs | JSON schema + regla «solo entidades del contexto» + `confidence: baja` |
| Lore secreto filtrado a jugadores | Solo DJ ve el panel; filtrar `dm_only`; no exponer a jugadores en v1 |
| Contexto demasiado largo | Subgrafo + truncar bodies del anillo exterior |
| Coste API | Flash + límite de regeneraciones + App Check |
| Relaciones con dirección invertida | Usar datos normalizados (`vive_en` siempre personaje→locación) — ya resuelto en `resolveRelationEndpoints` |

---

## Apéndice A — Ejemplos de prueba (rellenar en Fase 0)

### Ancla: Galathia

**Contexto mínimo esperado:** Zorgun, Oni, Casa Margalous, Mirage (enemigo), Capital de Galathia, Motor Zarken.

**Situación buena (ejemplo):**
> Audiencia pública: un emisario de Mirage solicita hablar con Oni en la Capital mientras Zorgun está en consejo. Los PJ deciden si mediar, espionar o sabotear — en una ciudad en guerra fría con Mirage.

**Situación mala (evitar):**
> Un mago llamado Theron (no existe en el wiki) ofrece un artefacto nuevo...

---

## Apéndice B — Comandos útiles

```bash
# Seed relaciones en campaña
npm run seed-valtia-wiki -- --campaignId=RfY23gcG7No5HcGddo1j

# (Fase 0) Probar contexto
node scripts/testSituationPrompt.mjs --anchor=galathia --dry

# (Fase 0) Probar con Gemini
node scripts/testSituationPrompt.mjs --anchor=galathia --generate

# Caso 02 — Zorgun muere (profundidad 6, local, dry)
npm run test:caso02:context

# Ejecutar todos los tests de memoria
npm run test:memoria

# Desplegar reglas
npx -y firebase-tools@latest deploy --only firestore:rules
```

---

## Historial de iteraciones

| Fecha | Fase | Qué se hizo |
|-------|------|-------------|
| 2025-06-08 | — | Plan creado. Relaciones `vive_en` / `perteneciente_a` en seed y UI de relaciones con autocomplete. |
| 2026-06-12 | 0–2 + 3 parcial | Laboratorio IA live (3 modos). Tests `validateAiResponse`. CLI `--mode=cascade`. `missingImpacts` en validador. Botón «Crear evento» desde CASCADE. Arquetipos PANGeA en seed (Zorgun/Oni/Felicia). |
| 2026-06-12 | Unificación | **Evento narrativo unificado + profundidad + memoria de personalidad.** Modo único «Evento narrativo» (eliminado «Ondas narrativas»). Campos de personalidad (`narrativeTraits`, `narrativeState`, `stressResponse`, `bondNotes`) y colectivos (`collectiveArchetype`, `collectiveMood`) en UI y seed. `entityToTextForAi` unificado. `cascadeOptsForDepth(2–8)`. Schema extendido: `personalityShift`, `entity_state_update`, `collectiveImpacts`. `applyProposedImpact.js` para persistencia en batch. Slider de profundidad con preview estático en grafo (sin partículas) + animación live al generar. Tests: 27 en verde (entity_state_update, personalityShift, collectiveImpacts). CLI `--depth=N` y `test:caso02:context`. |
