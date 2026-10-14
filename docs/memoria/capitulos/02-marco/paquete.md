# Capítulo 2 — Marco conceptual (paquete, no prosa)

## Qué tiene que hacer el capítulo

Delimitar el problema con definiciones y conectar cada fuente a una decisión real del Archive. Patrón de cada fuente: aporte, decisión que salió de eso, dónde se ve en la interfaz. No es un resumen de papers.

Citación: APA. No usar `[ApellidoAA]`.

## Apartados

1. **2.1 TTRPG y la wiki de campaña.** El DM mantiene consecuencias. El problema es la carga de actualizar el grafo a mano. Se nombra la carga. No se mide.
2. **2.2 Motores de lenguaje para rol.** PANGeA, ChatRPG, G-KMS, RPGBench. Cierre: este sistema no simula la partida. Propone cambios de relación sobre fichas que ya existen.
3. **2.3 Grafos y lectura narrativa.** StoryExplorer, Aparicio, Bounegru, Min y Park. Cierre: el ancla es una ficha y el contexto es un subgrafo con tope.
4. **2.4 Salida estructurada.** Schema de Gemini y validación determinista después del modelo. Cierre: sin JSON válido no hay tarjetas.
5. **2.5 Dos pasadas y un reintento.** Scout, Impact, Reflexion con un solo retry, ReAct en dos pasos. Cierre: no hay agente persistente ni loop.
6. **2.6 Trabajos relacionados.** World Anvil como archivo. Los DM de chat (ITMO, AIDM, Daicer) como el camino que no se tomó. Cierre: la diferencia es la admisión humana sobre un grafo propio.
7. **Inspección, dentro de 2.4 o al cierre de 2.6, corto.** Nielsen (1994) y Amershi et al. (2019). Solo las definiciones que el capítulo 4 va a usar. No es un estado del arte de usabilidad.

Máximo tres niveles de numeración.

## Fuentes primarias y qué se puede afirmar

Detalle y trazabilidad en `docs/memoria/bibliografia-fuentes.md`. Al redactar, no copiar la tabla: usarla.

| Fuente | Afirmación permitida |
|---|---|
| Buongiorno et al. (2024), PANGeA | Validar la salida importa más que el modelo. El 28 % → 98 % es de ellos, no de esta memoria. |
| Jørgensen et al. (2025), ChatRPG | Un examinador sobre el material antes de narrar. Aquí el Scout es un paso, no varios agentes. |
| Rahman et al. (2026), G-KMS | Cinco etapas: grounding, schema, reparación, admisión, aplicación. La admisión es humana. |
| Yu et al. (2025), RPGBench | Evaluación objetiva (reglas y estado) aparte de la subjetiva. Esta memoria hace la objetiva. |
| Ye et al. (2024), StoryExplorer | Anclar la exploración en una entidad. |
| Aparicio et al. (2024); Bounegru et al. (2017); Min y Park (2019) | Leer una historia como red. No se copia el análisis de sentimiento. |
| Google, Firebase AI Logic | JSON gobernado por schema. El precio se verifica contra la doc oficial al entregar. |
| Chen et al. (2026), AutoWorldBuilder | Auditor distinto del generador. El Scout cumple ese papel. |
| Shinn et al. (2023), Reflexion | Un reintento con la lista de impactos faltantes. Tope de un intento. |
| Yao et al. (2022), ReAct | Reason y luego Act, en dos pasos, no en un loop. |
| Nielsen (1994) | Diez heurísticas, severidad 0 a 4. Un evaluador encuentra una fracción de los problemas. Hay que agregar la ficha a `bibliografia-fuentes.md` al redactar. |
| Amershi et al. (2019) | Pautas de interacción humano-IA. Entran las que el capítulo 4 aplica al Lab. Hay que agregar la ficha al redactar. |
| `docs/investigacion-worldanvil-funciones.md` | Diferenciar. No es un brazo experimental. |

Ficha APA pendiente de pegar en la bibliografía:

Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R. y Horvitz, E. (2019). Guidelines for human-AI interaction. En *Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems* (pp. 1–13). ACM. https://doi.org/10.1145/3290605.3300233

Nielsen, J. (1994). Enhancing the explanatory power of usability heuristics. En *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems* (pp. 152–158). ACM. https://doi.org/10.1145/191666.191729

## No citar como paper si el arXiv no se confirma

Kyaw et al. (2025), ONTO (2025), TERAG (2025). La decisión de contexto corto se apoya en PANGeA, Min y Park, y en el código (`maxDepth`, `maxEntities`), no en un preprint sin número.

## No entra al marco

VTT de combate, dados ICON, Foundry, monetización, situación como resultado, trabajo futuro TF-1 a TF-4.
