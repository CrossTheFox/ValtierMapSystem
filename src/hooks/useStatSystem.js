import { useState, useEffect } from "react";
import { getStatSystemForCampaign } from "../../firebase/services/statSystemService";
import { DEFAULT_STAT_SYSTEM, DEFAULT_RESOURCE_TRACKS } from "../constants/statSystem";

/**
 * @param {string|null|undefined} campaignId
 * @returns {{ stats: Array<{key: string, label: string, description?: string}>, systemName: string|null, resourceTracks: Array<{key: string, label: string, maxDefault: number}>, loading: boolean }}
 */
export function useStatSystem(campaignId) {
    const [loading, setLoading] = useState(!!campaignId);
    const [stats, setStats] = useState(DEFAULT_STAT_SYSTEM);
    const [systemName, setSystemName] = useState(null);
    const [resourceTracks, setResourceTracks] = useState(DEFAULT_RESOURCE_TRACKS);

    useEffect(() => {
        if (!campaignId) {
            setStats(DEFAULT_STAT_SYSTEM);
            setResourceTracks(DEFAULT_RESOURCE_TRACKS);
            setSystemName(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        getStatSystemForCampaign(campaignId)
            .then((doc) => {
                if (cancelled) return;
                if (doc?.stats?.length) {
                    setStats(doc.stats);
                } else {
                    setStats(DEFAULT_STAT_SYSTEM);
                }
                setSystemName(doc?.systemName ?? null);
                if (doc?.resourceTracks?.length) {
                    setResourceTracks(doc.resourceTracks);
                } else {
                    setResourceTracks(DEFAULT_RESOURCE_TRACKS);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStats(DEFAULT_STAT_SYSTEM);
                    setResourceTracks(DEFAULT_RESOURCE_TRACKS);
                    setSystemName(null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    return { stats, systemName, resourceTracks, loading };
}
