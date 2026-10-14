# Bibliografía de fuentes — Integración IA y memoria narrativa (pixi-map / Valt6-01)

*Documento de referencias para la redacción de la memoria del proyecto.*  
*Formato: APA 7.ª edición. Cada entrada incluye enlace directo, aporte teórico y trazabilidad hacia decisiones de diseño.*  
*Última actualización: 2025-06-10*

---

## Propósito de este documento

La memoria del proyecto está **enfocada en UI/UX**, pero debe demostrar que las decisiones de interfaz no son arbitrarias: responden a limitaciones conocidas de los LLMs, a evidencia empírica sobre narrativa interactiva y a las necesidades concretas del DJ en mesa (Valt6-01 / ICON TTRPG).

Este archivo sirve para:

1. **Citar** en formato APA con enlaces.
2. **Explicar el aporte** de cada fuente (qué aporta al conocimiento).
3. **Trazar decisiones** del proyecto hacia esas fuentes (el *por qué*).
4. **Conectar con UI/UX** (cómo se traduce en pantallas, flujos y feedback al usuario).

### Convenciones por entrada

| Campo | Contenido |
|-------|-----------|
| **Aporte** | Qué descubre o propone la fuente. |
| **Decisiones derivadas** | Qué se decidió en pixi-map por causa de esa evidencia. |
| **Impacto UI/UX** | Cómo se manifiesta en la experiencia del DJ o jugador. |

---

## Mapa resumen: decisiones de diseño ↔ fuentes

Esta tabla es el esqueleto argumental para el capítulo de *justificación de decisiones* en la memoria.

| Decisión en pixi-map | Por qué (evidencia) | Impacto UX |
|----------------------|---------------------|------------|
| Salida **JSON estructurada**, no chat libre | G-KMS, RPGBench, DeployBase: texto libre es difícil de validar y ejecutar | Tarjetas predecibles, botones Aceptar/Descartar, no conversación interminable |
| Campo **`confidence`** en propuestas | PANGeA, CallSphere: la validación reduce alucinaciones pero no las elimina | Chip visual (alta/media/baja) orienta al DJ sin bloquear la creatividad |
| **Subgrafo** desde ancla, no wiki completo | Min & Park, Emergent Mind: redes densas saturan cognición; PANGeA: contexto acotado mejora coherencia | Panel con ancla visible, métricas «N fichas, M relaciones» |
| **DJ-only** en v1 | RPGBench: LLMs fallan en mecánicas verificables; filtrado `dm_only` en Firestore | Propuestas solo en overlay del DJ; jugadores no ven borradores de IA |
| **Sin persistencia** en v1 | ChatRPG: iterar arquitectura antes de atar datos; G-KMS: admisión explícita al motor | Flujo ligero: generar → revisar → descartar o guardar manualmente |
| **Grafo NETWORK** (Pixi + force-directed) | Aparicio, Bounegru, Emergent Mind: grafos como dispositivo narrativo | Vista de alianzas, key players y tensiones antes de pedir propuestas |
| **Gemini 2.5 Flash** vía Firebase AI Logic | Google structured output + tier gratuito; PANGeA: modelo barato + validación ≈ modelo caro | Latencia <15 s, coste casi nulo en prototipo, integración nativa con stack Firebase |
| **Validación auto-reflexiva** en prompt | PANGeA: 28 % → 98 % precisión con validación (Llama-3 8B) | Menos propuestas con NPCs inventados; menos frustración del DJ |
| **Selector de intención** (conflicto, misterio…) | StoryExplorer: workflow guiado reduce carga cognitiva | Un clic antes de generar; resultados más acotados y útiles |
| **Fase 0 CLI** antes de UI | RPGBench: evaluar objetivamente antes de invertir en interfaz | Evita rediseñar tarjetas si el prompt base falla |

---

## 1. LLMs como motores narrativos en juegos de rol

### 1.1 Artículos académicos y preprints

---

#### Buongiorno et al. (2024) — PANGeA

**Buongiorno, S., Klinkert, L., Zhuang, Z., Chawla, T., & Clark, C. (2024).** PANGeA: Procedural artificial narrative using generative AI for turn-based, role-playing video games. *Proceedings of the AAAI Conference on Artificial Intelligence and Interactive Digital Entertainment*, *20*(1), 156–166. https://doi.org/10.1609/aiide.v20i1.31876  
Preprint: https://arxiv.org/abs/2404.19721 | Sitio: https://stephbuon.github.io/pangea

**Aporte.** PANGeA demuestra que un LLM puede generar narrativa coherente en RPGs por turnos si se le **acota el universo** (memoria estructurada + reglas del diseñador) y se añade un **sistema de validación** que evalúa cada respuesta contra el contexto del juego antes de mostrarla. En pruebas de ablación, Llama-3 (8B) pasa de **28 % a 98 %** de alineación narrativa con validación; GPT-4 sube de **71 % a 99 %**. Conclusión clave: **el modelo importa menos que el pipeline de validación**.

**Decisiones derivadas.**

- Incluir en el system prompt una pasada de **auto-verificación** («¿cada entidad existe en el contexto?») antes de emitir JSON.
- No depender de un modelo frontier caro: Gemini Flash + validación es suficiente para v1.
- Campo `confidence: alta | media | baja` en el esquema de situaciones: reconoce que incluso con validación quedan propuestas dudosas.
- Regla explícita «no inventar NPCs» en el prompt (regla 2 del borrador en `plan-ia-situaciones.md`).

**Impacto UI/UX.**

- Las tarjetas de propuesta muestran **entidades vinculadas con su `why`** (justificación desde el grafo), no solo texto narrativo suelto: el DJ puede auditar la coherencia sin leer todo el lore.
- Un chip de confianza evita el patrón «todo parece igual de creíble» que genera desconfianza en asistentes de IA.
- Si la validación falla en backend, la UI puede mostrar estado de error claro («propuesta descartada por entidades no verificadas») en lugar de silencio o texto genérico.

---

#### Jørgensen et al. (2025) — ChatRPG (Static vs. Agentic GM)

