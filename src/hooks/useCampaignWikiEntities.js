import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { ROLES } from "../constants/roles";

/**
 * Lightweight subscription to a campaign's wikiEntities, used by VTT surfaces
 * (character sheet, location cards) to resolve species/organization names and
 * narrative traits for chips.
 *
 * Players/guests must query with `visibility == "players"` — an unfiltered
 * collection listen fails with permission-denied when any `dm_only` doc exists,
 * which corrupts the Firestore client and blocks all subsequent writes
 * (including token placement).
 *
 * @param {string|null} campaignId
 * @returns {object[]} wiki entities
 */
export function useCampaignWikiEntities(campaignId) {
    const [entities, setEntities] = useState([]);
    const role = useSelector((s) => s.player.profile?.role);
    const isDm = role === ROLES.DM;

    useEffect(() => {
        if (!campaignId) {
            setEntities([]);
            return undefined;
        }
        const ref = collection(db, "campaigns", campaignId, "wikiEntities");
        // Until role resolves, use the player-safe query (never an unfiltered listen).
        const q = isDm
            ? ref
            : query(ref, where("visibility", "==", "players"));

        const unsub = onSnapshot(
            q,
            (snap) => {
                setEntities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            },
            (err) => {
                console.warn("[useCampaignWikiEntities]", err?.code || err?.message || err);
                setEntities([]);
            },
        );
        return () => unsub();
    }, [campaignId, isDm]);

    return entities;
}
