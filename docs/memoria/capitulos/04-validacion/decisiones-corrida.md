# Decisiones de la corrida — 20 generaciones

Fecha: 2026-10-14. Tabla fila a fila: `corridas/resumen.md`. JSON por corrida: `corridas/*.json`. Respuesta cruda: `corridas/*.raw.json`. Ninguna propuesta se aplicó. Valtia no se tocó.

## Totales

| Serie | n | Fichas en el prompt | Caracteres | Cambios válidos (suma) | Alucinaciones | Rechazos de regla | Reintentos Reflexion | JSON inválido |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Cascada bajo | 5 | 4 | 2427 | 13 | 0 | 0 | 0 | 0 |
| Cascada medio | 5 | 10 | 4422 | 22 | 0 | 0 | 1 | 0 |
| Cascada alto | 5 | 14 | 8027 | 53 | 0 | 1 | 2 | 0 |
| Ondas, nivel medio | 5 | 17 | 4523 | 15 | 0 | 0 | 0 (el modo no reintenta) | 0 |

Alucinación = entidad que el validador no encuentra en el contexto enviado. Rechazo de regla = verbo desconocido, par prohibido, hecho estructural, fallecido u otra regla del validador. Un cambio válido entre fichas que sí están en el contexto no es alucinación.

El tamaño del contexto sube de verdad: 2427, luego 4422, luego 8027 caracteres, sin truncar. Los cambios válidos suben con ese tamaño (13, 22, 53). Las alucinaciones no suben: siguen en cero. La única regla rota es un verbo `rival` en `cascade-alto-4`, y el reintento no lo corrigió.

Confianza predominante: alta en 19 corridas. `impact-medio-5` quedó en media. Las veinte parsearon JSON. `impact-medio-2` falló primero con 503 y se completó en un reintento posterior, el 2026-10-14T00:52Z, con el mismo modelo y el mismo grafo: 3 cambios válidos, 0 alucinaciones, 0 rechazos. El resumen anterior que la mostraba sin parseo estaba desactualizado respecto del JSON. La tabla de `corridas/resumen.md` ya coincide con las veinte filas.

`missingImpacts` quedó vacío en las veinte. El reintento, cuando corrió, no fue por un personaje esperado que faltara.

## Qué se disparó el reintento

El Lab reintenta una vez si falta un impacto, si el JSON viene truncado, o si un cambio es inválido.

| Corrida | Por qué reintentó | Qué quedó |
|---|---|---|
| cascade-medio-2 | Cambio inválido en Reina Serene Alder | Sin rechazo de regla al final. Sin faltantes. |
| cascade-alto-1 | Cambio inválido en Gremio de Mercaderes de Solhaven | Sin rechazo de regla al final. El gremio no estaba en la lista de impactos esperados. |
| cascade-alto-4 | Cambio inválido en Barón Cedric Harwick | Sigue el rechazo: tipo de relación desconocido `rival`. |

La columna «sí, no completó» del resumen no significa que hayan quedado impactos faltantes. Significa que el reintento no se contó como «completó una lista de faltantes», porque esa lista ya estaba vacía. El faltante no era el motivo.

## Scout

El umbral del producto es 5 impactos esperados. Bajo tuvo 2 (Serene, Aldric) y medio tuvo 3 (más Marcus): el Scout no debía correr, y no corrió. Alto tuvo 7 y sí lo intentó, las cinco veces, con `gemini-2.5-flash-lite`.

Las cinco respondieron 404: ese modelo ya no está disponible para esta clave. El mensaje de la API pide `gemini-3.5-flash-lite`. El Lab trata el fallo del Scout como no fatal y sigue con una sola pasada. Estas cinco corridas altas son eso: una sola pasada, sin semilla del Scout. El prompt de impacto mide 8027 caracteres, igual que el contexto, sin el bloque de reacciones previstas.

No se repitió el alto con el modelo nuevo. Hacerlo habría medido un tubo que el código todavía no usa. El defecto queda anotado: la pasada previa está configurada con un modelo que esta clave no puede llamar, y la generación continúa igual.

