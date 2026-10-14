# Capítulo 3 — Propuesta de solución (paquete, no prosa)

## Qué es el aporte

El Archive actual, no el roadmap de mayo ni el overlay de septiembre. Lore, Codex, solar, Diario y Lab. La prosa explica decisiones, no lista archivos.

Antes de afirmar un comportamiento, leer el código. La skill `.cursor/skills/ai-narrative-lab/SKILL.md` describe situación e impacto y se quedó corta: el modo que hay que documentar de verdad es la cascada de dos pasadas.

## Modos

| Modo | En el capítulo |
|---|---|
| `cascade` (Evento narrativo), con Scout + Impact y un reintento | Resultado. Corazón del aporte. |
| `narrative_impact` (Ondas narrativas) | Resultado. El DM parte de una ficha y una instrucción, y revisa cambios de relación. |
| `situation` (Ideas de escena) | Existe en código. No es resultado. Una frase de alcance basta. |
| Arquetipo de personalidad | Existe en la ficha. No es resultado. No defenderlo como condición del modelo. |

## Apartados y ancla de código

Verificar nombres contra el archivo antes de redactar. El grafo de verdad del Archive es el Lore (fichas y relaciones de lore, con copia de mesa), no solo `wikiEntities` de la campaña.

1. **Modelo de datos.** Tipos, relaciones de afinidad (−10..+10) y estructurales, matriz de pares. Lore y lo que la mesa publica.
2. **Contexto.** Subgrafo desde un ancla, topes de profundidad, fichas y caracteres. `buildSituationContext` / contexto de cascada.
3. **Generación.** Gemini con schema. Cascada: Scout y luego Impact. Ondas: una pasada de relaciones.
4. **Validación.** `validateAiResponse`: no inventar entidades, verbo conocido, par permitido, un reintento si faltan impactos.
5. **Admisión.** Nada se escribe solo. El DM acepta, edita o rechaza. Aplicar deja el cambio en la ficha.
6. **Lectura.** Codex (leer y editar), solar (grafo manual: agrupa, sigue, paralelo; fecha opcional), Diario (acta y arco). El Lab vive sobre eso.

## Fuera del capítulo, salvo una frase de alcance

Vista de jugador, puente VTT, combate, HUD, dados, Foundry, chatbot, TF-1 a TF-4.

## Figuras (elaboración propia, pie abajo)

Ofrecerlas para descarga antes de pegarlas al Word.

1. Tubo: ancla → contexto → modelo → validador → tarjetas → admisión.
2. Codex en lectura.
3. Solar con un arco.
4. Diario con un acta.
5. Lab: generación y tarjeta con confianza.
6. Propuesta bloqueada al lado de una válida.
7. Ondas: una instrucción y sus relaciones propuestas.

## Tono

Primera persona cuando el autor decide. Impersonal cuando define. Palabras inglesas en cursiva la primera vez.
