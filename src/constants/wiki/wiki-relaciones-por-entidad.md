# Relaciones wiki por tipo de entidad

*Referencia para DMs. Implementación: `src/constants/wikiRelationTypes.js` (`WIKI_RELATION_PAIR_MATRIX`).*

---

## 1. Principios de diseño (decisiones DM)

| Regla | Decisión |
|-------|----------|
| **Locaciones** | Solo **pasivas** — no inician alianzas, enemistades, búsquedas ni membresías. La autoridad que busca es una **organización** o **personaje**; el territorio solo recibe vínculos espaciales. |
| **Búsqueda** | `busca` = buscador (`personaje` \| `organizacion`) → objetivo (`personaje` \| `reliquia`). Inversa en UI: «Buscado por». |
| **Búsqueda territorial** | `es_buscado_en` = `personaje` → `locacion` («tiene orden de captura / se le busca en esta ciudad»). Inversa en locación: «Buscan aquí a». |
| **Ideología / Especie** | Pueden tener `aliado_de` / `enemigo_de` entre ellas (schismas, especies rivales). |
| **Idioma** | Sin relaciones sociales — solo `origen_de`, `relacionado_con`, `otro`. `habla` solo sale de **personaje**. |
| **Crónica** | Solo relación saliente: `documenta` → cualquier otra entidad. |
| **Evento** | Puede enlazar libremente a personajes, organizaciones, lugares y otros eventos. |

---

## 2. Tipos de relación (27)

### Sociales y de poder

| Clave | Etiqueta saliente | Etiqueta entrante | Afinidad |
|-------|-------------------|-------------------|----------|
| `aliado_de` | Aliado de | — | +7 |
| `enemigo_de` | Enemigo de | — | −8 |
| `controla` | Controla | Controlado por | +6 |

**Agentes permitidos:** `personaje`, `organizacion`, `ideologia`, `especie` (entre ellos según matriz).  
**Nunca:** `locacion`, `idioma`, `cronica`, `reliquia`, `evento` como origen social.

### Membresía (solo personaje → organización)

| Clave | Etiqueta |
|-------|----------|
| `miembro_confirmado_de` | Miembro confirmado de |
| `miembro_sospechado_de` | Se sospecha que es miembro de |
| `miembro_de` | Miembro de (genérico) |

### Espaciales y territoriales

| Clave | Saliente | Entrante | Dirección canónica |
|-------|----------|----------|-------------------|
| `vive_en` | Vive en | Residente | `personaje` → `locacion` |
| `perteneciente_a` | Perteneciente a | Sub-ubicación de | locación hija → padre |
| `colinda_con` | Colinda con | Colinda con | `locacion` ↔ `locacion` |
| `sede_en` | Sede en | Sede de | `organizacion` → `locacion` |
| `habita_en` | Habita en | Habitada por | `especie` → `locacion` |
| `es_buscado_en` | Es buscado en | Buscan aquí a | `personaje` → `locacion` |

### Temporales y causales

| Clave | Saliente | Entrante | Dirección canónica |
|-------|----------|----------|-------------------|
| `ocurrio_en` | Ocurrió en | Escenario de | `evento` → `locacion` |
| `participo_en` | Participó en | Participante en | `personaje` \| `organizacion` → `evento` |
| `desencadeno` | Desencadenó | Desencadenado por | actor → `evento` |

### Linaje y creación

| Clave | Origen → Destino |
|-------|------------------|
| `sucesor_de` | `personaje`→`personaje`, `organizacion`→`organizacion` |
| `descendiente_de` | `personaje`→`personaje`, `especie`→`especie` |
| `fundo` | `personaje` \| `organizacion` → `organizacion` \| `locacion` |
| `origen_de` | `reliquia` \| `especie` \| `evento` → `locacion` / otras |

### Cultura, objetos y fuentes

| Clave | Origen → Destino |
|-------|------------------|
| `profesa` | `personaje` \| `organizacion` → `ideologia` |
| `habla` | `personaje` → `idioma` |
| `venera` | `personaje` \| `organizacion` → `personaje` |
| `custodia` | `organizacion` \| `locacion` → `reliquia` |
| `busca` | `personaje` \| `organizacion` → `personaje` \| `reliquia` |
| `documenta` | `cronica` → * |
| `relacionado_con` | Vínculo narrativo sin tipo específico |
| `otro` | Cualquier par permitido + `label` libre |

---

## 3. Matriz por entidad origen

### Personaje →

| Destino | Tipos permitidos |
|---------|------------------|
| Personaje | aliado, enemigo, sucesor, descendiente, busca, venera, desencadenó, relacionado, otro |
| Locación | vive, **es buscado en**, controla, fundó, relacionado, otro |
| Organización | miembro (3 variantes), relacionado, otro |
| Evento | participó, desencadenó, relacionado, otro |
| Reliquia | busca, relacionado, otro |
| Ideología | profesa, enemigo, relacionado, otro |
| Idioma | habla, relacionado, otro |
| Especie | relacionado, otro |
| Crónica | otro |

