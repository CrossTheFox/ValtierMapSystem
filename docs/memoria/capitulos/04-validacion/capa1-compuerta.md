# Capa 1 — compuerta, sin modelo

Fecha: 2026-10-14. No hubo llamada a Gemini. No se aceptó ningún impacto.

## Suite

Comando:

`node --test src/utils/validateAiResponse.test.mjs src/utils/eval01Package.test.mjs src/utils/labImpactReview.test.mjs src/utils/aiImpactBlocks.test.mjs src/utils/labContainment.test.mjs src/utils/labGraph.test.mjs src/utils/labImpactMarks.test.mjs src/utils/loreIndexRelations.test.mjs src/utils/loreSessions.test.mjs src/utils/archiveTimeline.test.mjs src/utils/timelinePublish.test.mjs src/utils/labMesaTwin.test.mjs`

Resultado: 128 pruebas, 0 fallos.

`eval01Package.test.mjs` cubre el paquete fijo:

- PF-A llega como enemistad válida en +4. El DM puede dejar la fuerza en −8 antes de aceptar (`effectiveItem`).
- PF-B es una enemistad válida de Elara hacia Aldric. La rechaza el DM; el validador no la bloquea.
- PF-C es `participo_en`, hecho estructural, fuerza 0.
- PF-D es la ficha «Reina Fantasma», sin id en el Lore.
- PF-E es `aliado_de` entre crónica e ideología. El validador lo marca inválido.
- El slug vivo `princesa-elara-alder` resuelve a la ficha de Elara.

## Contador

Mismas fichas del seed, con el slug vivo de Elara. `buildEval01Package` + `reviewCounts` sobre la revisión vacía:

| Pendientes (el DM decide) | Bloqueados |
|---:|---:|
| 3 | 2 |

Los tres pendientes son PF-A, PF-B y PF-C. Los dos bloqueados son PF-D y PF-E.

En el Lab de Aldermar base (`loreId=tBIoFE4GHNQQpxV6diow`), el botón se ve con el nombre accesible «Abrir propuesta fija Eval-01 sin llamar al modelo». Esta pasada no lo abrió: el contador de arriba es el de la función que ese botón ejecuta.
