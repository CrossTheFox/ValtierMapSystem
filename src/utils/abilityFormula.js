/**
 * VIEW-only substitution for A+ `DamagePacket.formula` tokens (Slice 5 body).
 * No roll happens here — pure display string, mirrors the mockup's
 * `viewFormula`/`pktFormula` (`docs/mockups/kit-job-header/index.html:5830-5848`).
 *
 * `[mechanicResource]` reads the character's live class-resource value instead of the
 * mockup's hardcoded `"1"`. Kept separate from `src/utils/abilityRollCommands.js`'s
 * roll pipeline (`@{token}` + `[..]` roll brackets) so a later Slice 6 can build a
 * roll-ready formula the same way and hand it to `rollResolvedFormula` without any
 * duplication of roll logic here.
 */

/**
 * @param {string|null|undefined} raw
 * @param {{ damageDie?: number, fray?: number, mechanicResource?: number }} [ctx]
 * @returns {string} display string, or "—" when `raw` is blank
 */
export function substituteFormulaTokens(raw, ctx = {}) {
    if (raw == null || raw === "") return "—";
    const die = Math.max(2, Math.floor(Number(ctx.damageDie) || 6));
    const fray = Math.max(0, Math.floor(Number(ctx.fray) || 0));
    const mech = Math.max(0, Math.floor(Number(ctx.mechanicResource) || 0));

    let s = String(raw).replace(/\s+/g, "");
    s = s.replace(/(\d*)\[(?:damageDie|D)\]/gi, (_m, n) => `${n || ""}d${die}`);
    s = s.replace(/\[fray\]/gi, String(fray));
    s = s.replace(/\[mechanicResource\]/gi, String(mech));
    s = s.replace(/\[(\d*)d(\d+)\]/gi, (_m, n, sides) => `${n || ""}d${sides}`);
    return s;
}

/**
 * Read a `DamagePacket`'s raw formula string (A+ packets only ever carry `formula`).
 * @param {{ formula?: string }|null|undefined} packet
 * @returns {string|null}
 */
export function packetFormula(packet) {
    return packet && packet.formula != null ? String(packet.formula) : null;
}

/**
 * Convenience: substitute a packet's formula directly for VIEW display.
 * @param {{ formula?: string }|null|undefined} packet
 * @param {{ damageDie?: number, fray?: number, mechanicResource?: number }} [ctx]
 */
export function viewPacketFormula(packet, ctx = {}) {
    return substituteFormulaTokens(packetFormula(packet), ctx);
}
