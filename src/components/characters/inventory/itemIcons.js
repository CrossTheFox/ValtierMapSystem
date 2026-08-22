const CACHE = new Map();

/**
 * Type glyphs for briefcase cells. Filled silhouettes read at 12–16px;
 * stroke-only paths looked broken (especially the pistol).
 */
export function itemTypeSvg(type, stroke = "#ffffff") {
    const key = `${type}|${stroke}`;
    const hit = CACHE.get(key);
    if (hit) return hit;
    const svg = render(type, stroke);
    CACHE.set(key, svg);
    return svg;
}

function render(type, c) {
    if (type === "weapon") {
        return `<svg viewBox="0 0 24 24" fill="${c}" stroke="none"><path d="M2 11.2h11.4l2.15-5.4H22v2.35h-4.85L15.4 11.2H17v1.85h-6.35V19H7.05v-5.95H5.2v2.15H2V11.2zm12.55 0h2.35l.85 2.7h-2.05l-1.15-2.7z"/></svg>`;
    }
    if (type === "ammo") {
        return `<svg viewBox="0 0 24 24" fill="${c}" stroke="none"><path d="M8 3.2h8c1 0 1.8.8 1.8 1.8v14c0 1-.8 1.8-1.8 1.8H8c-1 0-1.8-.8-1.8-1.8v-14C6.2 4 7 3.2 8 3.2zm.9 4.3v1.7h6.2V7.5H8.9zm0 7.6v1.7h6.2v-1.7H8.9z"/></svg>`;
    }
    if (type === "consumable") {
        return `<svg viewBox="0 0 24 24" fill="${c}" stroke="none"><path d="M9.2 2.8h5.6v3.4H9.2V2.8zM7.6 7.4h8.8l1.3 13.8H6.3L7.6 7.4zm3.5 3.2v6.2h1.8v-6.2h-1.8zm-2.2 2.6h6.2v1.7H8.9v-1.7z"/></svg>`;
    }
    if (type === "key") {
        return `<svg viewBox="0 0 24 24" fill="${c}" stroke="none"><path d="M8.2 7.2a4.8 4.8 0 1 1 3.7 7.85H12v2.1h2.2v2.1h-4.4v-4.2h-.1A4.8 4.8 0 0 1 8.2 7.2zm0 3.1a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z"/></svg>`;
    }
    if (type === "relic") {
        return `<svg viewBox="0 0 24 24" fill="${c}" stroke="none"><path d="M12 2.4 14.9 8.4 21.6 9.4 16.8 14.1 18 21.2 12 18.1 6 21.2 7.2 14.1 2.4 9.4 9.1 8.4 12 2.4z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="${c}" stroke="none"><path d="M4.2 6.4h15.6v11.2H4.2V6.4z"/></svg>`;
}