**Jørgensen, N. H., Tharmabalan, S., Aslan, I., Brodersen Hansen, N., & Merritt, T. (2025).** Static vs. agentic game master AI for facilitating solo role-playing experiences. *arXiv*. https://arxiv.org/abs/2502.19519  
Repositorio: https://github.com/KarmaKamikaze/ChatRPG

**Aporte.** Compara dos arquitecturas de Game Master IA: **v1** (un solo prompt) vs. **v2** (multi-agente ReAct con Narrator + Archivist). Los participantes prefieren v2 en inteligencia percibida, flow e inmersión. Sin embargo, v2 es más complejo de implementar y mantener.

**Decisiones derivadas.**

- **v1 primero:** un solo servicio `generateSituationProposals()` con prompt + schema, sin orquestación multi-agente (Fase 1).
- **Posponer multi-agente** a Fase 3+ (cuando el JSON estructurado ya funcione bien).
- Separación conceptual: «narración» (propuesta de situación) vs. «archivo» (wiki persistente) ya existe en el proyecto vía Firestore + `wikiSlice`, sin necesidad de dos agentes LLM.

**Impacto UI/UX.**

- MVP con **un botón, un loading, tarjetas**: flujo cognitivamente simple para el DJ en prep de sesión.
- Evita la trampa UX del «chat con el GM IA» que promete conversación infinita pero desorienta al preparar una campaña concreta.
- La evolución futura (agente Archivista que escribe borradores en el wiki) se puede introducir como **acción explícita** («Guardar como borrador») sin cambiar el paradigma de interacción.

---

#### Rahman et al. (2026) — G-KMS

**Rahman, A., Yu, A., & Cho, K. (2026).** Game knowledge management system: Schema-governed LLM pipeline for executable narrative generation in RPGs. *Systems*, *14*(2), 175. https://doi.org/10.3390/systems14020175

**Aporte.** Propone reformular la generación narrativa con LLM como **gestión de conocimiento ejecutable**, no como texto libre. Pipeline en cinco etapas: (1) grounding del conocimiento del juego, (2) generación gobernada por schema, (3) reparación por normalización, (4) admisión al motor, (5) aplicación. Resultados: alta fiabilidad en admisión, estructuras estables, diversidad expresiva controlada.

**Decisiones derivadas.**

- `buildWikiContextPack.js` = etapa de **grounding** (empaquetar entidades + relaciones en texto estructurado).
- `responseSchema` de Gemini = etapa de **generación gobernada**.
- Validación client-side del JSON + retry = etapa de **reparación**.
- v1 **sin persistencia automática** = admisión manual por el DJ (no escribir en Firestore sin revisión).
- Subgrafo acotado (`maxEntities: 25`, `maxDepth: 2`) = conocimiento admisible, no lore infinito.

**Impacto UI/UX.**

- El DJ actúa como **filtro humano de admisión**: ve la propuesta, decide si entra al canon. Esto respeta la autoría narrativa del DJ y evita «contaminar» el wiki con alucinaciones.
- El contrato JSON (`title`, `hook`, `stakes`, `involvedEntities`, `dramaticQuestions`, `dmNotes`) **mapea 1:1 a campos de una ficha** futura (`entityType: cronica`), facilitando el botón «Guardar como borrador» en Fase 3.
- Separar `dmNotes` de `hook` en la UI refleja la distinción jugador/DJ ya presente en `visibility: dm_only`.

---

#### Yu et al. (2025) — RPGBench

**Yu, P., Shen, D., Meng, S., Lee, J., Yin, W., Cui, A. Y., Xu, Z., Zhu, Y., Shi, X., Li, M., & Smola, A. (2025).** RPGBench: Evaluating large language models as role-playing game engines. *arXiv*. https://arxiv.org/abs/2502.00595  
OpenReview: https://openreview.net/forum?id=rbJGbacBhM

**Aporte.** Primer benchmark que evalúa LLMs como **motores de RPG** en dos tareas: Game Creation (diseñar mundos válidos) y Game Simulation (simular partidas multi-ronda). Hallazgo central: los LLMs actuales **escriben historias interesantes pero fallan en mecánicas verificables** en escenarios largos. Recomiendan evaluación **objetiva** (reglas, estados) + **subjetiva** (LLM-as-judge para interesantez y coherencia de personaje).

**Decisiones derivadas.**

- **No usar la IA para resolver mecánicas ICON** (dados, combate, estados): solo preparación narrativa.
- **Fase 0 CLI** (`testSituationPrompt.mjs`) antes de UI: evaluación objetiva («¿inventó entidades?») con criterio de salida medible (3 ejecuciones sin alucinaciones).
- Campo `dramaticQuestions` en el schema: orienta hacia lo **subjetivamente jugable**, no hacia simulación mecánica.
- Posibilidad futura de LLM-as-judge en scripts para comparar prompts (evaluación subjetiva automatizada).

**Impacto UI/UX.**

- Expectativas claras en la interfaz: el panel dice «Proponer **situación**», no «Simular sesión» ni «Resolver combate».
- Las tarjetas enfatizan **gancho + stakes + preguntas dramáticas** (valor subjetivo para la mesa), no estadísticas de personaje.
- Métricas en UI (`N fichas, M relaciones, truncado sí/no`) dan transparencia sobre qué contexto recibió la IA — reduce la sensación de «caja negra».

---

### 1.2 Repositorios de software (referencia comparativa)

Estos proyectos no son fuentes académicas, pero documentan **patrones de arquitectura** que informan qué evitar o posponer en la UI.

---

#### ITMO-Agentic-AI — AI Dungeon Master

**ITMO-Agentic-AI.** (n.d.). *AI Dungeon Master* [Código fuente]. GitHub. https://github.com/ITMO-Agentic-AI/ai-dungeon-master

**Aporte.** 8 agentes LangGraph (Story Architect, DM, World Engine, Rule Judge…) con estado unificado `GameState`. Demuestra la complejidad de un GM IA «completo».

**Decisiones derivadas.** No replicar esta arquitectura en v1. Extraer solo la lección: **separar rol narrativo de rol de reglas** (en pixi-map: IA propone, DJ decide, motor VTT no depende de la IA).

