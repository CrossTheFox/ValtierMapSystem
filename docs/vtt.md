# VTT — Referencia completa (Valt6-01)

*Herramienta de mesa virtual basada en PixiJS + React + Firebase. Uso principal: DM. Los jugadores acceden a la misma URL con rol restringido.*

---

## Parte 1 — Estado actual: qué funciona hoy

### 1.1 Mapa e infraestructura

| Funcionalidad | Estado |
|---|---|
| Viewport PixiJS (pan/zoom/wheel) con `pixi-viewport` | ✅ Live |
| Capa de locaciones (`LocationsLayer`) — pins y labels en el mapa | ✅ Live |
| Switching de mapa: DM navega libremente, jugadores ven solo el mapa publicado | ✅ Live |
| Chip «LIVE» en `MapSelectorHUD` que indica el mapa activo para jugadores | ✅ Live |
| Botón «Publicar mapa a jugadores» (`setActiveMapForPlayers`) | ✅ Live |
| Configurador de grilla (columnas por mapa, solo DM) con persistencia por mapa | ✅ Live |
| Toggle visual de grilla | ✅ Live |
| `GridLayer` — overlay de celdas sobre el mapa | ✅ Live |
| Reglas compartidas (`RulersLayer` + sync Firestore) | ✅ Live |
| `LeftToolsRail` — regla + tray de dados | ✅ Live |

### 1.2 Tokens

| Funcionalidad | Estado |
|---|---|
| Token visual: imagen circular + fallback de iniciales | ✅ Live |
| Hover ring (cian PJ / rojo NPC) | ✅ Live |
| Label de nombre con DPR-aware resolution sync | ✅ Live |
| Drag-to-move con GSAP (smooth transitions) | ✅ Live |
| Multi-select (click / Shift) + marquee LMB + arrastre grupal | ✅ Live |
| Grid snapping al soltar | ✅ Live |
| `locationId` auto-sync al drop (`placeTokenOnBoard` / batch) | ✅ Live |
| Override de tamaño de token (small / medium / large) | ✅ Live |
| Condiciones en token (`conditions[]` + badges + menú RMB) | ✅ Live |
| Visibilidad DM (`visible`, ocultos para jugadores) | ✅ Live |
| Panel de deploy `TokenDeployPanel` — filtros PJ/NPC, desplegado/no desplegado | ✅ Live |
| Drag desde panel de deploy al mapa | ✅ Live |
| Botón de remover token del mapa | ✅ Live |
| Speech bubble layer (`TokenSpeechLayer`) — burbujas desde chat VTT | ✅ Live |

### 1.3 Personajes y HUD de combate

| Funcionalidad | Estado |
|---|---|
| `CharacterCombatHud` — panel inferior izquierdo | ✅ Live |
| Avatar picker con popover de búsqueda | ✅ Live |
| Barra de HP click-to-set, persistida por sesión en Firestore | ✅ Live |
| Barra de VIT click-to-set (session pool, umbral de muerte) | ✅ Live |
| Pips de esfuerzo (Effort) — max desde `resourceTracks` | ✅ Live |
| Pantalla de stats (iconos + roll al chat) | ✅ Live |
| `AbilityHotbar` — barra scrollable; recibe `character` del HUD | ✅ Live |
| `DiceRollerBar` — dados libres Nd4…Nd100 + custom | ✅ Live |
| Overlay de revelado de dados (`DiceRevealOverlay`) | ✅ Live |
| Hoja de personaje (`CharactersSettingsDialog`) — tabs Identidad + Kit | ✅ Live |
| Árbol de habilidades por job (Cyberpunk 2077 style) en tab Kit | ✅ Live |
| Pre-carga de imágenes de personajes al inicio (`warmCharacterAssets`) | ✅ Live |
| `useAssetUrl` hook — caché de assets Firebase Storage | ✅ Live |
| `useCharacterSessionPools` — HP / VIT / effort por sesión | ✅ Live |

### 1.4 Chat

| Funcionalidad | Estado |
|---|---|
| Panel de chat `VttChatPanel` — feed scrollable | ✅ Live |
| Tipos de mensaje: IC, OOC (prefijo `/`), DICE, ABILITY | ✅ Live |
| Auto-scroll a mensajes nuevos | ✅ Live |
| Avatar de personaje en mensajes | ✅ Live |
| Selector «HABLANDO COMO» — Autocomplete de personajes propios | ✅ Live |
| Rolls de stat → chat (desde iconos de stat en `CharacterCombatHud`) | ✅ Live |
| Rolls libres → chat (desde `DiceRollerBar` / `LeftToolsRail`) | ✅ Live |
| Abilities → chat (desde `AbilityHotbar`) | ✅ Live |
| Timestamps `HH:mm` en mensajes | ✅ Live |
| `GlossaryTextRenderer` — resalta términos del glosario en mensajes | ✅ Live |

