# Definición de cierre — validación, bibliografía, generaciones y Nielsen

Fecha: 2026-10-12. Esto no es el capítulo. Fija qué se va a escribir, con qué fuentes y qué ya está resuelto en el producto. El estado del arte se redacta después, en el estilo de abajo.

## Estilo, cuando se redacte

Español neutro, semi-formal, en primera persona del autor cuando cuente una decisión, y en impersonal cuando defina un concepto. Las palabras inglesas van en cursiva la primera vez (*Dungeon Master*, *structured output*, *grounding*) y después se puede usar la forma ya dicha. No se traduce un paper párrafo a párrafo. Cada fuente entra así: qué aporta, qué decisión salió de eso en este sistema, y dónde se ve en la interfaz. Eso ya es el patrón de `docs/memoria/bibliografia-fuentes.md`.

Citación: APA `(Autor, Año)` en todo el documento, confirmado el 2026-10-13. La plantilla `[ApellidoAA]` del Capítulo 2 no se usa. El alcance cerrado y los paquetes por capítulo están en `docs/memoria/capitulos/`.

Muestra de tono, no es texto del capítulo: «PANGeA muestra que acotar el universo y validar la salida cambia más el resultado que cambiar de modelo. Por eso el Lab no escribe en el Lore hasta que el DM acepta el impacto.»

## Bibliografía que entra

Primarias, las que sostienen una afirmación del marco o de la validación:

| Fuente | Para qué sección | Qué se puede afirmar |
|---|---|---|
| Buongiorno et al., 2024, PANGeA | 2.2 | Validar la salida importa más que el modelo. El 28 % → 98 % es de ellos, no de esta memoria. |
| Jørgensen et al., 2025, ChatRPG / SENNA | 2.2 y 2.5 | Un examinador sobre el grafo antes de narrar. Aquí el Scout es un paso, no cinco agentes. |
| Rahman et al., 2026, G-KMS | 2.2 | Cinco etapas: grounding, schema, reparación, admisión, aplicación. La admisión es humana. |
| Yu et al., 2025, RPGBench | 2.2 y capítulo 4 | Evaluación objetiva (reglas y estado) aparte de la subjetiva (si el relato es interesante). Esta memoria solo hace la objetiva. |
| Ye et al., 2024, StoryExplorer | 2.3 | Anclar la exploración en una entidad. |
| Aparicio et al., 2024 | 2.3 | Leer una historia como red. |
| Bounegru et al., 2017 | 2.3 | Carga de narrar una red. |
| Min y Park, 2019 | 2.3 | Red narrativa y sentimiento. No se copia el análisis de sentimiento. |
| Google, Firebase AI Logic, structured output y precios | 2.4 | JSON gobernado por schema. El precio se verifica contra la doc oficial al entregar. |
| Chen et al., 2026, AutoWorldBuilder | 2.5 | Auditor distinto del generador. El Scout cumple ese papel. |
| Shinn et al., 2023, Reflexion | 2.5 | Un reintento con la lista de impactos faltantes. Tope de un intento. |
| Yao et al., 2022, ReAct | 2.5 | Reason y luego Act, en dos pasos, no en un loop. |
| Nielsen, 1994 | Capítulo 4 | Diez heurísticas, severidad 0 a 4. Un evaluador encuentra una fracción; tres a cinco es el diseño completo. Hay que agregarla a `bibliografia-fuentes.md` al redactar. No está hoy. |
| `docs/investigacion-worldanvil-funciones.md` | 2.6 | Diferenciar. No es un brazo experimental. |

Secundarias. Sirven de contexto de precio o de producto, no de claim metodológico: SWFTE, Metacto, Morph, AI Magicx, DeployBase, CallSphere, APIScout, LLMversus, Raj, Sm1ck, TokenMix, Emergent Mind.

Repos de contraste, no de arquitectura: ITMO-Agentic-AI, deusversus/AIDM, lguibr/Daicer.

Pendientes de verificar antes de la bibliografía final, ya anotados en el archivo de fuentes: número arXiv de Kyaw et al. (2025), de ONTO (2025) y de TERAG (2025). Si no se confirman, no se citan como paper. La decisión de diseño (contexto corto, subgrafo, no el grafo entero) se apoya en TERAG solo como idea, o se omite.

No entra al marco: VTT de combate, dados ICON, Foundry, monetización.

