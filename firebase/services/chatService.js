import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    query,
    orderBy,
    limit,
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

export function subscribeToChatMessages(campaignId, callback, max = 100) {
    const q = query(messagesCol(campaignId), orderBy("createdAt", "asc"), limit(max));
    return onSnapshot(q, (snap) => {
        const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
    return { rolls, mod, total, formula: trimmed };
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