### 1.5 Navegación y diálogos

| Funcionalidad | Estado |
|---|---|
| `MapSelectorHUD` — panel superior izquierdo con nav principal | ✅ Live |
| `TopRightHUD` — pill de perfil + menú (sheet, settings, archive, logout) | ✅ Live |
| `DialogStackBar` — barra inferior de diálogos minimizados (7 slots) | ✅ Live |
| Toggle de panel chat / panel tokens desde `TopRightHUD` | ✅ Live |
| Badge de mensajes no leídos en botón de chat | ✅ Live |
| Admin panel (DM) — tabs Maps, Players, Session, Wiki, VTT Content | ✅ Live |
| Initiative tracker (sync Firestore, Play + Tu Turno + auto-pan) | ✅ Live |

---

## Parte 2 — Arquitectura técnica

### 2.1 Mapa de archivos clave

```
src/
├── pages/
│   └── MainMapPage.jsx              — entrypoint (auth, campaña, sync)
├── layers/
│   ├── PixiRoot.jsx                 — canvas PixiJS + viewport
│   └── UIOverlay.jsx                — toda la UI React sobre el mapa
├── pixi/
│   ├── MapViewport.jsx              — viewport principal
│   ├── LocationsLayer.jsx           — pins de locaciones
│   ├── GridLayer.jsx                — overlay de celdas
│   ├── TokenLayer.jsx               — tokens de personajes
│   ├── TokenSpeechLayer.jsx         — burbujas de diálogo
│   └── RulersLayer.jsx              — reglas compartidas de mesa
├── components/vtt/
│   ├── MapSelectorHUD.jsx           — panel superior izquierdo
│   ├── LeftToolsRail.jsx            — regla + dados
│   ├── DiceRollerBar.jsx            — tray NdX
│   ├── TokenDeployPanel.jsx         — panel derecho de deploy
│   ├── CharacterCombatHud.jsx       — HUD inferior izquierdo
│   ├── AbilityHotbar.jsx            — barra de habilidades
│   └── VttChatPanel.jsx             — panel de chat
├── components/hud/
│   ├── TopRightHUD.jsx              — pill de perfil
│   └── DialogStackBar.jsx           — chips de diálogos minimizados
├── store/
│   ├── gameSlice.js                 — tokenPositions, activeMapId, rulers, sessionPools
│   ├── playerSlice.js               — perfil, rol, activeCharacterId
│   ├── worldSlice.js                — mapa, locaciones, personajes, grilla
│   └── uiSlice.js                   — diálogos abiertos, overlays, speech
├── hooks/
│   ├── useGameSync.js               — suscripción Firestore a game/{campaignId}
│   ├── useWorldSync.js              — sync de mapa, locaciones, personajes
│   ├── useCharacterSessionPools.js  — HP/VIT/effort sesión (localStorage + Firestore)
│   └── useAssetUrl.js               — caché de assets Firebase Storage
├── constants/
│   ├── dialogIds.js                 — IDs de los 7 diálogos registrados
│   ├── gridConfig.js                — config de grilla
│   └── vttHudTokens.js              — tokens de diseño del HUD
└── utils/
    ├── characterCombat.js           — listCampaignCharacters, resolveVit/Hp
    ├── tokenControl.js              — helpers de movimiento de token
    └── callableAbilities.js         — filterCallableAbilities
firebase/services/
    ├── gameService.js               — tokenPositions, activeMapId, rulers, sessionPools
    ├── mapService.js                — CRUD de mapas
    ├── characterService.js          — CRUD de personajes
    ├── chatService.js               — mensajes de chat (colección live)
    └── playerAdminService.js        — gestión de jugadores (DM)
```

### 2.2 Modelo de estado de juego

`gameSlice` (Redux) sincronizado desde Firestore `game/{campaignId}`:

```js
{
  tokenPositions: {
    [mapId]: {
      [charId]: { x, y, sizeOverride?, conditions?: string[], visible?: boolean }
    }
  },
  activeMapId: string | null,
  rulers: {},
  sessionPools: {},
  partyPositions: {}  // poblado por gameService pero nunca montado (vestigial; PartyLayer huérfano)
}
```

Todo el estado de token vive en **un solo documento Firestore** — lecturas baratas, escrituras sin transacción (last-write-wins en conflictos simultáneos).

---

## Parte 3 — Análisis: qué hace falta para jugar una sesión

### 3.1 Bloqueantes / deuda aún abierta

| Item | Problema | Impacto |
|---|---|---|
| **`TokenDeployPanel` con doble suscripción** | El panel abre su propio `onSnapshot` en la colección `characters` además del que ya gestiona `useWorldSync`. | Coste doble de Firestore reads; riesgo de estado desincronizado |
| **Sin `/roll` en chat** | Dados libres existen vía `DiceRollerBar`; el comando de texto `/roll XdY` sigue sin parsearse. | Nice-to-have; no bloquea sesión |

