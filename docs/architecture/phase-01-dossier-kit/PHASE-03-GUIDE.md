# Phase 03 — Guía operativa (React port)

**Fase:** `phase-03-react-port` · **Un slice = una conversación nueva.**

Contrato visual: [`../../mockups/kit-job-header/DOSSIER-REACT-MAP.md`](../../mockups/kit-job-header/DOSSIER-REACT-MAP.md) §9.  
Cableado validado: [`ARCHITECTURE.md`](./ARCHITECTURE.md).  
Decisiones: [`DECISION-LOG.md`](./DECISION-LOG.md) (G1–G12).

---

## Punto de verdad (24 ago 2026)

- **`main`** incluye el trabajo de dossier/VTT/wiki hasta el merge de `fix/pixi-layer-teardown` (mockups kit en git bajo `docs/mockups/`, **no** solo HTML aislado: también React, Firebase, `firestore.rules`).
- Rama de trabajo Fase 03: **`phase-03/slice-02-seam-p3`**. Slice 1 (vitals) mergeado en esta línea; slice 2 en curso.
- Plan vivo (fuera de git por `.gitignore` de `docs/`): [`../../planes-semanales/2026-08-24-estado-y-plan.md`](../../planes-semanales/2026-08-24-estado-y-plan.md).
- **`docs/architecture/`** está en `.gitignore` — estos archivos existen en local; usa `git add -f docs/architecture/...` si quieres versionarlos.

---

## Reglas de oro

1. **Un slice por chat.** No mezclar Fase 02 (solo docs) ni slices distintos en el mismo hilo.
2. **Target gana sobre live** — si el código contradice `DECISION-LOG` / `DOSSIER-REACT-MAP` §10, arreglar código, no el contrato.
3. **No re-arquitectar Firestore** (colecciones `game` / chat) — G4, G12, deferred Fase 04.
4. **Backfill:** script con `--dry-run` por defecto; **nunca** `--apply` sin tu confirmación explícita.
5. **Dark UI** + `CYBER_SCROLL_STYLE` en paneles con scroll.
6. Si el agente propone decisión nueva → debe preguntarte con opciones + recomendación (como G11).

---

## Orden de slices (no saltar)

| # | Slice | Qué cierra | Chat nuevo |
|---|--------|------------|------------|
| **1** | Vitals model | `normalizeCharacter`, `saveDraft`, HUD lee `character`, script backfill dry-run | **Empezar aquí** |
| **2** | Seam P3 | Chips HP/VIG, scrub, denom; COND puede quedar local | Sí |
| **3** | Plate restyle | Insignia Dock, Mech+Maletín; sin celda VIG plate | Sí |
| **4** | Header EDIT | cyber-sel, A+ blank-safe, `unlockCostAP` en catálogo (G11) | Sí |
| **5** | Body B2 | Fórmulas, `mergeUnlockedUpgrades`, rails T1/T2/M | Sí |
| **6** | C2 + Play | `launchToChat`, un post ABILITY, d20 local | Sí |
| **7** | COND + TURN | `character.conditions`, mirror token, retirar `sessionPools` / `SheetHpHud` | Sí |

---

## Modelo y modo (Cursor)

| Situación | Modelo | Modo |
|-----------|--------|------|
| Slice 1 vitals, normalize, HUD read path | **Composer 2.5 Fast** | **Agent** |
| Slice 6 Play/C2 enredado | **Sonnet Thinking** | Agent |
| UI visual P3 / plate | Composer Fast + mockup `index.html` | Agent |
| ¿Plan mode? | **No** al inicio — el contrato ya está. Solo si hay bloqueo arquitectónico. |

Skills útiles: `pixi-map-ttrpg` (código), `icon-ttrpg-index` (reglas ICON si hace falta).

---

## Protocolo con el agente