**Impacto UI/UX.** La interfaz del DJ en pixi-map no intenta ser un «simulador de campaña completa»; es una **herramienta de prep** integrada en el overlay wiki que ya usa para lore.

---

#### deusversus — AIDM

**deusversus.** (n.d.). *AIDM (AI Dungeon Master)* [Código fuente]. GitHub. https://github.com/deusversus/aidm

**Aporte.** 24+ agentes, memoria ChromaDB, agente *Relationship Analyzer* para tracking de relaciones NPC. Multi-proveedor (Gemini, Claude, OpenAI).

**Decisiones derivadas.** Las **relaciones explícitas** en `entityRelations` reemplazan la necesidad de un agente que infiera relaciones desde texto. OpenRouter/multi-modelo reservado para **experimentación en Fase 0**, no producción v1.

**Impacto UI/UX.** El panel de relaciones con autocomplete (`WikiRelationPanel`) es la UI de verdad para relaciones; la IA **consume** esas relaciones, no las inventa. Esto da control al DJ sobre el grafo antes de pedir propuestas.

---

#### lguibr — Daicer

**lguibr.** (n.d.). *Daicer* [Código fuente]. GitHub. https://github.com/lguibr/daicer

**Aporte.** Separación estricta: motor determinista (dados, pathfinding) → persistencia transaccional → narración LLM async → RAG automático. El LLM **lee el log de eventos**, no decide mecánicas.

**Decisiones derivadas.** Mismo principio en pixi-map: Pixi/Redux/Firestore son deterministas; la IA es una capa opcional encima del wiki, no del combate ICON.

**Impacto UI/UX.** La IA no aparece en el mapa VTT ni en la hoja de personaje en v1; vive en el **Narrative Archive**. El DJ mantiene dos modos mentales: «jugar en mesa» vs. «preparar lore» — la UI los separa físicamente.

---

## 2. Visualización narrativa basada en grafos

Esta sección fundamenta las decisiones de **UI del grafo NETWORK** y del overlay wiki como herramienta de exploración narrativa, no solo CRUD de fichas.

---

#### Emergent Mind (2025) — Node-based narrative visualization

**Emergent Mind.** (2025, 18 de diciembre). *Node-based narrative visualization*. https://www.emergentmind.com/topics/node-based-narrative-visualization

**Aporte.** Síntesis de cómo representar historias como grafos G=(V,E,W): nodos = entidades narrativas, aristas = relaciones tipadas (temporal, causal, co-ocurrencia, sentimiento). Recoge layouts (force-directed, storyline, DAG), métricas (centralidad, betweenness, modularidad) y **cinco lecturas narrativas** del grafo.

**Decisiones derivadas.**

- Implementar vista **NETWORK** en Pixi con layout force-directed (d3-force), coherente con la literatura de story charting.
- Tipar aristas con `relationType` (`enemigo_de`, `vive_en`, etc.) en lugar de enlaces genéricos.
- No persistir posiciones del grafo en v1: la simulación recalcula — aceptable según el estado del arte (layouts dinámicos son norma).

**Impacto UI/UX.**

- El DJ puede **explorar el grafo visualmente** antes de pulsar «Proponer situación»: reduce la sorpresa de propuestas basadas en entidades que no recordaba.
- Colores/tamaños de nodo pueden codificar tipo de entidad y centralidad (decisiones futuras de encoding visual).
- El grafo responde a la pregunta UX: «¿quién está conectado con quién en esta ciudad?» más rápido que leer fichas sueltas.

---

#### Aparicio et al. (2024) — Network visualization for story charting

**Aparicio, J. T., Karatsoli, A., & Costa, C. J. (2024).** Network visualization techniques for story charting. *arXiv*. https://arxiv.org/abs/2406.14734

**Aporte.** Transforma texto narrativo en grafo: nodos = personajes/entidades, aristas = interacciones. Usa ForceAtlas2, centralidad y detección de comunidades para revelar patrones no evidentes en lectura lineal.

**Decisiones derivadas.** Validar que el grafo wiki de Valtia sea **legible** con ~25–50 nodos por subgrafo (rango de campaña actual). Force-directed en Pixi como equivalente práctico de ForceAtlas2.

**Impacto UI/UX.** Panel dividido (lista + grafo + detalle) maximiza densidad informativa sin modales — decisión ya tomada en `plan-memoria-narrativa.md`, alineada con story charting interactivo.

---

#### Ye et al. (2024) — StoryExplorer

**Ye, L., Wang, L., Ruan, S., Meng, Y., Wang, Y., Chen, W., & Zhou, Z. (2024).** StoryExplorer: A visualization framework for storyline generation of textual narratives. *arXiv*. https://arxiv.org/abs/2411.05435  
Código: https://github.com/Clover-yee/storyline-generator

**Aporte.** Workflow en tres fases — **insight finding → scripting → storytelling** — con anotación + hints GPT para externalizar conocimiento narrativo. Reduce carga de memoria de trabajo del usuario.

**Decisiones derivadas.**

- Flujo del DJ: (1) explorar grafo/ficha (**insight**), (2) elegir intención y ancla (**scripting**), (3) generar propuesta (**storytelling**).
- Selector de intención (`conflicto`, `misterio`, `social`…) = equivalente al «scripting» guiado de StoryExplorer.
- GPT como **hint generator**, no como autor único: el DJ mantiene control del canon.

**Impacto UI/UX.**

- Secuencia de pantalla: seleccionar ancla → elegir intención → botón generar → tarjetas. No saltar directo a «generar» sin contexto.
- Futuro: anotaciones del DJ sobre el grafo (highlights) podrían alimentar el prompt — extensión natural del workflow StoryExplorer.

---

#### Min & Park (2019) — Modeling narrative structure with networks

**Min, S., & Park, J. (2019).** Modeling narrative structure and dynamics with networks, sentiment analysis, and topic modeling. *PLOS ONE*, *14*(12), e0226025. https://doi.org/10.1371/journal.pone.0226025  
Preprint (2016): https://arxiv.org/abs/1604.03029