### 3.1b Resuelto (Prioridad 1 + 2)

| Item | Resolución |
|---|---|
| VIT damage track | Barra click-to-set en `CharacterCombatHud` vía session pool `vit` |
| `effortMax` hardcodeado | Lee `resourceTracks[].maxDefault` |
| Dados libres | `DiceRollerBar` + `LeftToolsRail` → `rollDiceInChat` |
| `QuickActionsBar` dead code | Eliminado |
| `AbilityHotbar` duplicaba roster | Recibe `character` del padre |
| Initiative tracker | `InitiativeTurnBar` top strip (BG3-style), synced in `game.initiative`; DM Play/pass; players view-only + auto-pan |
| Condiciones en token | `conditions[]` + badges + menú RMB |
| Visibilidad de token | `visible` + hide jugadores; toggle DM |
| Timestamps chat | `HH:mm` en `VttChatPanel` |
| Multi-select / marquee / multi-drag | `ui.selectedTokenIds` + `TokenLayer` + `placeTokensOnBoard` |

### 3.2 Importantes pero no bloqueantes

| Item | Problema |
|---|---|
| **Sin accesos de teclado al hotbar** | Las habilidades del hotbar no tienen atajos 1–8. Toda interacción requiere clic. |
| **Mensajes de chat sin whisper** | No hay mensajes privados DM-a-jugador ni mensajes visibles solo para el DM. Todo el chat es público para los presentes. |
| **Badge de no-leídos sin Redux** | El conteo de mensajes no leídos se gestiona manualmente en el padre (`UIOverlay`) y no está en el store. Si el componente se desmonta y remonta, el conteo se resetea. |
| **`partyPositions` sin uso** | El campo `partyPositions` en `gameSlice` es poblado por `gameService` pero nunca montado en el árbol Pixi. Es deuda técnica vestigial. |
| **Writes no-transaccionales** | `gameService` usa merge-writes simples. Movimientos simultáneos de DM y jugador en el mismo token producen last-write-wins. Riesgo bajo en grupos pequeños, pero existe. |
| **Sin «desplegar todos los PJs»** | `TokenDeployPanel` no tiene un botón de deploy masivo. Hay que arrastrar token por token al mapa al inicio de cada combate. |

### 3.3 Fuera de alcance (post-MVP)

| Tema | Por qué esperar |
|---|---|
| Fog of War | Requiere shader o render texture en PixiJS; esfuerzo alto, impacto bajo para uso personal DM-screen |
| Atajos de teclado globales | Necesita gestión de focus para no interferir con campos de texto |
| Whisper / GM-only chat | Requiere reglas Firestore adicionales por mensaje |
| Combate multi-mapa simultáneo | Fuera de alcance del modelo de datos actual |
| Dados 3D | Cosmético; dados simples son suficientes para ICON |

---

## Parte 4 — Bugs y deuda técnica conocida

| Archivo | Problema | Prioridad |
|---|---|---|
| `TokenDeployPanel.jsx` | Doble suscripción Firestore a `characters` | Media |
| `gameSlice.js` | `partyPositions` nunca se monta; vestigial | Baja (limpiar) |
| `UIOverlay.jsx` | `chatUnread` no está en Redux; se pierde al re-mount del componente padre | Baja |
| `DistanceMeasureLayer.jsx` | Existe pero no está montado; medición va por rulers | Baja (doc/cleanup) |

---

## Parte 5 — Hoja de ruta para primera sesión de testing

```
PRIORIDAD 1 — Arreglar antes de la sesión
──────────────────────────────────────────
[x] Agregar barra interactiva para VIT en CharacterCombatHud
[x] Corregir effortMax: leer de resourceTracks en lugar de const = 3
[x] Dados libres vía UI (DiceRollerBar / LeftToolsRail → rollDiceInChat)
[ ] (opcional) Implementar /roll XdY en VttChatPanel
[x] Eliminar QuickActionsBar.jsx (dead code)
[x] Refactorizar AbilityHotbar para recibir character como prop

PRIORIDAD 2 — Para las primeras sesiones
─────────────────────────────────────────
[x] Initiative tracker simple (DM-only, efímero)
[x] Condiciones básicas en token (badges + conditions[])
[x] Token visibility toggle (solo DM)
[x] Timestamps visibles HH:mm en chat
[x] Multi-select + marquee + multi-drag de tokens

PRIORIDAD 3 — Calidad de vida
───────────────────────────────
[ ] Resolver doble suscripción en TokenDeployPanel (usar useSelector worldSlice.charactersById)
[ ] Mover chatUnread a uiSlice (incrementar en useEffect sobre mensajes)
[ ] Deploy masivo de PJs (botón "Desplegar PJs" en TokenDeployPanel)
[ ] Limpiar partyPositions de gameSlice
```