| Tú escribes | El agente debe |
|-------------|----------------|
| `OK plan` | Implementar según plan acordado |
| `OK slice` | `npm run test:phase-03` + checklist manual + sugerir commit (no commit sin pedir) |
| `Corregir: …` | Solo eso; no abrir slice siguiente |
| `No ejecutar backfill` | Solo `--dry-run` |
| Bloqueo de diseño | 2–3 opciones + recomendación; esperar tu OK |

**Flujo típico en cada chat:**

1. Pegar prompt del slice (abajo).
2. Agent lee anclas → plan corto (5–8 bullets).
3. Tú: `OK plan` o correcciones.
4. Implementación + tests donde aporten.
5. Checklist manual.
6. Commit en rama `phase-03/slice-0N-…` (o misma rama con commits por slice).
7. **Nueva conversación** para el siguiente slice.

---

## Anclas comunes (todos los slices)

```
@docs/architecture/phase-01-dossier-kit/DECISION-LOG.md
@docs/architecture/phase-01-dossier-kit/ARCHITECTURE.md
@docs/mockups/kit-job-header/DOSSIER-REACT-MAP.md
@docs/mockups/kit-job-header/CANON.md
```

Slice-específicas: ver cada prompt.

---

## Prompt — Slice 1: Vitals model

**Conversación nueva · Agent · Composer 2.5 Fast**

```text
# pixi-map — Fase 03 slice 1: Vitals model

## Rol
Implementador. Portar vitals acordados a código live.
NO seam P3 UI, NO C2, NO kit EDIT rail, NO re-arquitectar colecciones Firestore.

## Rama
phase-03/slice-01-vitals

## Anclas
@docs/architecture/phase-01-dossier-kit/DECISION-LOG.md
@docs/architecture/phase-01-dossier-kit/ARCHITECTURE.md
@docs/architecture/phase-01-dossier-kit/VITALS-AND-POOLS.md
@docs/mockups/kit-job-header/DOSSIER-REACT-MAP.md
@src/utils/normalizeCharacter.js
@firebase/models/characterModel.js
@firebase/services/characterService.js
@src/components/CharactersSettingsDialog.jsx
@src/hooks/useCharacterSessionPools.js
@src/components/vtt/CharacterCombatHud.jsx

## Target (locked)
characters/{id}: hpCur, vigor, effort, turn, conditions [PERSISTIDO]
hpMax [DERIVADO] = vit_effective * 4
effort: HUD escribe character.effort (G5)
Retirar sessionPools como fuente HP/Effort/VIT en este slice (lectura desde character)
Plate stats: job combatStats + combatOverrides (no duplicar bloque en character)

## Entregables
- normalizeCharacter + characterModel + saveDraft incluyen campos target
- CharacterCombatHud lee hpCur/vigor/effort desde character
- useCharacterSessionPools: no usar para hp/vit/effort (deprecated o sin writes)
- scripts/migrate-character-vitals.mjs con --dry-run default
- Tests normalizeCharacter si aplica

## Excluir
Seam P3 UI, conditions mirror (G12 slice 7), launchToChat, G11 unlock, refactor game/chat

## Decisiones
Si falta en DECISION-LOG: DETENER y preguntar con opciones.

## Trabajo
1. Plan corto → esperar OK humano
2. Implementar
3. Checklist manual
4. NO commit unless asked

Primera acción: delta live vs target en ≤10 líneas + plan de archivos.
```

---

## Protocolo de tests (obligatorio tras cada slice)

**Regla:** los tests de Fase 03 son **100 % locales** — `node --test` sobre fixtures en memoria.  
**Prohibido** en la suite de slice: escribir en Firestore, crear personajes de prueba en Firebase, ni depender de cuota de red.

### Comando canónico

```powershell
npm run test:phase-03
```

Incluye vitals + seam (`normalizeCharacter.test.mjs`, `seamVitals.test.mjs`).  
Slices que toquen combate/rolls: `npm run test:combat-rolls`.

