/**
 * CORE chip option lists — mirrors the mockup's `COST_SEL`/`RANGE_SEL`/`AOE_SEL`
 * (`docs/mockups/kit-job-header/index.html:5727-5739`). Cost/range/AoE/RES are
 * always cyber-sel (never native `<select>`, never cycle-on-click).
 */

export const COST_SEL = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "free", label: "F" },
    { value: "interrupt", label: "I" },
    { value: "superheavy", label: "SH" },
];

export const RANGE_SEL = [
    { value: "", label: "—" },
    ...["1", "2", "3", "4", "5", "6"].map((n) => ({ value: n, label: `R${n}` })),
];

export const AOE_SEL = [
    { value: "", label: "—" },
    { value: "blast 1", label: "B1" },
    { value: "blast 2", label: "B2" },
    { value: "closeblast 1", label: "CB1" },
    { value: "aura 1", label: "A1" },
    { value: "aura 2", label: "A2" },
    { value: "line 1x4", label: "L1×4" },
    { value: "arc 3", label: "R3" },
    { value: "xpat 1", label: "X1" },
];

export const RES_SEL = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `RES ${n}` }));

export function costChipLabel(actionCost) {
    if (actionCost == null || actionCost === "") return "1";
    const found = COST_SEL.find((o) => o.value === String(actionCost));
    return found ? found.label : String(actionCost);
}

export function rangeChipLabel(range) {
    if (!range) return "—";
    const found = RANGE_SEL.find((o) => o.value === String(range));
    return found ? found.label : `R${range}`;
}

export function aoeChipLabel(aoe) {
    if (!aoe) return "—";
    const found = AOE_SEL.find((o) => o.value === String(aoe));
    return found ? found.label : String(aoe);
}
