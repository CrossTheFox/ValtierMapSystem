/**
 * Per-campaign narrative defaults (fecha presente, calendario).
 * Fuente de verdad provisional hasta campo en Firestore `campaigns/{id}`.
 *
 * Valtia-01: docs/Valtia - 01/Valtia_Resumen_General.md → 7036-02-12 D.Z.
 */
export const TIMELINE_CALENDAR_DZ = "dz";

/** @type {Record<string, { narrativeDate: string, calendar: string, label?: string }>} */
export const CAMPAIGN_NARRATIVE_DEFAULTS = {
    RfY23gcG7No5HcGddo1j: {
        narrativeDate: "7036-02-12",
        calendar: TIMELINE_CALENDAR_DZ,
        label: "Valtia-01",
    },
};

/**
 * Resuelve fecha presente: Firestore (Redux) → defaults por campaña.
 * @param {string|null|undefined} campaignId
 * @param {{ narrativeDate?: string|null, narrativeCalendar?: string|null }|null} [fromStore]
 * @returns {{ narrativeDate: string, calendar: string }|null}
 */
export function resolveCampaignNarrativeDate(campaignId, fromStore = null) {
    const storedDate = fromStore?.narrativeDate?.trim();
    if (storedDate) {
        return {
            narrativeDate: storedDate,
            calendar: fromStore.narrativeCalendar || TIMELINE_CALENDAR_DZ,
        };
    }
    if (!campaignId) return null;
    const fallback = CAMPAIGN_NARRATIVE_DEFAULTS[campaignId];
    if (!fallback) return null;
    return {
        narrativeDate: fallback.narrativeDate,
        calendar: fallback.calendar || TIMELINE_CALENDAR_DZ,
    };
}

/** @deprecated Usar resolveCampaignNarrativeDate */
export function getCampaignNarrativeDate(campaignId) {
    return resolveCampaignNarrativeDate(campaignId, null);
}