### Organización →

| Destino | Tipos permitidos |
|---------|------------------|
| Personaje | busca, relacionado, otro |
| Locación | sede, controla, fundó, relacionado, otro |
| Organización | aliado, enemigo, controla, sucesor, fundó, relacionado, otro |
| Evento | participó, desencadenó, relacionado, otro |
| Reliquia | busca, custodia, relacionado, otro |
| Ideología | profesa, aliado, enemigo, relacionado, otro |
| Idioma / Especie | relacionado, otro |
| Crónica | *(ninguno)* |

### Locación → *(solo pasiva)*

| Destino | Tipos permitidos |
|---------|------------------|
| Locación | perteneciente, colinda, otro |
| Personaje | vive *(normaliza a personaje→locación)* |
| Organización | sede *(normaliza a org→locación)* |
| Reliquia | custodia, relacionado, otro |
| Ideología / Idioma / Especie | relacionado, otro |
| Evento / Crónica | *(ninguno — usar `ocurrió_en` desde el evento)* |

**Ejemplos descartados:** locación enemiga de personaje, locación miembro de organización, locación busca personaje.

### Evento histórico →

| Destino | Tipos permitidos |
|---------|------------------|
| Locación | ocurrió, relacionado, otro |
| Personaje / Organización | participó *(normaliza a actor→evento)*, relacionado, otro |
| Evento | desencadenó, relacionado, otro |
| Reliquia / Ideología | origen, relacionado, otro |
| Especie / Idioma / Crónica | relacionado, otro |

### Reliquia →

| Destino | Tipos permitidos |
|---------|------------------|
| Locación | origen, relacionado, otro |
| Personaje / Organización / Evento | relacionado, otro |
| Reliquia / Ideología / Idioma | relacionado, otro |
| Especie | origen, relacionado, otro |
| Crónica | otro |

### Ideología →

| Destino | Tipos permitidos |
|---------|------------------|
| Ideología | aliado, enemigo, relacionado, otro |
| Personaje / Organización / Locación / Evento / Reliquia / Especie / Idioma | relacionado, otro |
| Crónica | *(ninguno)* |

### Especie →

| Destino | Tipos permitidos |
|---------|------------------|
| Especie | aliado, enemigo, descendiente, relacionado, otro |
| Locación | habita, origen, relacionado, otro |
| Idioma / Ideología / Personaje / Organización / Evento / Reliquia | relacionado, otro |
| Crónica | *(ninguno)* |

### Idioma →

| Destino | Tipos permitidos |
|---------|------------------|
| Idioma | origen, relacionado, otro |
| Ideología / Especie / Locación / Organización / Evento / Reliquia | relacionado, otro |
| Personaje / Crónica | *(ninguno — `habla` es personaje→idioma)* |

### Crónica →

| Destino | Tipos permitidos |
|---------|------------------|
| Cualquier otra entidad | **documenta** |
| Crónica | *(ninguno)* |

---

## 4. Ejemplos narrativos

| Situación | Relación correcta |
|-----------|-------------------|
| La guardia de Valdheim busca al PJ Kael | `organizacion` (Guardia) → `busca` → `personaje` (Kael) |
| Kael tiene cartel en Valdheim y también en el puerto | `personaje` → `es_buscado_en` → cada `locacion` |
| La catedral guarda la reliquia | `locacion` → `custodia` → `reliquia` |
| Schisma entre dos cultos | `ideologia` ↔ `enemigo_de` ↔ `ideologia` |
| Elfos y orcos en guerra fría | `especie` ↔ `enemigo_de` ↔ `especie` |
| Crónica del Diluvio menciona la ciudad | `cronica` → `documenta` → `locacion` / `evento` |
| ~~Valdheim es enemiga de Kael~~ | ❌ Usar org que gobierna Valdheim → `busca` o `enemigo_de` → Kael |

---

## 5. API del código

```js
getAllowedRelationTypes(fromType, toType)      // tipos del par directo
getRelationTypeOptionsForContext(from, to)     // + pares bidireccionales UI
suggestRelationTypeForPair(from, to)           // default al elegir destino
resolveRelationEndpoints(from, to, type)       // dirección canónica en Firestore
getRelationDisplayLabel(type, isOutgoing)      // etiquetas entrante/saliente
isRelationValid(type, fromType, toType)        // validación
```

---

## 6. Conteo

| | Cantidad |
|--|----------|
| Tipos de relación | 27 |
| Pares entidad×entidad sin relación posible | ~15 (p. ej. cronica↔cronica, idioma→personaje) |
| Pares con al menos un tipo | ~56 de 72 direccionales |
