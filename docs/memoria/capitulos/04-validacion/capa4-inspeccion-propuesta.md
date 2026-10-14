# Capa 4 — inspección ratificada

Fecha del pase: 2026-10-14. Un pase, en Aldermar base, con la sesión de EnvyTheDm. Superficies: Codex, solar (pestaña TIMELINE), Diario, Lab. No se entró a la vista de jugador ni al mapa.

Ratificada por el autor el 2026-10-13. Revisó la tabla y la dejó pasar, severidades incluidas. El capítulo 4 cita estos números. No hubo severidad 4, así que no se corrigió interfaz.

Escala de Nielsen, 0 a 4. No apareció una severidad 4 sugerida. No se corrigió interfaz en esta pasada.

Entrar a `/archive` sin `campaignId` se queda en «Cargando archivo narrativo...»: no hay campaña que cargar y el estado del mundo no pasa de idle. El camino real es la biblioteca, y ese camino abre el Lore. Severidad sugerida 2, fuera de las cuatro superficies.

## Nielsen

| Heurística | Codex | Solar | Diario | Lab |
|---|---|---|---|---|
| H1 Visibilidad | 1. La ficha abierta, el conteo del índice y la fuerza del vínculo se leen. | 1. La pestaña activa queda en la URL (`areaFilter=timeline`). Fechas y «Sin fecha» están en el nodo y en el riel. | 1. La sesión abierta muestra «SIN MARCA» y por qué no está en el solar. | 2. «Elige una ficha» y Generar deshabilitado se entienden. En el centro del grafo las etiquetas de las aristas se montan y el verbo deja de leerse. |
| H2 Mundo real | 1. El dossier habla de miembro, residencia y odio. Las pestañas del Archive están en inglés en las cuatro superficies. | 1. Era, arco y acontecimiento, con fecha D.Z. | 1. Sesión, recap y acta. | 2. «Evento narrativo» es lenguaje de mesa. «LAB_IA», «Ondas» y los códigos LU/PE/OR piden el glosario del sistema. |
| H3 Control | 1. Se cambia de ficha, de área y se puede salir. No se pulsó Eliminar. | 1. Buscar, filtrar, volver a dibujar, calendario y replegar la línea. | 1. Filtro por arco y por participante, más sesión, editar y escribir. | 2. Sin ancla no se puede generar. Cancelar una generación en curso no se vio: no se generó. Deshacer un impacto ya escrito sigue sin existir; no se aplicó ninguno. |
| H4 Consistencia | 1. La misma barra de áreas y el mismo nombre del Lore. | 1. Igual. | 1. Igual. | 1. Igual. El grafo y el Codex muestran las mismas fichas con dos disposiciones. |
| H5 Prevención | 1. Buscar y filtrar antes de recorrer todo el índice. El aviso de borrador no se provocó. | 1. No se creó un enlace inválido. | 1. El vacío de la sesión dice qué le falta, en vez de fallar al guardar. | 1. Generar y Otra idea nacen deshabilitados hasta elegir ficha. |
| H6 Reconocimiento | 1. Índice, dossier y relaciones con nombre. | 2. La barra de herramientas es de iconos. El nombre accesible existe (Buscar, Filtrar, Volver a dibujar); en el lienzo no hay una frase que diga qué es cada trazo. | 1. Los filtros tienen etiqueta. | 2. La leyenda está cerrada. Con las etiquetas montadas, el nodo se reconoce y el verbo no. |
| H7 Flexibilidad | 1. Búsqueda, filtro por tipo y salto al Lab. | 1. Búsqueda, filtro, calendario y riel. | 1. Búsqueda y dos filtros. | 1. Modo, slider de ondas y «Más». No se abrió «Más». |
| H8 Estética | 1. Una ficha a la vez. El índice es largo y está agrupado. | 2. El lienzo respira. «Sin título» y nodos sin fecha añaden ruido. | 1. Poco en pantalla. La sesión se lee de un vistazo. | 3. En el centro del grafo de Aldermar las etiquetas se apilan. Los títulos de los nodos y el panel lateral siguen usables. No impide elegir una ficha. |
| H9 Errores | 1. No se provocó un error. | 1. Igual. | 1. Igual. | 1. No se provocó un error. El texto de bloqueo de una propuesta inválida está en la revisión del Lab y no se abrió en esta pasada. |
| H10 Ayuda | 2. El índice tiene una frase («Cada grupo se abre y se cierra por separado»). No hay otra ayuda. | 2. No hay una ayuda en el lienzo. | 2. La frase de «vive solo en el Diario» es la ayuda de ese vacío. | 1. Hay un botón «Ayuda de las ondas». El botón de la propuesta fija dice que no llama al modelo. |

Promedio: Codex 1,1; solar 1,4; Diario 1,1; Lab 1,6. H8 del Lab es el único 3. Nada en 4.

## Amershi et al. (2019), solo el Lab

Ocho guías. El autor dejó estas marcas. «A medias» es el resultado: el estado vacío no muestra la guía completa.

| Guía | Resultado |
|---|---|
| Qué puede hacer el sistema | A medias. Se ve «Evento narrativo», Generar y la propuesta fija. No se explica, antes de elegir ficha, que el resultado son cambios de vínculo y no un relato. |
| Qué tan seguro está | No en este estado. La confianza aparece con las tarjetas. No se generó. |
| Qué contexto muestra | A medias. El grafo está a la vista. El subgrafo que viajaría en el prompt no se muestra hasta elegir ancla. |
| Por qué lo propuso | No en este estado. Hace falta una tarjeta. |
| Corregir antes de escribir | A medias. El botón de la propuesta fija está. No se abrió, así que no se vio la edición de la fuerza. |
| Aceptar o rechazar por tarjeta | No visto en esta sesión. El componente de revisión lo tiene. Falta abrirlo para ratificarlo. |
| Consecuencias de aplicar | No visto. No se aplicó nada. |
| Abortar la generación | No visto. Generar estaba deshabilitado. En el código, durante una generación hay Cancelar. |

El autor dio por buena esta tabla, incluidas las filas que el pase dejó a medias. El contador de la propuesta fija sigue siendo el de la compuerta: 3 pendientes y 2 bloqueados.
