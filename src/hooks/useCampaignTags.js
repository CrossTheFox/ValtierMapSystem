import { useEffect, useState } from "react";
import { subscribeTagsForCampaign } from "../../firebase/services/tagService";
import { DEFAULT_RULE_SYSTEM, normalizeRulesSystem } from "../constants/ruleSystems";

/**
 * Live-merged ICON (or campaign.rulesSystem) tags: core + campaign custom.
 * @param {string|null|undefined} campaignId
 * @param {string} [rulesSystem]
 */
export function useCampaignTags(campaignId, rulesSystem = DEFAULT_RULE_SYSTEM) {
    const system = normalizeRulesSystem(rulesSystem);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsub = subscribeTagsForCampaign(
            campaignId || null,
            (list) => {
                setTags(list);
                setLoading(false);
            },
            system,
        );
        return () => unsub();
    }, [campaignId, system]);

    return { tags, loading };
}