## Libertades

1. **Seed local, no Firestore.** El grafo es `scripts/data/evalWikiSeed.mjs`, el mismo de Aldermar. No se sembró `PILOTO-EVAL-IA` ni se abrió el Lab en el navegador. Cada corrida carga el grafo de nuevo en memoria, así que una no deja fichas para la siguiente. No hay botón Aplicar en este camino.
2. **Tubo del panel, no el del CLI viejo.** `scripts/testSituationPrompt.mjs` hace una sola llamada y no reintenta. El runner `scripts/runMemoriaGeneraciones.mjs` repite lo que hace `WikiAiLabPanel`: contexto de cascada a profundidad 3, guardrails por defecto, Scout si hay 5 impactos o más, validación, y un reintento Reflexion. Temperatura 0.8, topP 0.95, schema JSON, thinkingBudget 0, tope de salida el del modo (6144 en cascada, 8192 en ondas).
3. **Sin caída a flash-lite en la cascada.** El servicio de producción, si Flash falla, prueba flash-lite. Aquí la cascada se quedó en `gemini-2.5-flash`. Si Flash respondía 503 o 429 de tasa, se reintentó el mismo modelo. Esos reintentos HTTP están en `calls[].httpRetries`. No son el reintento Reflexion.
4. **Anillo alto inventado para la prueba.** Diez fichas (Roderick, Isolde, Harwick, Caldus, Brenna, Pell, el gremio, la casa Harwick, la tregua, la crónica de la frontera) y sus aristas viven en el runner, no en el seed canónico ni en una campaña. Están unidas a Elara o a Aldric para que el recorrido las incluya. No son lore de Valtia ni del seed de evaluación. En alto se subieron solo los topes de fichas (48), relaciones (80) y caracteres (20000). La profundidad siguió en 3, igual que bajo y medio. Sin ese tope el anillo se habría cortado y el alto no sería más contexto.
5. **Bajo: el grafo tenía 6 fichas y el prompt se llevó 4.** Entraron Elara, Aldric, Serene y el Palacio Real. Quedaron fuera la Casa Real Alder y el acontecimiento Muerte de la Reina Serene. Se anota lo enviado, no lo sembrado.
6. **Ondas en `gemini-3.8-flash`, no en Flash 2.5.** La cuota gratuita de `gemini-2.5-flash` es 20 llamadas al día. Las quince cascadas y sus reintentos la llenaron; la API pidió reintentar en unas 23 horas. `gemini-2.0-flash` ya no existe en esta clave. `gemini-2.5-flash-lite` responde 404. `gemini-3.5-flash` estuvo en alta demanda (503). `gemini-3.8-flash` aceptó el mismo schema y el mismo validador. Las cinco ondas son de ese modelo. No sirven para decir que ondas y cascada se comportan igual: el modelo cambió. Sí sirven para el nivel medio de ondas, porque las cinco usaron el mismo modelo, el mismo grafo y la misma instrucción. La cuota de 3.8 es de 5 llamadas; se espaciaron los reintentos 503.
7. **«Propuestas válidas» = cambios aceptados por el validador**, no tarjetas de impacto. Una tarjeta puede traer varios cambios.

## Qué quedó fuera de estas veinte llamadas, y dónde se anotó después

La compuerta sin modelo está en `capa1-compuerta.md` (128 pruebas en verde; contador 3 pendientes y 2 bloqueados). La re-corrida de los ítems de octubre está en `capa2-recorrida.md`. La inspección de un pase está propuesta en `capa4-inspeccion-propuesta.md` y falta que el autor la ratifique. Ninguna de esas tres capas volvió a llamar al modelo.

## Lectura para el capítulo 4, sin subirla de categoría

Con más lore en el contexto, la cascada propone más cambios y el validador sigue sin dejar pasar una entidad inventada. Eso es lo que estas veinte filas sostienen. No sostienen que el modelo sea más rápido que editar a mano, ni que el relato sea mejor, ni que el Scout esté operando: en el alto, el Scout no llegó a correr.
