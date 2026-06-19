/**
 * wikiGraphTypes.js
 *
 * Color and display config per entityType and relationType for the wiki relation graph.
 * All colors are expressed as hex strings (for Pixi) and as CSS strings (for DOM overlays).
 */

// Node accent colors per entityType (hex, no alpha)
export const NODE_COLORS = {
    personaje:       0xff66ff,  // magenta — matches UI_COLORS.accent
    locacion:        0x00f2ea,  // cyan — anomaly
    organizacion:    0xffaa00,  // amber
    evento_historico:0x7777ff,  // blue-violet
    reliquia:        0xff6644,  // orange-red
    ideologia:       0xaa66ff,  // purple
    idioma:          0x66ddaa,  // teal
    especie:         0x88ff44,  // lime
    cronica:         0xaaaaaa,  // neutral grey
};

export const NODE_COLORS_CSS = {
    personaje:       "#ff66ff",
    locacion:        "#00f2ea",
    organizacion:    "#ffaa00",
    evento_historico:"#7777ff",
    reliquia:        "#ff6644",
    ideologia:       "#aa66ff",
    idioma:          "#66ddaa",
    especie:         "#88ff44",
    cronica:         "#aaaaaa",
};

// Edge colors per relationType
export const EDGE_COLORS = {
    aliado_de:              0x44ff88,
    enemigo_de:             0xff4444,
    miembro_de:             0xffaa00,
    miembro_confirmado_de:  0xffaa00,
    miembro_sospechado_de:  0xff8844,
    sede_en:                0x00f2ea,
    vive_en:                0x44ddff,
    perteneciente_a:        0x33bbcc,
    controla:               0xff66ff,
    relacionado_con:        0x6688aa,
    origen_de:              0x66ddaa,
    ocurrio_en:             0x7777ff,
    participo_en:           0x9999ff,
    desencadeno:            0xaa44ff,
    sucesor_de:             0xccaa66,
    descendiente_de:        0xbb9955,
    colinda_con:            0x22aacc,
    habita_en:              0x55cc66,
    profesa:                0xcc66ff,
    habla:                  0x44ccaa,
    venera:                 0xdd88ff,
    fundo:                  0xddaa44,
    custodia:               0xff8866,
    busca:                  0xff5588,
    es_buscado_en:          0xff4466,
    documenta:              0xbbbbbb,
    otro:                   0x888888,
};

// Unicode symbols used as fallback node label when no image is available
export const NODE_SYMBOLS = {
    personaje:       "◉",
    locacion:        "⬡",
    organizacion:    "⬟",
    evento_historico:"◆",
    reliquia:        "★",
    ideologia:       "☯",
    idioma:          "Λ",
    especie:         "⌬",
    cronica:         "☰",
};

export const NODE_RADIUS = 32;
export const NODE_RADIUS_SELECTED = 42;
export const EDGE_ALPHA = 0.55;
export const EDGE_ALPHA_DIMMED = 0.12;
export const NODE_ALPHA_DIMMED = 0.22;
