/**
 * Chat message `type` discriminant — pure constant (no Firestore imports) so
 * it can be shared by `firebase/services/chatService.js` (re-exports this)
 * and pure `src/utils/*` payload builders (e.g. `launchToChatPayload.js`)
 * that need to be unit-testable under plain `node --test` without pulling in
 * `firebase/firebaseConfig.js` (which relies on Vite's `import.meta.env`).
 */
export const CHAT_MESSAGE_TYPES = Object.freeze({
    TEXT: "text",
    DICE: "dice",
    ABILITY: "ability",
    ITEM: "item",
    SYSTEM: "system",
});