## Estado del arte — esquema, sin redactar

2.1 TTRPG y la wiki de campaña. El DM mantiene consecuencias. El problema es la carga de actualizar el grafo a mano. Aquí se nombra la carga. No se mide.

2.2 Motores de lenguaje para rol. PANGeA, ChatRPG, G-KMS, RPGBench. Cierre del apartado: este sistema no simula la partida. Propone cambios de relación sobre fichas que ya existen.

2.3 Grafos y lectura narrativa. StoryExplorer y las redes narrativas. Cierre: el ancla es una ficha, el contexto es un subgrafo con tope, no el wiki completo.

2.4 Salida estructurada. Schema de Gemini y validación determinista después del modelo. Cierre: sin JSON válido no hay tarjetas.

2.5 Dos pasadas y un reintento. Scout, Impact, Reflexion con un solo retry. Cierre: no hay agente persistente ni loop.

2.6 Trabajos relacionados. World Anvil como archivo de campaña, y los DM de chat como el camino que no se tomó. Cierre: la diferencia es la admisión humana sobre un grafo propio, no un chat.

## Qué se valida

Hipótesis de diseño, capítulos 2 y 3: anclar, estructurar y no escribir solo baja la carga de mantener el lore. No es un resultado.

Hipótesis de validación, capítulo 4: una cascada anclada al grafo, filtrada por validación determinista, solo propone cambios entre entidades que existen y pares que la matriz permite. El DM acepta, edita o rechaza cada uno. Nada se escribe solo.

Eso reemplaza la hipótesis vieja del protocolo `03-protocolo-sesion.html` («la cascada es más rápida que editar a mano»). Esa exigía A/B, SUS y al menos cinco DM. Queda como trabajo futuro, con el instrumento ya diseñado y sin ejecutar.

## Cómo se valida y cómo se revisa

Cuatro capas. El orden importa: primero el producto corregido, después el modelo, después la heurística. Si se genera antes de re-correr, la tabla describe otra interfaz.

1. Compuerta, sin modelo. Tests del validador y el paquete fijo Eval-01. PF-A se acepta después de pasar la fuerza de +4 a −8. PF-B se rechaza. PF-C es un hecho, sin mover la barra. PF-D y PF-E quedan bloqueados y se ven en el contador. Revisión: la suite en verde y una captura del contador con bloqueados.

2. Re-corrida funcional. Solo los ids que el informe de octubre marcó como falla o a medias y que el código ya tocó. El informe no se reescribe. Se anexa una corrida de corrección. Revisión: cada id con la marca nueva y, si falla otra vez, una frase.

3. Tres generaciones vivas. Definidas en la sección siguiente. Revisión: la tabla completa, semilla reiniciada entre corridas, ningún impacto aplicado en esas tres pasadas.

4. Nielsen nuevo. Definido más abajo. Revisión: una tabla de diez filas por cuatro superficies, con severidad y una evidencia por fila. La de agosto se cita como inspección previa, no como foto de esta UI.

Queda fuera, y se dice así: SUS, cronómetro, calidad literaria del modelo, lore de Valtia Zero One, VTT de combate.

## Generaciones

Corridas el 2026-10-14. Veinte filas en `docs/memoria/capitulos/04-validacion/corridas/`. Cero alucinaciones. Un rechazo de regla (`rival` en `cascade-alto-4`). El Caso 01 de Zorgun, Felicia y Oni no se volvió a generar: `casos-prueba-ia.md` lo cuenta sin números, y aceptarlo tocaría el lore de mesa.

## Nielsen — qué se hizo y por qué la UI cambió

La inspección del 2 de agosto de 2026 está en `docs/memoria/evaluacion/nielsen-aproximacion.txt`. Fue una lectura de código del Lab anterior al Archive, no una sesión con el protocolo. Severidad media aproximada 2,2. Tres heurísticas en 3: lenguaje del DM, control, y chips de modo que no se podían pulsar.

Esas tres, y las dos de prioridad siguiente, empujaron la UI actual:

