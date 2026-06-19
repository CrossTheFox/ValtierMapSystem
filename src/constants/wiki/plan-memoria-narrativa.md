# Plan de Memoria Narrativa — pixi-map / Valt6-01

*Documento vivo. Reemplaza: `architecture.md`, `funcionalidades-futuras.md`, `campos-por-tipo-entidad.md`, `dependencias-entidades.md`, `integracion-vtt-especie-organizacion.md` y los READMEs de `timeline/`, `glossary/`, `codex/`, `lore/`.*

---

## 1. Estado actual (post-fase 1+2)

### Qué funciona hoy

| Funcionalidad | Estado |
|---------------|--------|
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

### Colecciones Firestore activas

| Colección | Contenido | Notas |
|-----------|-----------|-------|
| `campaigns/{id}/wikiEntities` | Todas las fichas narrativas | Modelo unificado |
| `campaigns/{id}/entityRelations` | Relaciones entre fichas | con `relationType`, `label` |
| `encyclopedia` | Crónicas legacy | No borrar hasta validar migración en producción |
| `players` | Usuarios y rol | Usado por reglas Firestore (rol `"dm"`) |
| `maps`, `locations`, `characters`, `game` | VTT | Sin cambios |

---

## 2. Pendiente inmediato (antes de IA)

### Checklist de prerrequisitos para integración IA

- [ ] **Migrar datos reales**: ejecutar `npm run migrate-encyclopedia -- --campaignId=<id>` en producción y validar resultados.
- [ ] **Desplegar reglas Firestore**: `npx firebase-tools deploy --only firestore:rules` — las reglas nuevas aún no están en producción.
- [x] **`buildWikiContextPack.js`**: utilidad que empaqueta entidades + relaciones + menciones en texto estructurado para futuro prompt.
- [ ] **Plan IA situaciones**: ver `plan-ia-situaciones.md` (roadmap detallado Fase 0→4).
- [ ] **Prueba del grafo NETWORK** con datos reales (validar layout d3-force y fallback de imágenes).

---

## 3. Decisiones de diseño tomadas

| Decisión | Resultado |
|----------|-----------|
| Crónica legacy → `wikiEntities` como `entityType: cronica` | Modelo unificado, mismo CRUD que otras fichas |
| Visibilidad en Firestore rules (no solo cliente) | `dm_only` enforced en servidor para evitar filtración a IA |
| Grafo en Pixi (no SVG/React) | Consistencia con mapa VTT; permite escala a miles de nodos |
| Layout panel dividido (lista + grafo + detalle) | Máxima densidad de información sin modal separado |
| `onSnapshot` en lugar de fetch puntual | Datos frescos para IA cuando se pregunten sin reload manual |
| `imageUrl` como campo top-level en wikiEntity | Directo en doc raíz, sin necesidad de scoping en customFields |
| Posiciones del grafo no persistidas (v1) | La simulación recalcula al abrir; simplifica modelo de datos |

---

## 4. Mapa de archivos clave