**Aporte.** Las redes de personajes evolucionan en el tiempo; enriquecer aristas con **sentimiento** y **temas** revela dinámicas narrativas que la co-ocurrencia sola no captura. Demostrado en *Les Misérables*.

**Decisiones derivadas.**

- Priorizar relaciones con carga narrativa (`enemigo_de`, `aliado_de`, `controla`) sobre `relacionado_con` genérico en la expansión del subgrafo.
- Campo `strength` y `label` en relaciones: permite ponderar aristas en el contexto enviado al LLM.
- Futuro: codificar valencia (positiva/negativa) en color de arista en el grafo.

**Impacto UI/UX.**

- El subgrafo enviado a la IA **prioriza tensiones y alianzas**, no solo proximidad geográfica → propuestas con más conflicto dramático.
- El DJ ve en el grafo *por qué* la IA propuso cierto enfrentamiento (arista `enemigo_de` visible entre nodos).

---

#### Bounegru et al. (2017) — Narrating networks

**Bounegru, L., Venturini, T., Gray, J., & Jacomy, M. (2017).** Narrating networks: Exploring the affordances of networks as storytelling devices in journalism. *Digital Journalism*, *5*(6), 699–730. https://doi.org/10.1080/21670811.2016.1186497  
Preprint: https://arxiv.org/abs/1801.01322

**Aporte.** Protocolo para **leer narrativamente un grafo**: (1) explorar asociaciones de un actor, (2) detectar key players, (3) mapear alianzas/oposiciones, (4) evolución temporal, (5) revelar vínculos ocultos. Advierte: **un grafo sin contexto textual es ambiguo**.

**Decisiones derivadas.**

- El grafo NETWORK **no reemplaza** las fichas wiki: clic en nodo abre detalle con texto.
- Leyenda/tooltips en aristas con `relationType` + `label`.
- Campo `why` en `involvedEntities` del JSON de propuestas = puente entre grafo (visual) y narrativa (texto).

**Impacto UI/UX.**

- Evita el anti-patrón UX de «grafo bonito pero incomprensible»: siempre hay camino a la ficha completa.
- Las cinco lecturas narrativas pueden inspirar **filtros** futuros en el grafo («mostrar solo enemistades», «key players por centralidad»).
- Captions/leyenda en el panel del grafo (principio de Bounegru: anclaje textual obligatorio).

---

#### Kyaw et al. (2025) — Node-based multimodal editing

**Kyaw, Z., et al. (2025).** Node-based editing for multimodal generation of text, audio, image, and video. *arXiv* (5 de noviembre de 2025).  
*(Verificar número arXiv al citar en texto final.)*

**Aporte.** Edición narrativa directamente sobre nodos de un grafo, con generación multimodal (texto, imagen, audio) desde el canvas. Layouts topológicos (Sugiyama/DAG) para ramificaciones.

**Decisiones derivadas.** Referencia para **evolución post-MVP**: editar nodos del grafo y disparar generación IA desde el canvas. No implementar en v1.

**Impacto UI/UX.** Visión a largo plazo: clic derecho en nodo → «Proponer situación desde aquí» integrado en el grafo, no solo en panel lateral. Ramificaciones narrativas como DAG visual.

---

## 3. Structured output, evaluación de modelos y costos

Esta sección fundamenta decisiones **técnicas y económicas** que afectan latencia percibida, fiabilidad de la UI y sostenibilidad del prototipo.

---

### 3.1 Documentación oficial

---

#### Google — Firebase AI Logic: structured output

**Google.** (n.d.). *Generate structured output (like JSON and enums) using the Gemini API*. Firebase AI Logic. https://firebase.google.com/docs/ai-logic/generate-structured-output

**Aporte.** Documenta `responseMimeType: "application/json"` + `responseSchema` como **controlled generation**: el modelo está constrained a emitir JSON válido según schema, no «inspirado en» JSON.

**Decisiones derivadas.** Firebase AI Logic + Gemini como stack de integración (ya en Firebase del proyecto). Schema de situaciones definido en `situationProposalSchema.js` (Fase 1).

**Impacto UI/UX.**

- Sin JSON válido no hay tarjetas: la UI puede confiar en parseo directo sin regex frágil.
- Menos estados de error «respuesta corrupta» → menos frustración y menos spinners infinitos.
- El schema cuenta hacia el límite de tokens de entrada: justifica subgrafo acotado (no enviar schema + wiki entero).

---

#### Google — Gemini Developer API pricing

**Google.** (n.d.). *Gemini Developer API pricing*. https://ai.google.dev/gemini-api/docs/pricing

**Aporte.** Precios oficiales: Gemini 2.5 Flash $0.30/$2.50 por 1M tokens; Flash-Lite $0.15/$1.25; tier gratuito con límites RPD.

**Decisiones derivadas.** Gemini 2.5 Flash como modelo inicial; Flash-Lite como alternativa si el tier gratuito alcanza. Plan Blaze solo si se superan límites en uso real de mesa.

**Impacto UI/UX.**

- Prototipo usable **sin coste** en prep de sesión → el DJ puede regenerar propuestas sin ansiedad económica.
- Límite de regeneraciones en UI (Fase 4) como salvaguarda de costes si escala.

---

#### Google — Firebase AI Logic pricing

**Google.** (n.d.). *Understand pricing*. Firebase AI Logic. https://firebase.google.com/docs/ai-logic/pricing

**Aporte.** El SDK Firebase AI Logic es gratuito; el coste viene del proveedor Gemini. Integración sin infra adicional.

**Decisiones derivadas.** Llamada desde **cliente** en v1 (solo DJ), sin Cloud Function intermedia — reduce latencia y complejidad de deploy.

**Impacto UI/UX.**

- Respuesta directa en el overlay, sin round-trip extra a backend propio.
- App Check (Fase 1.7) como protección antes de uso intensivo, sin cambiar el flujo del DJ.

---

#### Google (2025) — Gemini 2.5 thinking models update

**Google.** (2025). *Gemini 2.5: Updates to our family of thinking models*. Google Developers Blog. https://developers.googleblog.com/gemini-2-5-thinking-model-updates/

