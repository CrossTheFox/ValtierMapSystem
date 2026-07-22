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

### 1.2 Tokens

| Funcionalidad | Estado |
|---|---|
| Token visual: imagen circular + fallback de iniciales | ✅ Live |
| Hover ring (cian PJ / rojo NPC) | ✅ Live |
| Label de nombre con DPR-aware resolution sync | ✅ Live |
| Drag-to-move con GSAP (smooth transitions) | ✅ Live |
| Grid snapping al soltar | ✅ Live |
| `locationId` auto-sync al drop (`placeTokenOnBoard`) | ✅ Live |
| Override de tamaño de token (small / medium / large) | ✅ Live |
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
| Pips de esfuerzo (Effort) — toggle por pip | ✅ Live |
| Pantalla de stats (iconos + roll al chat) | ✅ Live |
| `AbilityHotbar` — barra scrollable de habilidades llamables | ✅ Live |
| Hoja de personaje (`CharactersSettingsDialog`) — tabs Identidad + Kit | ✅ Live |
| Árbol de habilidades por job (Cyberpunk 2077 style) en tab Kit | ✅ Live |
| Pre-carga de imágenes de personajes al inicio (`warmCharacterAssets`) | ✅ Live |
| `useAssetUrl` hook — caché de assets Firebase Storage | ✅ Live |
| `useCharacterSessionPools` — HP/effort por sesión en `localStorage` | ✅ Live |

### 1.4 Chat

| Funcionalidad | Estado |
|---|---|
| Panel de chat `VttChatPanel` — feed scrollable | ✅ Live |
| Tipos de mensaje: IC, OOC (prefijo `/`), DICE, ABILITY | ✅ Live |
| Auto-scroll a mensajes nuevos | ✅ Live |
| Avatar de personaje en mensajes | ✅ Live |
| Selector «HABLANDO COMO» — Autocomplete de personajes propios | ✅ Live |
| Rolls de stat → chat (desde iconos de stat en `CharacterCombatHud`) | ✅ Live |
| Abilities → chat (desde `AbilityHotbar`) | ✅ Live |
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
│   └── TokenSpeechLayer.jsx         — burbujas de diálogo
├── components/vtt/
│   ├── MapSelectorHUD.jsx           — panel superior izquierdo
│   ├── TokenDeployPanel.jsx         — panel derecho de deploy
│   ├── CharacterCombatHud.jsx       — HUD inferior izquierdo
│   ├── AbilityHotbar.jsx            — barra de habilidades
│   └── VttChatPanel.jsx             — panel de chat
├── components/hud/
│   ├── TopRightHUD.jsx              — pill de perfil
│   └── DialogStackBar.jsx           — chips de diálogos minimizados
├── store/
│   ├── gameSlice.js                 — tokenPositions, activeMapId
│   ├── playerSlice.js               — perfil, rol, activeCharacterId
│   ├── worldSlice.js                — mapa, locaciones, personajes, grilla
│   └── uiSlice.js                   — diálogos abiertos, overlays, speech
├── hooks/
│   ├── useGameSync.js               — suscripción Firestore a game/{campaignId}
│   ├── useWorldSync.js              — sync de mapa, locaciones, personajes
│   ├── useCharacterSessionPools.js  — HP/effort sesión (localStorage)
│   └── useAssetUrl.js               — caché de assets Firebase Storage
├── constants/
│   ├── dialogIds.js                 — IDs de los 7 diálogos registrados
│   ├── gridConfig.js                — config de grilla
│   └── vttHudTokens.js              — tokens de diseño del HUD
└── utils/
    ├── characterCombat.js           — listCampaignCharacters, canControlToken
    ├── tokenControl.js              — helpers de movimiento de token
    └── callableAbilities.js         — filterCallableAbilities
