# Relaciones entre fichas del Codex

Fuente de código: `src/constants/wikiRelationTypes.js`. Esto no inventa verbos. Lista los que ya valida el Lab y la cascada de impacto, y marca las dudas abiertas.

El solar del Timeline usa otro grafo (`agrupa`, `sigue`, `paralelo`). Esos tres no entran aquí.

## Cómo se lee una arista

- Una sola arista por par de fichas. El enlace nuevo reemplaza al anterior.
- La dirección canónica la fija el verbo (`resolveRelationEndpoints`). Ejemplo: si eliges el lugar y después la persona con `vive_en`, se guarda persona → lugar.
- **Afinidad:** peso de −10 a +10. Mueve el Sync Meter. Extremos: personaje, lugar, organización, ideología.
- **Estructural:** peso 0. Hecho, no ánimo. Cualquier arista que toque idioma, acontecimiento, crónica, especie, reliquia o glosario queda estructural, aunque el verbo tenga un peso por defecto distinto de cero.
- Verbos siempre estructurales, aunque los extremos sean de afinidad: `habla`, `documenta`, `participo_en`, `ocurrio_en`, `colinda_con`, `perteneciente_a`, `origen_de`, `desencadeno`, `custodia`, `habita_en`.

En el tablero el color del trazo sale de esa clase: ámbar punteado si es estructural; verde si la fuerza es ≥ 3; rojo si es ≤ −3; amarillo si hay fuerza y no llega a esos umbrales; gris si la fuerza es 0 y el verbo no es estructural.

## Verbos

| Id | Etiqueta | Peso por defecto | Clase si los extremos son de afinidad |
|---|---|---|---|
| `aliado_de` | Aliado de | +7 | afinidad |
| `enemigo_de` | Enemigo de | −8 | afinidad |
| `miembro_confirmado_de` | Miembro confirmado de | +5 | afinidad |
| `miembro_de` | Miembro de | +5 | afinidad |
| `miembro_sospechado_de` | Se sospecha que es miembro de | +1 | afinidad |
| `controla` | Controla | +6 | afinidad |
| `profesa` | Profesa | +5 | afinidad |
| `venera` | Venera | +6 | afinidad |
| `busca` | Busca | +3 | afinidad; si el blanco es una reliquia, la arista queda estructural |
| `es_buscado_en` | Es buscado en | +2 | afinidad |
| `relacionado_con` | Relacionado con | 0 | afinidad en cero (trazo gris) |
| `otro` | Otro | 0 | afinidad en cero |
| `sucesor_de` | Sucesor de | 0 | afinidad en cero |
| `descendiente_de` | Descendiente de | 0 | afinidad en cero |
| `fundo` | Fundó | 0 | afinidad en cero |
| `vive_en` | Vive en | 0 | afinidad en cero |
| `sede_en` | Sede en | 0 | afinidad en cero |
| `habla` | Habla | 0 | siempre estructural |
| `documenta` | Documenta | 0 | siempre estructural |
| `participo_en` | Participó en | 0 | siempre estructural |
| `ocurrio_en` | Ocurrió en | 0 | siempre estructural |
| `colinda_con` | Colinda con | 0 | siempre estructural |
| `perteneciente_a` | Perteneciente a | 0 | siempre estructural |
| `origen_de` | Origen de | 0 | siempre estructural |
| `desencadeno` | Desencadenó | 0 | siempre estructural |
| `custodia` | Custodia | 0 | siempre estructural |
| `habita_en` | Habita en | 0 | siempre estructural |

## Quién puede unirse con quién

La flecha es el origen lógico → el destino. Si el par no está, no hay verbo.

### Personaje

| Hacia | Verbos |
|---|---|
| Personaje | aliado, enemigo, sucesor, descendiente, busca, venera, desencadenó, relacionado, otro |
| Lugar | vive en, es buscado en, controla, fundó, relacionado, otro |
| Organización | miembro confirmado, se sospecha miembro, miembro, relacionado, otro |
| Acontecimiento | participó, desencadenó, relacionado, otro |
| Reliquia | busca, relacionado, otro |
| Ideología | profesa, enemigo, relacionado, otro |
| Idioma | habla, relacionado, otro |
| Especie | relacionado, otro |
| Crónica | otro |

### Organización

| Hacia | Verbos |
|---|---|
| Personaje | busca, relacionado, otro |
| Lugar | sede en, controla, fundó, relacionado, otro |
| Organización | aliado, enemigo, controla, sucesor, fundó, relacionado, otro |
| Acontecimiento | participó, desencadenó, relacionado, otro |
| Reliquia | busca, custodia, relacionado, otro |
| Ideología | profesa, aliado, enemigo, relacionado, otro |
| Idioma, especie | relacionado, otro |
| Crónica | ninguno |

