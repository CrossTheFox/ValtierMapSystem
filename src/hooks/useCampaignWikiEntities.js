import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { ROLES } from "../constants/roles";

/**
 * Lightweight subscription to a campaign's wikiEntities, used by VTT surfaces
 * (character sheet, location cards) to resolve species/organization names and
 * narrative traits for chips. Players only receive `players`-visibility fiches.
 *
 * @param {string|null} campaignId
 * @returns {object[]} wiki entities
 */
export function useCampaignWikiEntities(campaignId) {
    const [entities, setEntities] = useState([]);
    const role = useSelector((s) => s.player.profile?.role);

    useEffect(() => {
        if (!campaignId) {
            setEntities([]);
            return undefined;
        }
        const ref = collection(db, "campaigns", campaignId, "wikiEntities");
        const unsub = onSnapshot(ref, (snap) => {
            let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (role !== ROLES.DM) {
                list = list.filter((e) => e.visibility === "players");
            }
            setEntities(list);
        });
        return () => unsub();
    }, [campaignId, role]);

    return entities;
}
