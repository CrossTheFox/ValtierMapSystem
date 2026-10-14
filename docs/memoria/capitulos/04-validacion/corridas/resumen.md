# Generaciones Aldermar — resultados

Fecha de corrida: 2026-10-14T00:52:49.974Z

Instrucción única (Eval-01): Se descubre que Aldric, el padre de Elara, asesinó a Serene, su esposa (y madre de Elara) para salvarla, ya que esta quería asesinarla.

Ancla: Elara. Temperatura 0.8. Nada se aplicó al Lore. El modelo de cada fila está en la tabla: la cascada usó gemini-2.5-flash, sin caída a flash-lite; las ondas usaron el modelo que quedó en esa corrida. Scout: gemini-2.5-flash-lite solo si los impactos esperados son 5 o más.

| Id | Modo | Nivel | Modelo | Fichas | Chars | Trunc | Parseo | Válidas | Aluc. | Regla | Faltan | Reintento | Confianza |
|---|---|---|---|---:|---:|---|---|---:|---:|---:|---|---|---|
| cascade-alto-1 | cascade | alto | gemini-2.5-flash | 14 | 8027 | no | sí | 7 | 0 | 0 | — | sí, no completó | alta |
| cascade-alto-2 | cascade | alto | gemini-2.5-flash | 14 | 8027 | no | sí | 11 | 0 | 0 | — | no | alta |
| cascade-alto-3 | cascade | alto | gemini-2.5-flash | 14 | 8027 | no | sí | 11 | 0 | 0 | — | no | alta |
| cascade-alto-4 | cascade | alto | gemini-2.5-flash | 14 | 8027 | no | sí | 11 | 0 | 1 | — | sí, no completó | alta |
| cascade-alto-5 | cascade | alto | gemini-2.5-flash | 14 | 8027 | no | sí | 13 | 0 | 0 | — | no | alta |
| cascade-bajo-1 | cascade | bajo | gemini-2.5-flash | 4 | 2427 | no | sí | 3 | 0 | 0 | — | no | alta |
| cascade-bajo-2 | cascade | bajo | gemini-2.5-flash | 4 | 2427 | no | sí | 1 | 0 | 0 | — | no | alta |
| cascade-bajo-3 | cascade | bajo | gemini-2.5-flash | 4 | 2427 | no | sí | 3 | 0 | 0 | — | no | alta |
| cascade-bajo-4 | cascade | bajo | gemini-2.5-flash | 4 | 2427 | no | sí | 3 | 0 | 0 | — | no | alta |
| cascade-bajo-5 | cascade | bajo | gemini-2.5-flash | 4 | 2427 | no | sí | 3 | 0 | 0 | — | no | alta |
| cascade-medio-1 | cascade | medio | gemini-2.5-flash | 10 | 4422 | no | sí | 4 | 0 | 0 | — | no | alta |
| cascade-medio-2 | cascade | medio | gemini-2.5-flash | 10 | 4422 | no | sí | 4 | 0 | 0 | — | sí, no completó | alta |
| cascade-medio-3 | cascade | medio | gemini-2.5-flash | 10 | 4422 | no | sí | 4 | 0 | 0 | — | no | alta |
| cascade-medio-4 | cascade | medio | gemini-2.5-flash | 10 | 4422 | no | sí | 6 | 0 | 0 | — | no | alta |
| cascade-medio-5 | cascade | medio | gemini-2.5-flash | 10 | 4422 | no | sí | 4 | 0 | 0 | — | no | alta |
| impact-medio-1 | narrative_impact | medio | gemini-3.8-flash | 17 | 4523 | no | sí | 3 | 0 | 0 | — | no | alta |
| impact-medio-2 | narrative_impact | medio | gemini-3.8-flash | 17 | 4523 | no | sí | 3 | 0 | 0 | — | no | alta |
| impact-medio-3 | narrative_impact | medio | gemini-3.8-flash | 17 | 4523 | no | sí | 3 | 0 | 0 | — | no | alta |
| impact-medio-4 | narrative_impact | medio | gemini-3.8-flash | 17 | 4523 | no | sí | 3 | 0 | 0 | — | no | alta |
| impact-medio-5 | narrative_impact | medio | gemini-3.8-flash | 17 | 4523 | no | sí | 3 | 0 | 0 | — | no | media |

## Detalle por corrida

### cascade-alto-1

- Grafo sembrado: 34 fichas. Contexto: 14 fichas, 24 relaciones, 8027 caracteres. Prompt de impacto: 8027 caracteres.
- Scout: falló: Gemini 404: {
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/get-started).",
    "status": "NOT_FOUND"
  }
}
.
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 7.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-alto-2

