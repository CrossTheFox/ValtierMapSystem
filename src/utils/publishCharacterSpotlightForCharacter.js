import { publishCharacterSpotlight } from "../../firebase/services/gameService";
import { characterHasSpotlightMedia } from "./resolveCharacterSpotlightMedia";
import { isDmRole } from "./tokenControl";

/**
 * DM-only: broadcast character banner spotlight to all connected clients.
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function publishCharacterSpotlightForCharacter(char, campaignId, profile) {
    if (!isDmRole(profile?.role)) {
        return { ok: false, message: "Solo el DM puede mostrar personajes a la mesa" };
    }
    if (!campaignId) {
        return { ok: false, message: "Sin campaña activa" };
    }
    if (!char?.id) {
        return { ok: false, message: "Personaje no válido" };
    }
    if (!characterHasSpotlightMedia(char)) {
        return { ok: false, message: "El personaje no tiene banner ni token" };
    }
    try {
        await publishCharacterSpotlight(campaignId, char, { publishedBy: profile?.uid ?? null });
        return { ok: true };
    } catch (err) {
        console.error("[publishCharacterSpotlightForCharacter]", err);
        return { ok: false, message: "No se pudo mostrar a la mesa" };
    }
}
