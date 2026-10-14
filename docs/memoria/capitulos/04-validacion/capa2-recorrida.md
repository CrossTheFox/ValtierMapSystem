# Capa 2 — re-corrida de los ítems de octubre

Fecha: 2026-10-14. El informe `docs/memoria/evidencia-archive/informe-testeo-archive.html` no se reescribe. Esta nota es el anexo.

Sesión en vivo: biblioteca de EnvyTheDm, Lore **Aldermar base**, sin abrir Valtia Zero One. No se creó mesa, no se borró ficha, no se convirtió un nodo y no se pulsó Generar ni Aplicar.

| Ítem que octubre dejó abierto | Marca | Dónde se vio |
|---|---|---|
| Convertir un nodo conserva el id | Cerrado en código. No se convirtió un nodo en vivo. | `LoreTimeline.convertNode` actualiza o reescribe la misma `id` y devuelve esa `id`. |
| Borrar una ficha suelta sus aristas; quitar un chip del índice también | Cerrado por prueba. No se borró nada en Aldermar. | `loreIndexRelations.test.mjs`. En el Codex, la ficha de Marcus muestra «Quitar» en «Miembro confirmado de Consejo Real» y en «Vive en Solhaven». |
| El diario lee el arco desde `agrupa` | Cerrado por prueba. En vivo, la única sesión de Aldermar está en «Sin arco». | `loreSessions.test.mjs`. La pantalla dice «Sin acontecimiento y sin fecha D.Z. La sesión vive solo en el Diario.» Eso corresponde a una sesión sin acta colgada, no a una sesión ya anexada. |
| Citar un acontecimiento escribe `eventIds` y no dibuja `agrupa` | Cerrado por prueba. | `withSessionEvent` en `loreSessions.test.mjs`. |
| PF-D y PF-E bloqueados; Elara con slug `princesa-elara-alder` | Cerrado por prueba. | `capa1-compuerta.md`. |
| El Codex de la mesa lista las fichas del Lore | Cerrado por prueba de enlace. No se abrió la mesa en esta pasada. | `labMesaTwin.test.mjs`. |
| El verbo de una afinidad se cambia en la misma arista | Cerrado por prueba. | `labGraph.test.mjs`: reemplaza la arista anterior del par. |
| Nueva mesa crea la mesa y su Lore local | No se pulsó «Nueva mesa». Crear una mesa dejaría datos de prueba nuevos. | El hub muestra el botón. Las mesas ya anexadas se listan por nombre (PILOTO-EVAL-IA, Prueba Archive, Testeo anexo desde mesa, Testeo vacío mesa). |
| Cambiar de pestaña avisa si hay borrador y deja el área en la URL | La URL sí. El aviso no se provocó. | Codex → solar → Diario → Lab dejó `areaFilter` en `timeline`, `sessions` y `neural_lab`. El aviso está en `confirmLeaveEditorDraft`. No había un borrador abierto. |
| Alta de ficha en una mesa con Lore usa el editor del Archive | El botón «Nueva ficha» está en el Codex del Lore. No se abrió, para no crear una ficha. | Codex de Aldermar base. |
| Una continuación sin prosa muestra el cambio de vínculo | Cerrado por prueba. | `aiImpactBlocks.test.mjs`. |
| En lectura de jugador, el vacío no pide editar la ficha | Cerrado en el texto del vacío. No se entró como jugador. | Si el personaje no está unido: «Cuando un DM una tu personaje con una ficha…». Si no está publicado: «El DM publica el ego…». `CampaignNeuralLabOverlay.jsx`. |
| El ejemplo del evento narrativo no nombra Valtia | Visto en vivo. | Placeholder del Lab: `ej: "El rey asesina a la reina para salvar a la heredera"`. |

Lo que esta pasada no vuelve a marcar como falla: el resumen «esposa de Aldric» sigue siendo prosa del seed; el blur del solar guarda a propósito; no existe deshacer un impacto ya aplicado.
