/** Reuses the same browser tab when opened again from the map. */
export const ARCHIVE_TAB_TARGET = "narrative_archive";

/**
 * Opens the NARRATIVE_ARCHIVE in a new browser tab (not a detached popup window).
 *
 * @param {{ campaignId: string, entityId?: string, areaFilter?: string, mode?: string }} opts
 * @returns {Window | null}
 */
export function openArchiveTab({ campaignId, entityId, areaFilter, mode } = {}) {
    if (!campaignId) return null;

    const params = new URLSearchParams({ campaignId });
    if (entityId) params.set("entityId", entityId);
    if (areaFilter) params.set("areaFilter", areaFilter);
    if (mode) params.set("mode", mode);

    return window.open(`/archive?${params.toString()}`, ARCHIVE_TAB_TARGET);
}