firebase/services/
    ├── gameService.js               — tokenPositions, activeMapId en Firestore
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
      [charId]: { x, y, sizeOverride? }
    }
  },
  activeMapId: string | null,
  partyPositions: {}  // poblado por gameService pero nunca renderizado (vestigial)
}
```

Todo el estado de token vive en **un solo documento Firestore** — lecturas baratas, escrituras sin transacción (last-write-wins en conflictos simultáneos).

---

## Parte 3 — Análisis: qué hace falta para jugar una sesión

### 3.1 Bloqueantes — sin esto la sesión está coja

| Item | Problema | Impacto |
|---|---|---|
| **VIT damage track** | VIT se muestra como texto (`VIT 5`) en `CharacterCombatHud` pero no tiene barra interactiva. Perder VIT (umbral de muerte en ICON) requiere abrir la ficha completa manualmente. | Perder VIT en combate no se puede rastrear en tiempo real |
| **`effortMax` hardcodeado** | `const effortMax = 3` en `CharacterCombatHud.jsx` ignora el valor que ya provee `resourceTracks`. Personajes con effort máximo distinto de 3 (por job, traits o nivel) verán pip count incorrecto. | Estado de effort incorrecto en combate |
| **Sin dados libres** | No hay `/roll 2d6` ni ningún comando de dado en el chat. Los rolls de stat funcionan, pero tiradas libres (daño, checks ad hoc, resistencias) son imposibles desde la UI. | El DM y jugadores necesitan dados físicos para cualquier tirada no ligada a un stat botón |
| **`QuickActionsBar` — código muerto** | Este componente legacy existe en `src/components/vtt/QuickActionsBar.jsx` y ocupa la misma posición (`bottom: 16, left: 50%`) que `CharacterCombatHud`. Actualmente **no está montado** en `UIOverlay` (confirmado), pero sigue en el repositorio confundiendo. Si alguien lo importa accidentalmente, colisiona con el HUD activo. | Riesgo de regresión; deuda técnica |
| **`AbilityHotbar` duplica derivación del roster** | `AbilityHotbar` recomputa el mismo memo de roster + personaje seleccionado que ya calculó su padre `CharacterCombatHud`, de forma independiente. Si los memos divergen (p.ej. un `useSelector` tarda), el hotbar puede mostrar habilidades de un personaje distinto al del HUD. | Desincronización potencial; lógica duplicada frágil |
| **`TokenDeployPanel` con doble suscripción** | El panel abre su propio `onSnapshot` en la colección `characters` además del que ya gestiona `useWorldSync`. Esto genera dos lecturas Firestore redundantes y puede producir estados temporalmente inconsistentes si los snapshots llegan en distinto orden. | Coste doble de Firestore reads; riesgo de estado desincronizado |
| **Sin timestamps en chat** | Los mensajes no tienen hora visible. Imposible reconstruir el orden de events durante o después de la sesión. | Replay de sesión imposible; confusión en sesiones largas |

### 3.2 Importantes pero no bloqueantes

| Item | Problema |
|---|---|
| **Sin iniciativa / orden de turno** | No hay ronda, no hay botón de fin de turno, no hay tracker de iniciativa. El DM debe gestionar el orden de combate externamente (papel, notas). |
| **Sin condiciones / efectos de estado** | Cegado, inmovilizado, ralentizado, etc. son mecánicas core de ICON. No hay representación visual ni tracking en ninguna capa. |
| **Sin visibilidad de token** | El DM no puede ocultar un token a los jugadores (emboscada, NPC no descubierto). Todos los tokens desplegados son visibles para todos. |
| **Sin accesos de teclado al hotbar** | Las habilidades del hotbar no tienen atajos 1–8. Toda interacción requiere clic. |
| **Mensajes de chat sin whisper** | No hay mensajes privados DM-a-jugador ni mensajes visibles solo para el DM. Todo el chat es público para los presentes. |
| **Badge de no-leídos sin Redux** | El conteo de mensajes no leídos se gestiona manualmente en el padre (`UIOverlay`) y no está en el store. Si el componente se desmonta y remonta, el conteo se resetea. |
| **`partyPositions` sin uso** | El campo `partyPositions` en `gameSlice` es poblado por `gameService` pero nunca leído ni renderizado. Es deuda técnica vestigial. |
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
| `CharacterCombatHud.jsx` | `const effortMax = 3` hardcodeado en lugar de usar `resourceTracks` | Alta |
| `AbilityHotbar.jsx` | Duplica `useMemo` de roster y personaje seleccionado del padre | Media |
| `TokenDeployPanel.jsx` | Doble suscripción Firestore a `characters` | Media |
| `QuickActionsBar.jsx` | Archivo dead-code que nunca se monta; confunde y tiene riesgo de regresión | Baja (borrar) |
| `gameSlice.js` | `partyPositions` nunca se renderiza; vestigial | Baja (limpiar) |
| `UIOverlay.jsx` | `chatUnread` no está en Redux; se pierde al re-mount del componente padre | Baja |

---

## Parte 5 — Hoja de ruta para primera sesión de testing

```
PRIORIDAD 1 — Arreglar antes de la sesión
──────────────────────────────────────────
[ ] Agregar barra interactiva para VIT en CharacterCombatHud
    - Usar useCharacterSessionPools con track "vit"
    - Mostrar como pip bar o slider, igual que HP
[ ] Corregir effortMax: leer de resourceTracks en lugar de const = 3
[ ] Implementar /roll XdY en VttChatPanel
    - Parsear input que empiece por /roll
    - Enviar mensaje tipo DICE con resultado al chat
[ ] Eliminar QuickActionsBar.jsx (dead code)
[ ] Refactorizar AbilityHotbar para recibir character como prop (no re-derivar roster)

PRIORIDAD 2 — Para las primeras sesiones
─────────────────────────────────────────
[ ] Initiative tracker simple (lista ordenable DM-only, en un dialog nuevo)
    - dialogIds.js: agregar "initiative"
    - UI: lista de nombres + valores, reordenable con drag
    - No requiere Firestore si es efímero por sesión
[ ] Condiciones básicas en token (badge visual)
    - Lista fija: Cegado, Inmovilizado, Ralentizado, Vulnerable, Doblado
    - Persistir en gameService tokenPositions[mapId][charId].conditions[]
[ ] Token visibility toggle (solo DM puede ocultar/mostrar)
    - gameService: campo visible (boolean, default true)
    - TokenLayer: skip render para jugadores si visible === false
[ ] Timestamps en mensajes de chat
    - chatService: incluir serverTimestamp en cada mensaje
    - VttChatPanel: mostrar hora HH:mm junto al avatar

PRIORIDAD 3 — Calidad de vida
───────────────────────────────
[ ] Resolver doble suscripción en TokenDeployPanel (usar useSelector worldSlice.charactersById)
[ ] Mover chatUnread a uiSlice (incrementar en useEffect sobre mensajes)
[ ] Deploy masivo de PJs (botón "Desplegar PJs" en TokenDeployPanel)
[ ] Limpiar partyPositions de gameSlice
```