### Lugar

| Hacia | Verbos |
|---|---|
| Lugar | perteneciente a, colinda, aliado, enemigo, relacionado, otro |
| Personaje | vive en (se guarda al revés: persona → lugar) |
| Organización | sede en (se guarda organización → lugar) |
| Reliquia | custodia, relacionado, otro |
| Ideología, idioma, especie | relacionado, otro |
| Acontecimiento, crónica | ninguno |

### Acontecimiento

| Hacia | Verbos |
|---|---|
| Lugar | ocurrió en, relacionado, otro |
| Personaje, organización | participó (se guarda persona u organización → acontecimiento), relacionado, otro |
| Acontecimiento | desencadenó, relacionado, otro |
| Reliquia, ideología | origen de, relacionado, otro |
| Especie, idioma, crónica | relacionado, otro |

### Reliquia

| Hacia | Verbos |
|---|---|
| Lugar, especie | origen de, relacionado, otro |
| Personaje, organización, acontecimiento, reliquia, ideología, idioma | relacionado, otro |
| Crónica | otro |

### Ideología

| Hacia | Verbos |
|---|---|
| Ideología | aliado, enemigo, relacionado, otro |
| Personaje, organización, lugar, acontecimiento, reliquia, especie, idioma | relacionado, otro |
| Crónica | ninguno |

### Especie

| Hacia | Verbos |
|---|---|
| Especie | aliado, enemigo, descendiente, relacionado, otro |
| Lugar | habita en, origen de, relacionado, otro |
| Idioma, ideología, personaje, organización, acontecimiento, reliquia | relacionado, otro |
| Crónica | ninguno |

Toda arista que toca una especie queda estructural (peso 0), también `aliado_de` entre especies.

### Idioma

| Hacia | Verbos |
|---|---|
| Idioma | origen de, relacionado, otro |
| Ideología, especie, lugar, organización, acontecimiento, reliquia | relacionado, otro |
| Personaje, crónica | ninguno (`habla` nace en el personaje) |

### Crónica

Solo sale `documenta` hacia personaje, lugar, organización, acontecimiento, reliquia, ideología, idioma y especie. Crónica → crónica no existe.

### Glosario

No tiene pares. No entra al Lab ni a la cascada.

## Qué dibuja el Neural Lab y qué propaga la IA

Entran al tablero (se crean, se mueven y se enlazan): personaje, lugar, organización, ideología, especie, reliquia, acontecimiento, idioma.

No entran: crónica (solo `documenta`), glosario, y los nodos del solar (era, arco, neutro, misión, sesión).

La cascada de impacto recorre el grafo salvo el idioma: `filterGraphEntities` lo deja fuera, y la IA no propone `habla`. El agrupado del Lab lee membresía (`miembro_*`), residencia (`vive_en`), sede (`sede_en`) y lugar hijo (`perteneciente_a`). El resto de verbos se ve en el trazo y no arma un grupo.

## Dudas

No cambié la matriz. Estas son las que conviene cerrar antes de ampliar verbos:

1. Un personaje no puede `custodia` una reliquia. Solo organización y lugar. El personaje `busca`. Si la mesa necesita «la lleva consigo», hoy cae en `relacionado_con` u `otro`.
2. No hay «es de la especie». Personaje ↔ especie solo tiene `relacionado_con` y `otro`.
3. Conviven `miembro_de` y `miembro_confirmado_de`, los dos con peso +5. El sospechado es +1. Si `miembro_de` es el legado de `miembro_confirmado_de`, se puede dejar de ofrecer.
4. `vive_en` y `sede_en` pesan 0 y no están en los verbos siempre estructurales. En el tablero salen grises, no ámbar. `sucesor_de`, `descendiente_de` y `fundo` igual.
5. `busca` contra una reliquia se aplana a peso 0 porque la reliquia es extremo estructural. No mueve el Sync Meter.
6. `aliado_de` / `enemigo_de` entre especies también quedan en peso 0 por la misma regla.
7. Varios verbos solo aparecen si el enlace nace en el extremo canónico: `profesa` desde quien profesa, `ocurrio_en` desde el acontecimiento, `habita_en` desde la especie, `documenta` desde la crónica. El menú del Lab muestra la otra dirección como «Invertir». No se autocompleta el par al revés salvo `vive_en`, `sede_en`, `perteneciente_a`, `participo_en` y `busca`.
8. Un lugar no inicia `controla` hacia una organización. La organización controla el lugar. Un lugar sí puede ser aliado o enemigo de otro lugar.
9. Una organización no `habla` un idioma.
10. La crónica no está en el tablero neural. Su único verbo es `documenta`, y ese no entra en la cascada.
