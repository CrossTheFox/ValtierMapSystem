import { MAX_SWARM } from "./timing";

const DICE_TYPE = "dice";

function messageTimeMs(msg) {
    const t = msg?.createdAt;
    // A pending serverTimestamp means the message was just sent locally: treating it
    // as time 0 made the newest roll sort as the oldest one.
    if (!t) return Date.now();
    if (typeof t.toMillis === "function") return t.toMillis();
    if (typeof t.seconds === "number") return t.seconds * 1000;
    return Date.now();
}

/** Infer die sides from formulas like "2d6", "d20", "Sneak 3 → 3d6 (máx)". */
export function inferSidesFromFormula(formula) {
    const s = String(formula || "").toLowerCase();
    const matches = [...s.matchAll(/(\d*)d(\d+)/g)];
    if (!matches.length) return null;
    // prefer last NdM in string (Actions: "Sneak 3 → 3d6")
    const last = matches[matches.length - 1];
    return Math.max(2, parseInt(last[2], 10) || 20);
}

/**
 * Classify a chat dice message into a reveal payload.
 * @returns {null | object}
 */
export function classifyDiceMessage(msg) {
    if (!msg || msg.type !== DICE_TYPE) return null;
    const dr = msg.diceResult || {};
    const rolls = Array.isArray(dr.rolls) ? dr.rolls.map((n) => Math.floor(Number(n) || 1)) : [];
    if (!rolls.length && dr.total == null) return null;

    const rawSides = Number(dr.sides);
    const sides =
        (Number.isFinite(rawSides) && rawSides >= 2
            ? Math.floor(rawSides)
            : null) ||
        inferSidesFromFormula(msg.diceFormula || dr.formula) ||
        20;
    const diceCount = Math.max(
        1,
        Math.floor(Number(dr.diceCount) || 0) || rolls.length || 1,
    );
    const rollerName = msg.characterName || msg.senderName || "???";
    const senderId = msg.senderId ?? null;
    const total = dr.total != null ? Number(dr.total) : null;
    const mod = Number(dr.mod) || 0;
    const createdAtMs = messageTimeMs(msg);

    const effectiveCount = rolls.length || diceCount;

    if (effectiveCount <= 1) {
        const result = rolls[0] ?? (total != null ? Math.floor(total - mod) : 1);
        return {
            kind: "unified",
            messageId: msg.id,
            sides,
            result: Math.min(sides, Math.max(1, result)),
            total: total ?? result + mod,
            mod,
            rollerName,
            senderId,
            rolls: rolls.length ? rolls : [result],
            createdAtMs,
            formula: msg.diceFormula || dr.formula || `1d${sides}`,
            statMode: dr.mode || null,
        };
    }

    const dice = rolls.slice(0, MAX_SWARM).map((value) => ({
        sides,
        value: Math.min(sides, Math.max(1, value)),
        label: `d${sides}`,
    }));

    return {
        kind: "swarm",
        messageId: msg.id,
        sides,
        dice,
        rolls: rolls.slice(0, MAX_SWARM),
        total: total != null ? total : dice.reduce((a, d) => a + d.value, 0) + mod,
        mod,
        rollerName,
        senderId,
        createdAtMs,
        formula: msg.diceFormula || dr.formula || `${dice.length}d${sides}`,
        statMode: dr.mode || null,
    };
}

export function unifiedToRoller(payload) {
    return {
        name: payload.rollerName,
        senderId: payload.senderId,
        sides: payload.sides,
        result: payload.result,
    };
}

export { messageTimeMs };
