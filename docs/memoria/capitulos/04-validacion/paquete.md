# Capítulo 4 — Validación (paquete, no prosa)

## Hipótesis que se defiende

Una cascada anclada al grafo, filtrada por validación determinista, solo propone cambios entre entidades que existen y pares que la matriz permite. El DM acepta, edita o rechaza cada uno. Nada se escribe solo.

No se defiende que sea más rápida que editar a mano. Eso exigía A/B, SUS y varios DM. Queda como trabajo futuro, con el instrumento en `docs/memoria/evaluacion/03-protocolo-sesion.html`, sin ejecutar.

## Qué no es esta validación

No es un estudio de usuarios. No hay cronómetro, ni SUS, ni segunda pasada de rediseño, ni juez automático, ni nota de calidad literaria. Un evaluador (el autor) hace una inspección. El texto dice que un solo evaluador no cubre lo que cubrirían tres a cinco (Nielsen, 1994).

## Capa 1 — Compuerta, sin modelo

Tests del validador y el paquete fijo Eval-01. PF-A se acepta después de pasar la fuerza de +4 a −8. PF-B se rechaza. PF-C es un hecho, sin mover la barra. PF-D y PF-E quedan bloqueados. Revisión: suite en verde y una captura del contador.

## Capa 2 — Re-corrida funcional

Solo los ids que el informe de octubre marcó como falla y que el código ya tocó. El informe no se reescribe. Se anexa la corrida. Lista de cierre en `docs/memoria/definicion-cierre.md`, sección «Problemas del testeo de octubre».

## Capa 3 — Generaciones y alucinación

Campaña piloto Aldermar (`PILOTO-EVAL-IA`). No Valtia. Re-sembrar entre corridas. No pulsar Aplicar: la persistencia se mira en la capa 2, con el paquete fijo.

El Caso 01 de Zorgun, Felicia y Oni entra como una frase: hubo una prueba informal en la campaña real y la planilla quedó sin números. No se vuelve a generar.

### Niveles: cuánto lore come el modelo

Confirmado el 2026-10-13. El nivel no es la fuerza del argumento. Es el tamaño del lore de Aldermar que el contexto puede incluir. La instrucción es la misma en los tres, para que la única variable sea ese tamaño. Texto: Eval-01 (`docs/memoria/casos-prueba-ia-eval.md`). Ancla: Elara. Modo: cascada.

Cada corrida parte de un grafo recién sembrado. No se pulsa Aplicar. Una corrida no deja fichas ni relaciones para la siguiente.

El contexto sale de un recorrido desde la ancla, con tope de profundidad, de fichas y de caracteres (`buildSituationContext`, `cascadeOptsForDepth`). Lore desconectado de Elara no entra. Por eso cada nivel es un superconjunto del anterior, unido a la corte, y el tope del nivel alto tiene que dejar pasar el anillo nuevo. Si el tope corta antes, el nivel alto no es más contexto: es el mismo prompt.

| Nivel | Grafo | Qué se anota como variable |
|---|---|---|
| Bajo | Núcleo unido a Elara: Aldric, Serene, la muerte de Serene, el palacio, la casa real. | Fichas y caracteres realmente enviados. |
| Medio | Seed actual de Aldermar (`scripts/data/evalWikiSeed.mjs`), topes por defecto de la cascada. | Los mismos dos números. |
| Alto | El seed medio más un anillo conectado (personas y organizaciones alcanzables desde Elara o Aldric), con topes subidos para que ese anillo quepa. | Los mismos dos números. Si el alto no supera al medio en caracteres, la corrida no sirve y se rehace el anillo. |

Cinco corridas por nivel. Quince llamadas de cascada. Ondas narrativas: cinco corridas solo en el nivel medio, la misma instrucción, las mismas columnas. No se cruzan los dos modos con los tres tamaños.

### Qué cuenta como invención

La nota al pie del capítulo 1 define alucinación como inventar un personaje o una relación que no existe en la wiki. No se anota juicio de calidad del relato.

El validador parte eso en dos columnas, y las dos entran:

1. **Alucinación.** Entidad que no está en el contexto. Es la definición del capítulo 1.
2. **Rechazo de regla.** Verbo desconocido o par que la matriz no permite. No es un personaje inventado. Se reporta aparte para no inflar la alucinación.

Una relación nueva entre dos fichas que sí existen, y que la matriz permite, es el funcionamiento esperado. No es alucinación.

Columnas: fichas enviadas, caracteres enviados, parseo, propuestas válidas, alucinaciones, rechazos de regla y motivo, `missingImpacts`, reintento, confianza predominante. Nada se escribe en el Lore.

Corrida hecha el 2026-10-14. Veinte filas, ninguna pendiente, ninguna aplicada. Tabla y JSON en `corridas/`. Totales, Scout en 404 y el cambio de modelo de las ondas en `decisiones-corrida.md`.

## Capa 4 — Inspección de un solo pase

Superficies: Codex, solar, Diario, Lab. Fuera: vista de jugador y puente al mapa.

Instrumento:

- Nielsen, diez heurísticas, severidad 0 a 4, formulario `docs/memoria/evaluacion/02-heuristicas-nielsen.html`. La de agosto de 2026 es inspección previa del Lab viejo, no la foto de esta UI. Puente en `definicion-cierre.md`.
- Amershi et al. (2019), solo en el Lab, estas ocho: qué puede hacer el sistema, qué tan seguro está, qué contexto muestra, por qué lo propuso, corrección antes de escribir, aceptar o rechazar por tarjeta, consecuencias de aplicar, y abortar la generación.

Muy grave, y solo eso se corrige: severidad 4 en una tarea central (no se puede generar, no se distingue un bloqueo de una propuesta válida, o se puede escribir canon sin querer). Se corrige esa cosa, se vuelve a mirar solo esa fila, y el resto se redacta. Severidad 3 se queda como resultado.

Tareas del pase: las del protocolo de octubre sobre esas cuatro superficies, en Aldermar. La propuesta de ese pase, sin ratificar, está en `capa4-inspeccion-propuesta.md`. La compuerta corrida está en `capa1-compuerta.md`. El anexo de octubre está en `capa2-recorrida.md`.

## Orden

Esta evidencia existe antes de redactar el capítulo. El producto que se inspecciona es el Archive ya congelado.
