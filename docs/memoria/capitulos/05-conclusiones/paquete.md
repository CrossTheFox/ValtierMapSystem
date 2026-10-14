# Capítulo 5 — Conclusiones (paquete, no prosa)

Mínimo cinco páginas. Es el capítulo que la plantilla trata como el centro de la memoria.

## Texto del capítulo 1 (PDF, 2026-10-13)

Título: «Diseño e implementación de un sistema inteligente de gestión narrativa para campañas TTRPG basado en enriquecimiento automático de wikis». Autor: Christian Ossa. Profesora guía: Lioubov Dombrovskaia. El correferente figura como «Nombre del Correferente»: hay que reemplazarlo antes de entregar. No copiar al repo el RUT ni el teléfono del formulario.

**1.5 Objetivo general.** Desarrollar una solución informática que permita nutrir una wiki de campañas TTRPG mediante inteligencia artificial, asistiendo la actualización contextual de información y mejorando la consistencia narrativa del mundo documentado.

**1.6 Objetivos específicos.**

1. Diseñar una estructura de información capaz de representar entidades narrativas y sus relaciones.
2. Incorporar mecanismos para registrar nuevos eventos relevantes dentro de la campaña.
3. Analizar eventos ingresados considerando el contexto ya existente en la wiki.
4. Detectar entidades potencialmente afectadas por cada situación registrada.
5. Generar sugerencias de actualización coherentes sobre personajes, lugares, organizaciones o cronologías.
6. Facilitar revisión humana antes de aplicar cambios propuestos.
7. Mantener historial de modificaciones realizadas.
8. Reducir tiempo dedicado a mantención documental manual.
9. Mejorar continuidad narrativa entre sesiones.

**1.7.** Prototipo de apoyo documental. Se espera disminuir la carga administrativa, aumentar la coherencia y dar apoyo creativo al director y a los participantes. El 1.7 no trae una lista de exclusiones. Las exclusiones las fija este paquete (combate, Foundry, estudio de usuarios, tiempo).

**Definición de alucinación (nota al pie de 1.4).** Inventar un personaje o una relación que no existe en la wiki. El 28 % → 98 % es de PANGeA, no de este prototipo.

## Lectura para el capítulo 5 (no es el párrafo final)

El capítulo 5 responde cada objetivo. Esta lectura es el límite de lo que se puede decir. El redactor no la sube de categoría.

| Objetivo | Qué se puede decir |
|---|---|
| General | El prototipo asiste la actualización y deja la consistencia estructural en manos del validador y del DM. «Mejorar la consistencia» se sostiene en que no escribe entidades inventadas, no en un juicio literario. |
| 1 | Cumplido. Grafo tipado, afinidad y estructura, matriz de pares. Describir el Lore del Archive, no el esquema de mayo. |
| 2 | Cumplido en Diario y solar. La cascada propone; no registra el evento sola. |
| 3 | Cumplido. El contexto es el subgrafo de la ancla, con tope. |
| 4 | Cumplido como mecanismo (Scout y ondas). La tabla de tres tamaños de lore dice si sigue detectando cuando el contexto crece. |
| 5 | Parcial. Hay sugerencias sobre fichas existentes. «Coherentes» aquí significa que pasan el validador. No hay medida de coherencia literaria. |
| 6 | Cumplido. Nada se aplica sin aceptación. |
| 7 | Parcial, a verificar en código al redactar: los bloques de impacto quedan en la ficha. No afirmar un historial completo de toda la wiki si el código no lo tiene. |
| 8 | No medido. No hay cronómetro ni comparación contra edición manual. No se declara cumplido. |
| 9 | No medido. No hay evidencia de continuidad entre sesiones sucesivas. El diseño la busca. No es un resultado. |

El resumen ya dice que los resultados preliminares muestran una reducción de la carga manual. El capítulo 4 no va a medir eso. Al revisar el resumen, esa frase se baja a una expectativa, o el capítulo 5 queda contradiciendo la primera página.

El 1.7 promete apoyo a los participantes. La vista de jugador no entra en la inspección ni en las generaciones. Se declara fuera de lo validado.

## Trabajo futuro que sí se quiere

Sigue TF-1 a TF-4 y la Fase 6 (A/B, SUS, tiempo) de `docs/roadmap-wiki-memoria.md`. El objetivo 8 es exactamente esa fase, no un olvido. La Fase 7 no se prioriza.

## Estructura, cuando el 1.6 esté pegado

1. Alcances y limitaciones, contra el 1.7 y contra lo implementado.
2. Síntesis de resultados, corta, sin repetir los capítulos 3 y 4.
3. Objetivos, uno por uno.
4. Contribución: para el DM de esta mesa, y el patrón de ingeniería (RAG sobre grafo, validación determinista, admisión humana).
5. Trabajo futuro que el autor sí quiere construir, de `docs/roadmap-wiki-memoria.md`:
   - TF-1 impacto anclado en el suceso.
   - TF-2 captura de sesión que propone propagación.
   - TF-3 skills de comportamiento.
   - TF-4 agente de lore con secretos y desvío.
   - Fase 6 del roadmap (A/B, SUS, tiempo) como estudio no hecho.
   - Fase 7 (Foundry, monetización, timelines multi-rama) como lo que no se prioriza.

## No declarar como resultado

Situación, arquetipo, vista de jugador, puente VTT, deshacer un impacto ya aplicado, calidad literaria del modelo, números del Caso 01 de Valtia, cualquier métrica que la capa 3 todavía no haya tabulado.
