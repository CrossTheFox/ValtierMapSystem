/**
 * Resolve storage path for character spotlight (banner → token → portrait).
 * @param {{ bannerUrl?: string|null, tokenImageUrl?: string|null, imageUrl?: string|null }} char
 * @returns {string|null}
 */
export function resolveCharacterSpotlightPath(char) {
    if (!char) return null;
    return char.bannerUrl || char.tokenImageUrl || char.imageUrl || null;
}

/** @returns {boolean} */
export function characterHasSpotlightMedia(char) {
    return Boolean(resolveCharacterSpotlightPath(char));
}