- Grafo sembrado: 34 fichas. Contexto: 14 fichas, 24 relaciones, 8027 caracteres. Prompt de impacto: 8027 caracteres.
- Scout: falló: Gemini 404: {
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/get-started).",
    "status": "NOT_FOUND"
  }
}
.
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 11.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-alto-3

- Grafo sembrado: 34 fichas. Contexto: 14 fichas, 24 relaciones, 8027 caracteres. Prompt de impacto: 8027 caracteres.
- Scout: falló: Gemini 404: {
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/get-started).",
    "status": "NOT_FOUND"
  }
}
.
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 11.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-alto-4

- Grafo sembrado: 34 fichas. Contexto: 14 fichas, 24 relaciones, 8027 caracteres. Prompt de impacto: 8027 caracteres.
- Scout: falló: Gemini 404: {
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/get-started).",
    "status": "NOT_FOUND"
  }
}
.
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 11.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: `Cambio 1: tipo de relación desconocido "rival".`.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-alto-5

- Grafo sembrado: 34 fichas. Contexto: 14 fichas, 24 relaciones, 8027 caracteres. Prompt de impacto: 8027 caracteres.
- Scout: falló: Gemini 404: {
  "error": {
    "code": 404,
    "message": "This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements. We recommend you to use the Interactions API (https://ai.google.dev/gemini-api/docs/get-started).",
    "status": "NOT_FOUND"
  }
}
.
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 13.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-bajo-1

- Grafo sembrado: 6 fichas. Contexto: 4 fichas, 5 relaciones, 2427 caracteres. Prompt de impacto: 2427 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-bajo-2

- Grafo sembrado: 6 fichas. Contexto: 4 fichas, 5 relaciones, 2427 caracteres. Prompt de impacto: 2427 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 1.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-bajo-3

- Grafo sembrado: 6 fichas. Contexto: 4 fichas, 5 relaciones, 2427 caracteres. Prompt de impacto: 2427 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-bajo-4

- Grafo sembrado: 6 fichas. Contexto: 4 fichas, 5 relaciones, 2427 caracteres. Prompt de impacto: 2427 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-bajo-5

- Grafo sembrado: 6 fichas. Contexto: 4 fichas, 5 relaciones, 2427 caracteres. Prompt de impacto: 2427 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-medio-1

- Grafo sembrado: 24 fichas. Contexto: 10 fichas, 14 relaciones, 4422 caracteres. Prompt de impacto: 4422 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 4.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-medio-2

- Grafo sembrado: 24 fichas. Contexto: 10 fichas, 14 relaciones, 4422 caracteres. Prompt de impacto: 4422 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 4.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-medio-3

- Grafo sembrado: 24 fichas. Contexto: 10 fichas, 14 relaciones, 4422 caracteres. Prompt de impacto: 4422 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 4.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-medio-4

- Grafo sembrado: 24 fichas. Contexto: 10 fichas, 14 relaciones, 4422 caracteres. Prompt de impacto: 4422 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 6.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### cascade-medio-5

- Grafo sembrado: 24 fichas. Contexto: 10 fichas, 14 relaciones, 4422 caracteres. Prompt de impacto: 4422 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-2.5-flash.
- Propuestas válidas (cambios que el validador acepta): 4.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### impact-medio-1

- Grafo sembrado: 24 fichas. Contexto: 17 fichas, 27 relaciones, 4523 caracteres. Prompt de impacto: 4523 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-3.8-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### impact-medio-2

- Grafo sembrado: 24 fichas. Contexto: 17 fichas, 27 relaciones, 4523 caracteres. Prompt de impacto: 4523 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-3.8-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### impact-medio-3

- Grafo sembrado: 24 fichas. Contexto: 17 fichas, 27 relaciones, 4523 caracteres. Prompt de impacto: 4523 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-3.8-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### impact-medio-4

- Grafo sembrado: 24 fichas. Contexto: 17 fichas, 27 relaciones, 4523 caracteres. Prompt de impacto: 4523 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-3.8-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.

### impact-medio-5

- Grafo sembrado: 24 fichas. Contexto: 17 fichas, 27 relaciones, 4523 caracteres. Prompt de impacto: 4523 caracteres.
- Scout: no (impactos esperados bajo el umbral de 5).
- Parseo JSON: sí. finishReason: STOP. Modelo: gemini-3.8-flash.
- Propuestas válidas (cambios que el validador acepta): 3.
- Alucinaciones (entidad fuera del contexto): ninguna.
- Rechazos de regla: ninguno.
- missingImpacts tras el reintento, si lo hubo: ninguno.
