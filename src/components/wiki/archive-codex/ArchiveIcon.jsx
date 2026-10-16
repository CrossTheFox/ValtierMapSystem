/** SVG set of the Archive mock (`ICO`). Stroke comes from `.svg svg` in the codex skin. */
const PATHS = {
    all: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    personaje: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19.5c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" /></>,
    locacion: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></>,
    organizacion: <><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-6h6v6" /></>,
    especie: <><path d="M12 21c0-6 6-8 8-14-6 1-8 6-8 14z" /><path d="M12 21c0-5-5-7-8-12 5 1 8 5 8 12z" /></>,
    reliquia: <path d="M12 3l2.2 6.2L21 12l-6.8 2.8L12 21l-2.2-6.2L3 12l6.8-2.8z" />,
    ideologia: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
    idioma: <><path d="M4 6h10M9 6c0 8-4 10-6 12M8 10c1.5 2 4 3.5 7 4" /><path d="M14 14l2 6 2-1.2M18 14l4 5" /></>,
    evento_historico: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>,
    neutro: <><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></>,
    era: <path d="M7 3h10M8 3v4l4 4 4-4V3M8 21v-4l4-4 4 4v4M7 21h10" />,
    arco: <><path d="M4 16c4-8 12-8 16 0" /><path d="M8 16c2.2-3.2 5.8-3.2 8 0" /></>,
    mision: <path d="M12 3l2 6h6l-5 4 2 6-5-3-5 3 2-6-5-4h6z" />,
    cronica: <><path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4z" /><path d="M6 4a2 2 0 0 0-2 2v14" /></>,
    glosario: <><path d="M5 5h9l5 5v9a2 2 0 0 1-2 2H5z" /><path d="M14 5v5h5M8 13h8M8 17h5" /></>,
    pencil: <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13 6l4 4" /></>,
    eyeOff: <><path d="M3 3l18 18" /><path d="M10.5 6.2A9 9 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.7-1.2 1.8-2.3 2.9M6.1 6.7C4.2 8.1 2.8 10 2.5 12c1 1.8 4.5 6 9.5 6 1.2 0 2.3-.2 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
    eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />,
    link: <><path d="M10 14l4-4" /><path d="M8 16l-1.5 1.5a4 4 0 0 1-5.6-5.6L6 7" /><path d="M16 8l1.5-1.5a4 4 0 0 1 5.6 5.6L18 17" /></>,
    chevL: <path d="M14 6l-6 6 6 6" />,
    chevR: <path d="M10 6l6 6-6 6" />,
    chevD: <path d="M6 10l6 6 6-6" />,
};

export default function ArchiveIcon({ name }) {
    return (
        <span className="svg" aria-hidden="true">
            <svg viewBox="0 0 24 24">{PATHS[name] || null}</svg>
        </span>
    );
}