```
src/
├── constants/
│   ├── wikiEntityTypes.js        — tipos de entidad (incl. cronica)
│   ├── wikiRelationTypes.js      — tipos de relación
│   └── wiki/
│       ├── index.js              — áreas (CHRONICLE, GLOSSARIUM, TIMELINE, CODEX, NETWORK)
│       ├── entityFieldSchemas.js — campos estructurados por tipo (incl. cronica)
│       ├── wikiEntityDependencies.js — orden de creación
│       └── wikiCreationOrder.js  — orden UI
├── store/
│   ├── wikiSlice.js              — entidades, relaciones, onSnapshot (startWikiSync)
│   └── worldSlice.js             — mapa, locaciones, personajes (sin encyclopedia ya)
├── components/wiki/
│   ├── NarrativeWikiOverlay.jsx  — overlay principal (incl. vista NETWORK)
│   ├── WikiEntityEditor.jsx      — editor con imageUrl
│   └── WikiGraphCanvas.jsx       — ← alias de src/pixi/wikiGraph/WikiGraphCanvas.jsx
├── pixi/wikiGraph/
│   ├── WikiGraphCanvas.jsx       — canvas Pixi para grafo
│   ├── wikiGraphLayout.js        — simulación d3-force
│   ├── wikiGraphTypes.js         — colores/iconos por tipo
│   └── wikiGraphNodeFactory.js   — fallback imagen (URL → VTT → símbolo)
└── utils/
    ├── wikiSlug.js               — slugify, menciones
    ├── wikiNavigation.js         — resolución de clicks en menciones
    └── wikiTimeline.js           — helpers de fechas para timeline
firebase/
├── services/
│   ├── wikiEntityService.js      — CRUD wikiEntities (incl. imageUrl)
│   └── wikiRelationService.js    — CRUD entityRelations
scripts/
└── migrateEncyclopediaToWiki.mjs — migración one-shot de encyclopedia → wikiEntities
```

---

## 5. Qué dejar para después

| Tema | Por qué esperar |
|------|-----------------|
| **Integración IA (propuestas de situación)** | Plan en `plan-ia-situaciones.md` — Fase 0: `buildSituationContext` + script de prueba |
| **Pulido visual del grafo** | v1 es funcional; animaciones, persistencia de posiciones, filtros avanzados en v2 |
| **Registro de visitas / grafo de viajes** | Explícitamente fuera del alcance actual |
| **Inventario / stats de reliquias** | Sin sistema mecánico aún |
| **Organigrama interactivo** | Alta complejidad, poco valor para IA v1 |
| **Calendarios de fantasía** | D.Z. en Valtia; gregoriano legacy en editor |
| **Vista por arcos narrativos** | Agrupación alternativa (no default): bandas «en qué arco estás» — ver §6 |
| **Borrar `encyclopedia`** | Solo después de validar la migración en producción |
| **Upload directo a Firebase Storage desde editor** | El campo `imageUrl` acepta URLs externas; upload en v2 |
| **Cloud Functions para membresía** | Best-effort actual es suficiente para v1 |

---

## 6. Línea temporal (TIMELINE) — implementado y pendiente

### Vista default (live)
- Vertical, antiguo ↑ → reciente ↓
- Chips de vínculos en tarjeta (locación `ocurrio_en`, actor `participo_en`)
- Filtros por lente: todos / ciudad / personaje / tema (`eventKind`) / **arco** (`narrativeArc`)
- **Escala narrativa**: comprime huecos largos entre fechas (~50+ años)
- Estilo por `certainty` (canon / legendario / disputado)
- Causalidad `desencadeno` como texto ↳ en tarjeta
- **Fecha presente** editable por DM en Firestore `campaigns/{id}` (`narrativeDate`, `narrativeCalendar`); fallback Valtia `7036-02-12 D.Z.` en `campaignNarrativeDefaults.js`
- **Arco narrativo** (`customFields.timeline.narrativeArc`): texto libre por evento; badge en tarjeta + filtro en toolbar; editable en `WikiEntityEditor`

### Vista futura: bandas por arco (anotado, no default)
- Modo alternativo de visualización (toggle o pestaña), no reemplaza la línea lineal.
- Agrupa visualmente eventos que comparten `narrativeArc` en bandas coloreadas.
- Objetivo jugador: ver **en qué arco está la campaña** y qué eventos del arco ya «vivieron» vs lore histórico.

---

## 7. Próximos pasos (hoja de ruta inmediata)

```
1. Ejecutar migración encyclopedia en staging → producción
2. Desplegar reglas Firestore
3. Seed relaciones (vive_en, perteneciente_a) en campaña real
4. Probar grafo NETWORK con datos reales
5. IA — seguir plan-ia-situaciones.md (Fase 0 → 1 → …)
```