**Aporte.** Precio unificado para Flash con/sin thinking; Flash-Lite como tier aún más barato.

**Decisiones derivadas.** Evaluar `thinkingBudget: 512–1024` para anclas complejas (muchas facciones/enemistades) sin cambiar de modelo.

**Impacto UI/UX.**

- Thinking interno puede mejorar coherencia en subgrafos densos → menos propuestas incoherentes → menos clics en «Otra idea».
- El DJ no ve el razonamiento interno; solo el resultado en tarjetas (evita sobrecarga cognitiva de CoT visible).

---

### 3.2 Comparativas de structured output y precios (recursos web)

Estas fuentes son **secundarias** (blogs/industry). Usarlas para contexto económico; citar Google + papers para claims metodológicos.

---

#### SWFTE (2026) — Cheapest LLM for structured output

**SWFTE.** (2026). *Cheapest LLM for structured output*. https://www.swfte.com/cheapest/structured-output

**Aporte.** Ranking de adherencia JSON por modelo. DeepSeek V4 Flash barato (84/100); GPT-5.5 strict mode como gold standard (97/100). Recomienda **validación client-side + retry**.

**Decisiones derivadas.** No asumir 100 % adherencia aunque Gemini tenga schema mode. Capa de validación post-respuesta en `situationAiService.js`. OpenRouter + DeepSeek reservado para **benchmark comparativo** en Fase 0 CLI.

**Impacto UI/UX.** Si falla validación → mensaje claro + botón «Reintentar» (no pantalla rota). El DJ entiende que es fallo de formato, no de su prompt.

---

#### DeployBase — Best LLM for JSON output

**DeployBase.** (n.d.). *Best LLM for JSON output: Structured data generation compared*. https://deploybase.ai/articles/best-llm-for-json-output-structured-data-generation

**Aporte.** Schema enforcement (<0.15 % error Gemini/GPT) vs. prompt-only (3–20 % error en modelos baratos). El **costo total** incluye reintentos: un modelo «barato pero 15 % error» puede costar más que uno fiable.

**Decisiones derivadas.** Priorizar schema enforcement nativo (Gemini) sobre prompt-only. Justifica no usar modelos gratuitos sin schema mode para producción.

**Impacto UI/UX.** Latencia estable > ahorro marginal con reintentos visibles. El DJ percibe un sistema «confiable» si rara vez necesita regenerar por error de formato.

---

#### CallSphere (2026) — Structured data extraction

**CallSphere.** (2026, mayo). *Structured data extraction (JSON outputs) in 2026*. https://callsphere.ai/blog/llm-comparison-structured-data-extraction-open-vs-open-may-2026

**Aporte.** Recomienda: validador determinista post-modelo; en campos ambiguos, devolver `null + confidence` en lugar de inventar.

**Decisiones derivadas.** Campo `confidence` en el schema. Validación de que cada `involvedEntities[].title` exista en el subgrafo enviado. Si no existe → marcar propuesta como `confidence: baja` o descartar.

**Impacto UI/UX.**

- Propuestas con confianza baja se muestran atenuadas o con advertencia («verificar entidades»).
- Evita que el DJ prepare una sesión basada en un NPC inventado — el impacto emocional de descubrirlo en mesa es alto.

---

#### Morph (2026), AI Magicx (2026), Metacto (2026) — Pricing comparisons

**Morph.** (2026). https://www.morphllm.com/llm-api  
**AI Magicx.** (2026). https://www.aimagicx.com/blog/llm-api-pricing-comparison-2026  
**Metacto.** (2026). https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration

**Aporte.** Tablas comparativas de precios junio 2026. Contexto para estimar coste de Fase 0 (decenas de llamadas de prueba ≈ $0.10 total).

**Decisiones derivadas.** Documentar en memoria que el coste de experimentación es despreciable; la decisión de modelo se basa en **integración + schema + latencia**, no solo en $/token.

**Impacto UI/UX.** Justifica no mostrar al DJ información de costes/tokens en v1 (ruido innecesario para usuario final).

---

### 3.3 Gateways multi-modelo (experimentación, no producción v1)

---

#### Sm1ck — LLM routing via OpenRouter

**Sm1ck.** (n.d.). *LLM routing per tier via OpenRouter*. DEV Community. https://dev.to/sm1ck/llm-routing-per-tier-via-openrouter-when-one-model-doesnt-fit-all-3ami

**Aporte.** Patrón primary → fallback (distinto proveedor) → last resort. Detectar respuestas vacías y `content_filter`, no solo HTTP errors.

**Decisiones derivadas.** Si se usa OpenRouter en Fase 0 CLI, implementar cadena de fallback y detección de respuesta vacía. No exponer routing al DJ en v1.

**Impacto UI/UX.** Transparente para el usuario: el script CLI o el servicio eligen modelo; la UI siempre dice «Generando propuestas…».

---

#### TokenMix, LLMversus, Raj, APIScout — Gateway comparisons

**TokenMix.** (2026). https://tokenmix.ai/blog/openrouter-api  
**LLMversus.** (2026). https://llmversus.com/blog/llm-gateway-comparison-2026  
**Raj, R.** (2026). https://rohitraj.tech/en/notes/openrouter-vs-litellm-vs-portkey-india-mvp-2026  
**APIScout.** (2026). https://apiscout.dev/guides/openrouter-vs-litellm-2026

**Aporte.** OpenRouter: rápido para prototipar multi-modelo; fallback ≠ garantía de calidad. LiteLLM: mejor a escala, self-hosted.

**Decisiones derivadas.** OpenRouter solo para **evaluación comparativa** en scripts. Producción v1: Firebase AI Logic directo (menos capas, menos latencia).

**Impacto UI/UX.** Menos puntos de fallo en el camino crítico del DJ (un botón → tarjetas en <15 s).

---

## 4. Documentación interna del proyecto

Artefactos del repositorio que materializan las decisiones anteriores. Citables como anexos técnicos o documentación de diseño.

---

#### plan-ia-situaciones.md

