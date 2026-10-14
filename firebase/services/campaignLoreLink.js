import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getLore, updateLore } from "./loreService";

const VALTIA_ZERO_ONE = "RfY23gcG7No5HcGddo1j";

function linksOf(lore) {
    const raw = Array.isArray(lore?.linked_campaigns) ? lore.linked_campaigns : [];
    return raw.filter((row) => row && row.id).map((row) => ({
        id: String(row.id),
        name: row.name || "Mesa",
    }));
}

/** The Lore currently annexed to this campaign, or "". */
export async function campaignPrimaryLoreId(campaignId) {
    if (!campaignId) return "";
    const snap = await getDoc(doc(db, "campaigns", campaignId));
    return snap.exists() ? (snap.data().primary_lore_id || "") : "";
}

/**
 * The timeline of a campaign is the linked Lore. One primary lore per campaign.
 * Does not copy nodes and does not create sessions.
 * A campaign that already pointed at another Lore is dropped from that Lore.
 */
export async function linkCampaignToLore(campaignId, campaignName, loreId) {
    if (!campaignId || !loreId) throw new Error("Falta la mesa o el Lore.");
    if (campaignId === VALTIA_ZERO_ONE) throw new Error("Valtia Zero One no se enlaza en esta pasada.");
    const lore = await getLore(loreId);
    if (!lore) throw new Error("No encontramos ese Lore.");
    const previousId = await campaignPrimaryLoreId(campaignId);
    if (previousId && previousId !== loreId) {
        try {
            const previous = await getLore(previousId);
            if (previous) {
                await updateLore(previousId, {
                    linked_campaigns: linksOf(previous).filter((row) => row.id !== campaignId),
                });
            }
        } catch (err) {
            console.warn("No se pudo soltar el Lore anterior:", err);
        }
    }
    const next = linksOf(lore).filter((row) => row.id !== campaignId);
    next.push({ id: campaignId, name: campaignName || "Mesa" });
    await updateLore(loreId, { linked_campaigns: next });
    await updateDoc(doc(db, "campaigns", campaignId), {
        primary_lore_id: loreId,
        updatedAt: serverTimestamp(),
    });
}

export async function unlinkCampaignFromLore(campaignId, loreId) {
    if (!campaignId || !loreId) return;
    if (campaignId === VALTIA_ZERO_ONE) throw new Error("Valtia Zero One no se escribe en esta pasada.");
    const lore = await getLore(loreId);
    if (lore) {
        await updateLore(loreId, {
            linked_campaigns: linksOf(lore).filter((row) => row.id !== campaignId),
        });
    }
    await updateDoc(doc(db, "campaigns", campaignId), {
        primary_lore_id: "",
        updatedAt: serverTimestamp(),
    });
}