### Qué debe cubrir cada slice (añadir tests al cerrar)

| Slice | Tests mínimos (sin Firebase) |
|-------|------------------------------|
| **1** Vitals | `normalizeCharacterVitals`, migration patch, effort/turn defaults |
| **2** Seam P3 | `commitSeamHpChange` (cascada VIT = HUD), `commitSeamVigChange`, `computeBarPercents`, `buildOptimisticVitalsReduxPatch` |
| **3** Plate | `resolveCombatStats` plate keys; sin celda VIG en overrides |
| **4** Header EDIT | blank-safe A+ field merge (util pura cuando exista) |
| **5** Body B2 | `mergeUnlockedUpgrades`, formula VIEW substitute |
| **6** Play/C2 | `launchToChat` payload builder, un solo post |
| **7** COND | `normalizeConditions`, mirror patch builder (token ↔ character) |

### Dónde viven los tests

- Utilidades puras → `src/utils/*.test.mjs` junto al módulo.
- **No** persistir resultados de test en Firebase.
- Manual en campaña real = checklist humano **opcional** y separado; no sustituye `npm run test:phase-03`.

### Checklist agente (fin de slice)

1. `npm run test:phase-03` (o subset del slice) → **0 failures**
2. Si se añadieron tests nuevos, documentar el comando en el mensaje de cierre
3. Checklist manual solo si el slice tiene UI no cubierta por tests
4. **NO** ejecutar backfill `--apply` ni seeds de prueba en prod

### Comportamiento unificado (Slice 2b — locked)

- **HP seam** usa `commitSeamHpChange` → misma cascada VIT que HUD F4 (`applyHpWithVitCascadeOnCharacter`).
- **Dossier `patchDraft`** hace Redux optimista en vitals (`buildOptimisticVitalsReduxPatch`) para que F4 y dossier lean el mismo doc sin esperar autosave.
- **Vigor** sin techo; **SHA/shattered** bloquea solo *ganar* vigor (bajar sigue permitido).

---

## Prompt — Slice 2: Seam P3

```text
# Fase 03 slice 2: Seam P3 (HP/VIG scrub + chips)

Prerequisito: slice 1 merged o en rama (vitals en character).

Anclas: @CANON.md @index.html (#dossier seam) @ARCHITECTURE.md (D-Dossier)
@DossierKitView.jsx @CharactersSettingsDialog.jsx @VITALS-AND-POOLS.md

Implementar seam P3: chips 4.8em, scrub hatch→hpCur, tip→vigor sin techo,
denom max(hpMax, hpCur+vigor). Siempre live. patchDraft→updateCharacterFields.
NO COND drawer persistido (slice 7). NO plate/header/chat.

Plan → OK → implement → checklist. NO commit unless asked.
```

---

## Prompt — Slice 3: Plate restyle

```text
# Fase 03 slice 3: Plate Insignia Dock

Anclas: @CANON.md @index.html @DOSSIER-REACT-MAP.md @DossierKitView.jsx
@resolveCombatStats.js @combatStats.js

Plate 12-col: ID LV Job AP | stats 6 | Mech+Maletín. Stats 48px (I2).
Sin celda VIG plate. combatOverrides sparse writes.
NO triptych/header/chat.

Plan → OK → implement → checklist.
```

---

## Prompt — Slice 4: Header EDIT + A+

```text
# Fase 03 slice 4: Header EDIT + A+ persist + G11 fields

Anclas: @ability-model.md @ABILITY-FIRESTORE-SCHEMA.md @DECISION-LOG.md (G11,G7,I5)
@DossierKitView.jsx @abilityKinds.js

Rail kitEdit. cyber-sel (no cycle). upsertAbilityDoc A+ blank-safe.
Catálogo: unlockCostAP en nodos. Personaje: unlockedKitNodes[] + ap (normalize).
NO body B2 completo, NO Play.

Plan → OK → implement → checklist.
```