**Equipo pixi-map / Valt6-01.** (2025). *Plan — Propuestas de situación con IA* [Documento interno]. `src/constants/wiki/plan-ia-situaciones.md`

**Aporte.** Roadmap Fase 0→4, schema JSON, system prompt, estrategia de subgrafo, criterios de salida medibles, apéndice de ejemplos buenos/malos.

**Decisiones derivadas.** Todas las decisiones de § «Mapa resumen» están operacionalizadas aquí.

**Impacto UI/UX.** Define componentes concretos: `SituationProposalPanel.jsx`, selector de intención, tarjetas, integración en `NarrativeWikiOverlay.jsx` (solo DM).

---

#### plan-memoria-narrativa.md

**Equipo pixi-map / Valt6-01.** (2025). *Plan de memoria narrativa* [Documento interno]. `src/constants/wiki/plan-memoria-narrativa.md`

**Aporte.** Estado del wiki unificado, decisiones de overlay (panel dividido, grafo Pixi, sync realtime, visibilidad `dm_only` en Firestore rules).

**Decisiones derivadas.** UI de archivo narrativo como **contenedor** de la futura IA; grafo y fichas como prerrequisitos de contexto.

**Impacto UI/UX.** Coherencia visual cyber HUD (`UI_COLORS`, `CyberTitle`, `CyberText`) en panel de propuestas — misma «consola de DJ» que el resto del overlay.

---

#### buildWikiContextPack.js

**Equipo pixi-map / Valt6-01.** (2025). *buildWikiContextPack.js* [Código fuente]. `src/utils/buildWikiContextPack.js`

**Aporte.** Implementación de grounding G-KMS: entidades + relaciones + menciones → texto estructurado para prompt.

**Decisiones derivadas.** Base de `buildSituationContext.js` (Fase 0.1) con expansión por `relationType`.

**Impacto UI/UX.** Transparencia: métricas `entityCount`, `relationCount`, `truncated` visibles al DJ antes/después de generar.

---

#### Wiki graph (NETWORK)

**Equipo pixi-map / Valt6-01.** (2025). *Wiki graph* [Código fuente]. `src/pixi/wikiGraph/`

**Aporte.** Visualización force-directed en Pixi coherente con stack VTT existente.

**Decisiones derivadas.** Grafo en Pixi, no React/SVG — escala y consistencia con mapa.

**Impacto UI/UX.** Misma gramática visual (viewport, zoom, tooltips) que el mapa de campaña; curva de aprendizaje baja para el DJ.

---

#### valtiaWikiSeed.mjs

**Equipo pixi-map / Valt6-01.** (2025). *Valtia wiki seed* [Datos]. `scripts/data/valtiaWikiSeed.mjs`

**Aporte.** Corpus de prueba realista (Galathia, Mirage, Engel…) con relaciones tipadas para validar prompt y grafo.

**Decisiones derivadas.** Anclas de prueba documentadas en Apéndice A de `plan-ia-situaciones.md`.

**Impacto UI/UX.** Permite evaluar UX con datos representativos, no con wiki vacío — las tarjetas generadas son significativas en user testing.

---

## 5. Narrativa sugerida para la memoria (UI/UX)

Borrador de hilo argumental para el capítulo de justificación. Adaptar al estilo final de la memoria.

### 5.1 Problema de diseño

El DJ de Valt6-01 gestiona un universo con decenas de entidades, relaciones políticas y lore secreto. La **carga cognitiva** de preparar situaciones jugables a partir de ese material es alta (Ye et al., 2024; Bounegru et al., 2017). Un chat genérico con IA agrava el problema: respuestas no verificables, NPCs inventados, mezcla de secretos con material de jugadores (RPGBench, 2025).

### 5.2 Enfoque de solución

Diseñar un **asistente acotado** integrado en el overlay wiki existente:

1. **Explorar** el grafo y las fichas (visualización narrativa).
2. **Anclar** una entidad/locación y opcionalmente una intención (workflow StoryExplorer).
3. **Generar** 1–3 propuestas en JSON estructurado (G-KMS, Google structured output).
4. **Revisar** con señales de confianza y trazabilidad al grafo (PANGeA, CallSphere).
5. **Aceptar o descartar** sin persistencia automática (admisión manual, Rahman et al., 2026).

### 5.3 Por qué la validación importa en UX

PANGeA demuestra que la validación multiplica la fiabilidad percibida (28 % → 98 % en modelos pequeños). En términos de experiencia:

| Sin validación | Con validación (diseño pixi-map) |
|----------------|----------------------------------|
| DJ lee propuesta completa buscando errores | DJ escanea entidades + chip de confianza |
| Descubrir NPC inventado **en mesa** rompe inmersión | `why` enlaza propuesta al grafo visible |
| Desconfianza → abandono de la herramienta | Trazabilidad → confianza calibrada |
| Regenerar muchas veces (fatiga) | Regenerar solo cuando `confidence: baja` |

La validación no es solo ingeniería: es **diseño de confianza** (trust calibration) en interfaces de IA generativa.

### 5.4 Principios UX derivados de las fuentes

1. **Acotar antes de generar** (PANGeA, StoryExplorer): ancla + intención + subgrafo.
2. **Estructurar la salida** (G-KMS, DeployBase): tarjetas, no párrafos libres.
3. **Mostrar trazabilidad** (Bounegru, Aparicio): entidades + relaciones justificadas.
4. **Admitir incertidumbre** (CallSphere, PANGeA): `confidence`, no falsa precisión.
5. **Separar modos** (Daicer, RPGBench): prep narrativa ≠ juego en mesa.
6. **Transparencia de contexto** (RPGBench): métricas de subgrafo visibles.
7. **Control del DJ** (Rahman et al.): ninguna escritura automática en canon.

---

## 6. Índice alfabético por autor

