import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    query,
    orderBy,
    limitToLast,
    onSnapshot,
    serverTimestamp,
} from "firebase/firestore";

const messagesCol = (campaignId) => collection(db, "campaigns", campaignId, "messages");

export const CHAT_MESSAGE_TYPES = {
    TEXT: "text",
    DICE: "dice",
    ABILITY: "ability",
    SYSTEM: "system",
};

export async function sendChatMessage(campaignId, {
    type = CHAT_MESSAGE_TYPES.TEXT,
    text,
    senderId,
    senderName,
    characterId,
    characterName,
    characterAvatarUrl,
    isOOC = false,
    abilityId,
    abilityLabel,
    diceResult,
    diceFormula,
}) {
    await addDoc(messagesCol(campaignId), {
        type,
        text: text ?? "",
        senderId: senderId ?? null,
        senderName: senderName ?? "Anónimo",
        characterId: characterId ?? null,
        characterName: characterName ?? null,
        characterAvatarUrl: characterAvatarUrl ?? null,
        isOOC: Boolean(isOOC),
        abilityId: abilityId ?? null,
        abilityLabel: abilityLabel ?? null,
        diceResult: diceResult ?? null,
        diceFormula: diceFormula ?? null,
        createdAt: serverTimestamp(),
    });
}

/**
 * Live-subscribe to the most recent `max` messages, oldest → newest.
 * IMPORTANT: use `limitToLast` (not `limit`) with an ascending orderBy —
 * `limit` on an ascending query returns the OLDEST docs, which silently
 * freezes the chat once a campaign passes `max` total messages (new
 * messages/dice rolls never enter the window and never render).
 *
 * Objects are reused across snapshots for unchanged docs (identity is stable),
 * so `memo` on chat rows actually holds and one new message re-renders one row
 * instead of the whole log.
 */
export function subscribeToChatMessages(campaignId, callback, max = 200) {
    const q = query(messagesCol(campaignId), orderBy("createdAt", "asc"), limitToLast(max));
    const cache = new Map();
    return onSnapshot(q, (snap) => {
        for (const change of snap.docChanges()) {
            if (change.type === "removed") cache.delete(change.doc.id);
            else cache.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        }
        const messages = snap.docs.map((d) => {
            const cached = cache.get(d.id);
            if (cached) return cached;
            const fresh = { id: d.id, ...d.data() };
            cache.set(d.id, fresh);
            return fresh;
        });
        if (cache.size > messages.length) {
            const live = new Set(messages.map((m) => m.id));
            for (const id of cache.keys()) {
                if (!live.has(id)) cache.delete(id);
            }
        }
        callback(messages);
    });
}

/** Roll dice formula like "2d6+3" or "d20" */
export function rollDiceFormula(formula) {
    const trimmed = String(formula).trim().toLowerCase();
    const match = trimmed.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!match) return null;
    const count = parseInt(match[1] || "1", 10);
    const sides = parseInt(match[2], 10);
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const total = rolls.reduce((a, b) => a + b, 0) + mod;
    return {
        rolls,
        mod,
        total,
        formula: trimmed,
        sides,
        diceCount: rolls.length,
    };
}

function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

/**
 * ICON action die: roll N d6 and keep the highest.
 * Score 0 → roll 2d6 and keep the lowest.
 * @param {number} statValue
 * @param {string} [statLabel]
 */
export function rollIconActionDice(statValue, statLabel = "Stat") {
    const n = Math.max(0, Math.floor(Number(statValue) || 0));
    if (n <= 0) {
        const rolls = [rollD6(), rollD6()];
        const total = Math.min(rolls[0], rolls[1]);
        return {
            rolls,
            mod: 0,
            total,
            mode: "lowest",
            formula: `${statLabel} 0 → 2d6 (mín)`,
            diceCount: 2,
            sides: 6,
        };
    }
    const rolls = Array.from({ length: n }, () => rollD6());
    const total = Math.max(...rolls);
    return {
        rolls,
        mod: 0,
        total,
        mode: "highest",
        formula: `${statLabel} ${n} → ${n}d6 (máx)`,
        diceCount: n,
        sides: 6,
    };
}

/** Post an ICON skill/action roll into campaign chat. */
export async function rollStatInChat(campaignId, profile, character, statDef, statValue) {
    const label = statDef?.label || statDef?.key || "Stat";
    const diceResult = rollIconActionDice(statValue, label);
    await sendChatMessage(campaignId, {
        type: CHAT_MESSAGE_TYPES.DICE,
        text: `${character?.name || profile?.nickname || "Jugador"} tira ${label}`,
        senderId: profile?.uid,
        senderName: profile?.nickname ?? "Jugador",
        characterId: character?.id ?? null,
        characterName: character?.name ?? null,
        characterAvatarUrl: character?.tokenImageUrl || character?.imageUrl || null,
        diceResult,
        diceFormula: diceResult.formula,
        isOOC: false,
    });
    return diceResult;
}

/**
 * Post a freeform NdM[+/-mod] roll into campaign chat.
 * @param {string} formula e.g. "2d6", "1d20+3", "d100"
 */
export async function rollDiceInChat(campaignId, profile, character, formula) {
    const diceResult = rollDiceFormula(formula);
    if (!diceResult) {
        throw new Error(`Fórmula de dados inválida: ${formula}`);
    }
    const who = character?.name || profile?.nickname || "Jugador";
    await sendChatMessage(campaignId, {
        type: CHAT_MESSAGE_TYPES.DICE,
        text: `${who} tira ${diceResult.formula}`,
        senderId: profile?.uid,
        senderName: profile?.nickname ?? "Jugador",
        characterId: character?.id ?? null,
        characterName: character?.name ?? null,
        characterAvatarUrl: character?.tokenImageUrl || character?.imageUrl || null,
        diceResult,
        diceFormula: diceResult.formula,
        isOOC: false,
    });
    return diceResult;
}

/** Post a callable ability into campaign chat. */
export async function callAbilityInChat(campaignId, profile, ability) {
    await sendChatMessage(campaignId, {
        type: CHAT_MESSAGE_TYPES.ABILITY,
        text: ability.content ?? "",
        senderId: profile?.uid,
        senderName: profile?.nickname ?? "Jugador",
        characterId: ability.characterId ?? null,
        characterName: ability.characterName ?? null,
        abilityId: ability.id,
        abilityLabel: ability.label,
        isOOC: false,
    });
}