---

## Prompt — Slice 5: Body B2 + merge

```text
# Fase 03 slice 5: Body B2 + formula util + mergeUnlockedUpgrades

Anclas: @ability-model.md @CHAT-PLAY-FLOW.md @DECISION-LOG.md (G11)
@DossierKitView.jsx

B2 tickets, effects, T1/T2/M rails. mergeUnlockedUpgrades antes de resolve (unlockedKitNodes).
Util compartida VIEW (sustituir) vs Play (roll) — preparar para slice 6.
NO C2 card, NO launchToChat completo.

Plan → OK → implement → checklist.
```

---

## Prompt — Slice 6: C2 + launchToChat

```text
# Fase 03 slice 6: C2 replace + launchToChat unificado

Anclas: @CHAT-PLAY-FLOW.md @ARCHITECTURE.md (D-Combat) @index.html (#chat)
@chatService.js @AbilityHotbar.jsx @VttChatPanel.jsx @AttackBoonDialog.jsx

Un launchToChat. limit_break = mismo resolver que ability (M only upgrades).
1× ABILITY post; d20 LOCAL; NO DICE post para ataque.
Retirar rollAttackD20InChat desde Play.

Plan → OK → implement → checklist.
```

---

## Prompt — Slice 7: COND + TURN + cleanup

```text
# Fase 03 slice 7: COND + TURN + retirar sessionPools

Anclas: @DECISION-LOG.md (G3,G4,G12) @VITALS-AND-POOLS.md @ARCHITECTURE.md
@TokenLayer.jsx @MapContextMenu.jsx @SheetHpHud.jsx

character.conditions fuente única; token badges leen character; mirror deploy.
character.turn trackers. Dejar de leer/escribir sessionPools para vitals.
Retirar o deprecar SheetHpHud como fuente HP.

Backfill conditions token→character opcional con --dry-run.
Plan → OK → implement → checklist.
```

---

## Checklist manual (después de cada slice)

- [ ] `npm run test:phase-03` (o `test:combat-rolls` si el slice tocó rolls) — **0 failures**
- [ ] Abrir campaña de prueba con PJ conocido (solo si hay UI nueva)
- [ ] Dossier abre sin error
- [ ] HUD F4 muestra vitals coherentes con dossier (mismo `hpCur` / `vigor` sin esperar 600ms)
- [ ] Sin regresión: mapa, tokens, chat básico
- [ ] Commit con mensaje claro (cuando pidas)
- [ ] **No** datos de prueba dejados en Firebase (tests = fixtures locales)

---

## Git sugerido

```powershell
# Tras OK slice 1 en phase-03/slice-01-vitals
git add -u
git commit -m "feat(vitals): persist hpCur/vigor/effort on character (phase-03 slice 1)"

# Slice 2: opcional nueva rama desde main actualizado
git checkout main && git pull
git checkout -b phase-03/slice-02-seam-p3
```

O **una rama** `phase-03/react-port` con commits por slice — ambas válidas.

---

## Qué NO es Fase 03

- Migración Supabase (Fase 04)
- Trocear `game/{campaignId}` por mapa
- `docs/architecture/` en git sin `git add -f`
- Ejecutar backfill en prod sin backup

---

## Si algo sale mal

1. `git log` / revert del commit del slice
2. Firestore: no aplicar backfill; datos live en `sessionPools` siguen hasta slice 7
3. Vuelve al prompt del slice con `Corregir: …` en la **misma** conversación si es bug pequeño; **nueva** conversación si cambias de slice

---

## Lectura mínima antes del slice 1

1. [`VITALS-AND-POOLS.md`](./VITALS-AND-POOLS.md) — 10 min
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md) sección D-Dossier — 5 min
3. `DOSSIER-REACT-MAP.md` §10 (contradicciones) — 5 min

Luego: nueva conversación Agent, pegar prompt slice 1, anclar archivos con `@`.