| Autor / Entidad | Año | Título abreviado | § |
|-----------------|-----|------------------|---|
| AI Magicx | 2026 | LLM API pricing | 3.2 |
| APIScout | 2026 | OpenRouter vs LiteLLM | 3.3 |
| Aparicio et al. | 2024 | Story charting networks | 2 |
| Bounegru et al. | 2017 | Narrating networks | 2 |
| Buongiorno et al. | 2024 | PANGeA | 1.1 |
| CallSphere | 2026 | Structured extraction | 3.2 |
| deusversus | n.d. | AIDM | 1.2 |
| DeployBase | n.d. | JSON output comparison | 3.2 |
| Emergent Mind | 2025 | Node-based narrative viz. | 2 |
| Equipo pixi-map | 2025 | Docs y código internos | 4 |
| Google | n.d.–2025 | Firebase AI Logic, pricing | 3.1 |
| ITMO-Agentic-AI | n.d. | AI Dungeon Master | 1.2 |
| Jørgensen et al. | 2025 | ChatRPG | 1.1 |
| Kyaw et al. | 2025 | Node-based multimodal editing | 2 |
| lguibr | n.d. | Daicer | 1.2 |
| LLMversus | 2026 | Gateway comparison | 3.3 |
| Metacto | 2026 | Gemini pricing | 3.2 |
| Min & Park | 2019 | Narrative networks + sentiment | 2 |
| Morph | 2026 | LLM API providers | 3.2 |
| Rahman et al. | 2026 | G-KMS | 1.1 |
| Raj | 2026 | Gateway MVP comparison | 3.3 |
| Sm1ck | n.d. | OpenRouter routing | 3.3 |
| SWFTE | 2026 | Cheapest structured output | 3.2 |
| TokenMix | 2026 | OpenRouter API | 3.3 |
| Ye et al. | 2024 | StoryExplorer | 2 |
| Yu et al. | 2025 | RPGBench | 1.1 |

---

## 7. Notas para redacción final

1. **Primarias vs. secundarias:** Claims de validación, schema-governed generation y lectura narrativa de grafos → papers §1–2. Precios y gateways → §3 con verificación contra Google al publicar.
2. **Emergent Mind:** citar como síntesis; remontar claims a Aparicio, Ye, Min, Bounegru, Kyaw.
3. **Kyaw et al.:** completar número arXiv antes de entrega final.
4. **Figuras sugeridas para la memoria:**
   - Diagrama flujo DJ (insight → scripting → storytelling).
   - Tabla validación PANGeA adaptada al proyecto.
   - Mockup tarjeta de propuesta con anotaciones UX (`confidence`, `why`, `dmNotes`).
   - Captura grafo NETWORK + panel de propuestas integrado.
5. **APA y URLs:** sin punto final tras el enlace.

---

## 7. Multi-pass, compresión de contexto y agentes narrativos

Esta sección fundamenta las decisiones de **arquitectura two-pass** (Scout + Impact) y **Reflexion-lite retry** para el modo Evento narrativo del Lab IA. Fuentes descubiertas en la investigación de julio 2026.

---

#### Chen et al. (2026) — AutoWorldBuilder

**Chen, Z., et al. (2026).** AutoWorldBuilder: Automated, consistent world-building with LLMs. *Journal of Artificial Intelligence Research*, aceptado 2026. https://arxiv.org/html/2607.09403v1

**Aporte.** Sistema de worldbuilding automático que resuelve los tres problemas centrales del Lab IA: explosión de contexto, diversidad vs. consistencia, y control de calidad automático. **4-Layer Context Compression** (Essential + Relevant + Summary + Collaboration) → 89.9% reducción de tokens; media de 304 tokens/llamada. **Auditor separado del generador** → pass rate 42% → 85.5% en primera iteración. **DAG scheduling** para reutilizar contexto entre tareas. Genera 56–103 conceptos por mundo sin conflictos en 18–31 min.

**Decisiones derivadas.**

- El Scout (Pasa 1) = auditor separado que evalúa el grafo antes de que el Impact genere narrativa.
- El Context Compression de AutoWorldBuilder inspira el `buildScoutContext()` que comprime el subgrafo a ~1.5k tokens (solo identidades + vínculos ONTO).
- El threshold de 5 impacts para activar Two-pass refleja la recomendación de DAG: agrupa por localidad semántica solo cuando vale la pena (eventos complejos).

**Impacto UI/UX.**

- El DJ ve "Analizando red de impacto..." antes de "Generando..." — dos etapas visibles que demuestran que el sistema trabaja de forma estructurada, no aleatoria.
- El Scout es transparente para el DJ (automático, sin gate); el auditor mejora la calidad silenciosamente.

---

#### Shinn et al. (2023) — Reflexion

**Shinn, N., Cassano, F., Gopinath, A., Narasimhan, K. R., & Yao, S. (2023).** Reflexion: Language agents with verbal reinforcement learning. *Advances in Neural Information Processing Systems*, *36*, 8634–8652. https://proceedings.neurips.cc/paper/2023/file/1b44b878bb782e6954cd888628510e90-Paper-Conference.pdf

**Aporte.** Arquitectura de agente que añade una capa de **auto-crítica verbal** al ciclo de generación: el agente evalúa su propio output fallido → genera feedback específico en texto → reintenta usando ese feedback como contexto adicional. ReAct + Reflexion completa 130/134 tareas AlfWorld. El feedback verbal es más eficiente que un segundo prompt idéntico: fuerza al modelo a razonar sobre qué falló.

**Decisiones derivadas.**

- El Reflexion-lite retry del Lab IA es exactamente este patrón: `missingImpacts` → `buildReflexionPrompt(missingTitles)` → retry con solo los impacts faltantes.
- El feedback verbal ("Tu respuesta anterior tuvo N impacts faltantes: [lista]") es el "verbal reinforcement" de Shinn et al.
- Cap de 1 intento (vs. loops infinitos del Reflexion original) para evitar gastos descontrolados.

**Impacto UI/UX.**

- El DJ ve "Completando impacts faltantes (N)..." — feedback claro de que el sistema detectó un problema y lo está corrigiendo automáticamente.
- Si el retry falla (raro), el DJ recibe el resultado parcial con indicación de qué faltó — sin pantalla rota ni spinner infinito.

---

#### Yao et al. (2022) — ReAct

**Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K. R., & Cao, Y. (2022).** ReAct: Synergizing reasoning and acting in language models. *arXiv*. https://arxiv.org/abs/2210.03629 Publicado en ICLR 2023.

**Aporte.** Framework que intercala pasos de **razonamiento** (Reason) con **acciones** (Act) en LLMs, en lugar de hacerlo todo en un solo prompt. Mejoras medibles en HotpotQA, Fever, AlfWorld vs. CoT solo o Act solo. El framework ReAct es la base conceptual de todos los sistemas multi-agente narrativos (ChatRPG, AutoWorldBuilder, G-KMS).

**Decisiones derivadas.**

- El Two-pass Scout+Impact es ReAct simplificado: Reason (Scout evalúa el grafo) → Act (Impact genera los cambios).
- La separación es intencionalmente mínima (2 pasos vs. loops ReAct) porque el grafo wiki ya da la información estructural — el "reasoning" no necesita iterar.

**Impacto UI/UX.**

- Fundamento teórico para el diseño de "dos fases" que el DJ puede ver en los estados de carga.

---

#### ONTO (2025) — Object Notation for Token Optimization

**ONTO: Object Notation for Token Optimization.** (2025). *arXiv*. https://arxiv.org/html/2604.17512v1

**Aporte.** Notación columnar pipe-delimited con header: campo declarado una vez, valores en filas. Demostrado 46–51% menos tokens vs JSON para datos estructurados repetitivos (tablas, listas de objetos homogéneos). Compatible con LLMs actuales cuando se incluye un header de columnas explicativo.

**Decisiones derivadas.**

- El bloque de relaciones en `buildScoutContext()` usa formato `from|to|tipo|fuerza` en lugar del formato verboso actual (`- A → [tipo] → B (label) [fuerza: N]`).
- El header de columnas es obligatorio para que el modelo no confunda el pipe con texto narrativo.
- No se aplica aún al Impact context (riesgo de que el modelo use ONTO en su output en lugar de snake_case).

**Impacto UI/UX.**

- El Scout context es más compacto → Scout más rápido y barato → latencia total acceptable para el DJ.
- Invisible para el DJ; impacto en tokens y latencia.

---

#### TERAG (2025) — Token-Efficient Retrieval-Augmented Graph Generation

**TERAG: Token-Efficient Retrieval-Augmented Graph Generation.** (2025). *arXiv*. *(Verificar número arXiv definitivo al citar en memoria.)*

**Aporte.** 80% de accuracy con 3–11% de los tokens vs. GraphRAG completo. En lugar de serializar todo el BFS del grafo, recupera solo el subgrafo semánticamente relevante al query.

**Decisiones derivadas.**

- El "relation-first packing" ya implementado en `buildCascadeContext()` es la versión pixi-map de TERAG: solo relaciones entre ancla + impacts directos, no todo el subgrafo BFS.
- `buildScoutContext()` va más lejos: solo vínculos entre los N impacts top, ONTO-comprimidos.

**Impacto UI/UX.**

- Menor número de tokens de input → menor latencia percibida → DJ espera menos entre "Generar" y las tarjetas.

---

#### Jørgensen et al. (2025) — SENNA (extensión de ChatRPG)

*(Ver entrada principal en §1.1 — ChatRPG.)*

**Extensión SENNA.** La versión v3/SENNA del sistema ChatRPG introduce 5 agentes: Examiner, Narrator, Memory, Planner y Summarizer. El **Examiner pre-evalúa** cada acción del jugador contra el Narrative Graph antes de que el Narrator genere texto. Este patrón es exactamente el Two-pass Scout+Impact.

**Decisiones derivadas adicionales.**

- El Scout (Examiner) usa el grafo wiki (Firestore) como "Narrative Graph".
- A diferencia de SENNA, el Scout es sincrónico y sin loop: una evaluación → una generación. Sin agentes persistentes.

---

## Inspección de la interfaz

#### Nielsen, J. (1994) — Heuristic evaluation

**Nielsen, J. (1994).** Heuristic evaluation. En J. Nielsen y R. L. Mack (Eds.), *Usability inspection methods* (pp. 25–62). John Wiley & Sons.

**Aporte.** Diez heurísticas y una escala de severidad de 0 a 4. Un evaluador encuentra una parte de los problemas; tres a cinco evaluadores es el diseño completo del método.

**Decisiones derivadas.**

- La validación de interfaz del capítulo 4 es una inspección de un evaluador, el autor, en un solo pase.
- El texto dice esa cobertura. No se presenta como un estudio con varios DM.

**Impacto UI/UX.**

- Codex, solar, Diario y Lab se miran con las diez heurísticas. Una severidad 4 en una tarea central se corrige. El resto se reporta.

#### Amershi et al. (2019) — Guidelines for human-AI interaction

**Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R., y Horvitz, E. (2019).** Guidelines for human-AI interaction. *Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems*, 1–13. https://doi.org/10.1145/3290605.3300233

**Aporte.** Dieciocho guías para que una persona entienda qué hace el sistema, qué tan seguro está, sobre qué contexto trabaja, por qué propuso algo, y cómo corregir, aceptar, rechazar o abortar antes de que el cambio quede escrito.

**Decisiones derivadas.**

- En el Lab se usa un subconjunto de ocho guías, no las dieciocho.
- No se aplican al Codex, al solar ni al Diario.

**Impacto UI/UX.**

- La revisión por tarjeta, la confianza y el botón de cancelar la generación son el lugar donde esas guías se comprueban.

---

## Historial

| Fecha | Cambio |
|-------|--------|
| 2025-06-10 | Creación inicial con fuentes de investigación IA + visualización narrativa. |
| 2025-06-10 | Ampliación: aporte, decisiones derivadas, impacto UI/UX, mapa resumen y narrativa sugerida para memoria. |
| 2026-07-14 | Añadidas §7 fuentes multi-pass: AutoWorldBuilder, Reflexion, ReAct, ONTO, TERAG, SENNA/ChatRPG extensión. |
| 2026-10-14 | Añadidas Nielsen (1994) y Amershi et al. (2019) para la inspección del capítulo 4. |
