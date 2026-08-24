/**
 * AoE pattern parser — mirrors mockup `parseAoe` / `AOE_META`
 * (`docs/mockups/kit-job-header/index.html`).
 */

export const AOE_TONE = {
    blast: { color: "#ff8a3d", border: "rgba(255,138,61,0.75)" },
    closeblast: { color: "#00f2ea", border: "rgba(0,242,234,0.75)" },
    aura: { color: "#ff66ff", border: "rgba(255,102,255,0.75)" },
    line: { color: "#7dd3fc", border: "rgba(125,211,252,0.7)" },
    arc: { color: "#a78bfa", border: "rgba(167,139,250,0.7)" },
    xpat: { color: "#f5c542", border: "rgba(245,197,66,0.75)" },
};

const AOE_META = {
    blast: { code: "B", name: "Blast" },
    closeblast: { code: "CB", name: "Close blast" },
    aura: { code: "A", name: "Aura" },
    line: { code: "L", name: "Line" },
    arc: { code: "R", name: "Arc" },
    xpat: { code: "X", name: "Cross" },
};

/**
 * @param {string|null|undefined} raw
 * @returns {{ key: string, code: string, size: string, name: string }|null}
 */
export function parseAoe(raw) {
    if (raw == null || raw === "") return null;
    const s = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
    const tail = (s.match(/(\d+(?:x\d+)?)\s*$/) || [])[1] || "1";
    const size = tail.includes("x") ? tail.split("x").pop() : tail;
    let key = "aura";
    if (s.startsWith("close") || s.startsWith("cb")) key = "closeblast";
    else if (s.startsWith("blast") || s === "b" || s.startsWith("b ")) key = "blast";
    else if (s.startsWith("aura") || s.startsWith("a ")) key = "aura";
    else if (s.startsWith("line") || s.startsWith("l ")) key = "line";
    else if (s.startsWith("arc") || s.startsWith("r ")) key = "arc";
    else if (s.startsWith("cross") || s.startsWith("xpat") || s.startsWith("x ")) key = "xpat";
    const meta = AOE_META[key] || AOE_META.aura;
    return { key, code: meta.code, size, name: meta.name };
}

/** Micro label on vchip — e.g. B1, CB1, L1×4 */
export function aoeVchipLabel(raw) {
    const parsed = parseAoe(raw);
    if (!parsed) return "—";
    if (parsed.key === "line" && String(raw).toLowerCase().includes("x")) {
        const m = String(raw).match(/(\d+)x(\d+)/i);
        if (m) return `${parsed.code}${m[1]}×${m[2]}`;
    }
    return `${parsed.code}${parsed.size}`;
}

export function aoeTone(raw) {
    const parsed = parseAoe(raw);
    if (!parsed) return { color: "#f5c542", border: "rgba(245,197,66,0.7)", key: null };
    const tone = AOE_TONE[parsed.key] || AOE_TONE.aura;
    return { ...tone, key: parsed.key };
}