| Hallazgo de agosto | Severidad | Qué hay ahora |
|---|---|---|
| H2. La pantalla decía IMPACTS, STAKES, PANGeA y `relationType`. | 3 | Esas etiquetas ya no están en el resultado. Queda «PANGeA» en la ayuda del arquetipo de la ficha. El ejemplo del evento nombraba a Zorgun y Oni en cualquier campaña. El ejemplo pasó a uno genérico. |
| H3. No se podía cancelar una generación larga, ni deshacer un aplicado. | 3 | La generación se puede abortar. Deshacer un impacto ya escrito sigue sin existir. La mitigación sigue siendo la campaña piloto y volver a sembrar. |
| H4. Los chips de modo parecían botones y solo eran tooltips. La multi-ancla no afectaba el evento. | 3 | Los modos se eligen con un clic. La multi-ancla sí entra en la llamada. Hay que volver a mirarla en la pasada nueva: si el DM no entiende para qué está, la severidad no baja a 0. |
| H5. Se podía volver a aplicar lo ya aplicado. | 2 | Sigue siendo un punto de la pasada nueva. No se da por cerrado. |
| H1. El Scout y el reintento fallaban solo en la consola. | 2 | El reintento visible («completando impactos faltantes») salió de Reflexion. Hay que comprobar en la pasada nueva si un fallo sigue siendo solo consola. |
| P1. Ocultar la multi-ancla en Evento narrativo. | — | No se ocultó. Se conectó. La pasada nueva decide si eso se entiende. |

La pasada nueva no repite agosto. Recorre Codex, solar, Diario y Lab del Archive actual, con las mismas tareas del protocolo de octubre. Un evaluador: el autor. Escala 0 a 4. Por cada heurística, una evidencia (qué se vio) y la severidad. En el texto se dice que un solo evaluador no cubre lo que cubrirían tres.

La propuesta de esa pasada, hecha el 2026-10-14 sobre Aldermar base y todavía sin ratificar por el autor, está en `docs/memoria/capitulos/04-validacion/capa4-inspeccion-propuesta.md`. No cita severidades hasta esa ratificación. No hubo severidad 4 sugerida.

Lo que agosto no miró, y octubre sí, entra en esa tabla: dos grafos (Lore y copia de mesa), el verbo de una afinidad, el arco del diario, y el jugador que ve su circuito publicado y no el tablero del DM.

## Problemas del testeo de octubre

El informe se conserva con sus fallas. Esto es el estado del código después de las correcciones, no una re-corrida.

Cerrado en código. El anexo de la re-corrida está en `docs/memoria/capitulos/04-validacion/capa2-recorrida.md`:

- Convertir un nodo conserva el id.
- Borrar una ficha del Lore borra sus relaciones. Quitar un chip del índice, o quitar `participo_en` en el riel, suelta la arista.
- El diario toma el arco desde `agrupa` y, si el acta está anexada, ya no dice que la sesión vive solo en el diario.
- Citar un acontecimiento escribe `eventIds` y no dibuja `agrupa`.
- PF-D y PF-E se cuentan como bloqueados. La propuesta de prueba abre aunque el slug de Elara sea `princesa-elara-alder`.
- El Codex de la mesa lista las fichas del Lore, acontecimientos, misión y crónica incluidos, y el riel lee las relaciones del Lore.
- El verbo de una afinidad se cambia en la misma arista.
- Nueva mesa crea la mesa y su Lore local. La tarjeta del hub nombra las mesas anexadas. Desde una mesa, anexar lista solo esa mesa.
- Cambiar de pestaña avisa si hay un borrador sin guardar, y deja el área en la URL.
- Alta de ficha en una mesa con Lore: el editor del Archive, no el formulario viejo de la wiki.
- La continuación de un impacto sin prosa muestra el cambio de vínculo, no solo «sin texto».
- En lectura de jugador, el aviso de token no pide editar la ficha.
- El ejemplo del evento narrativo ya no nombra personajes de Valtia.

No son bugs, y no se van a «arreglar» para que el informe quede en verde:

- El resumen «esposa de Aldric» es prosa del seed. Aceptar PF-A cambia la arista, no esa frase.
- El blur del título en el solar guarda, a propósito.
- El Lab del jugador es su circuito publicado. Sin un personaje unido a una ficha, el vacío es ese mensaje. No es el tablero del DM.
- Deshacer un impacto ya aplicado no existe. Se vuelve a sembrar la piloto.
- Las etiquetas de los trazos que se montan en el tablero de Aldermar quedan como hallazgo para el Nielsen nuevo, no como un parche en esta pasada.
- Glosario, menciones `@` y arrastre del solar figuraban como no corridos. No hay un defecto que cerrar ahí.
