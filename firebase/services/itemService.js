/**
 * Unique campaign items — vault or character briefcase.
 * Path: campaigns/{campaignId}/items/{itemId}
 */

import { db } from "../firebaseConfig";
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { emptyItem, maskToStore, normalizeItem } from "../../src/utils/campaignItems";
import { deleteStorageFile } from "./assetLoader";

const itemsCol = (campaignId) => collection(db, "campaigns", campaignId, "items");
const itemDoc = (campaignId, itemId) => doc(db, "campaigns", campaignId, "items", itemId);

function serializeItem(snap) {
    const data = snap.data() || {};
    const createdAt = data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ?? null;
    const updatedAt = data.updatedAt?.toDate?.()
        ? data.updatedAt.toDate().toISOString()
        : data.updatedAt ?? null;
    return normalizeItem({
        ...data,
        id: snap.id,
        createdAt,
        updatedAt,
    });
}

function persistable(item) {
    const n = normalizeItem(item);
    if (!n) return null;
    return {
        campaignId: n.campaignId,
        name: n.name,
        type: n.type,
        rarity: n.rarity,
        description: n.description,
        qty: n.qty,
        mask: maskToStore(n.mask),
        rot: n.rot,
        ownerType: n.ownerType,
        ownerCharacterId: n.ownerCharacterId,
        gx: n.gx,
        gy: n.gy,
        effect: n.effect,
        imageUrl: n.imageUrl,
        equipable: n.equipable,
        equipSlots: n.equipSlots,
        equippedSlot: n.equippedSlot,
    };
}

function listenItems(q, label, onData, onError) {
    return onSnapshot(
        q,
        (snap) => onData?.(snap.docs.map(serializeItem).filter(Boolean)),
        (err) => {
            console.warn(`[itemService] ${label}`, err?.code || err?.message || err);
            onData?.([]);
            onError?.(err);
        },
    );
}

export function subscribeCampaignItems(campaignId, onData, onError) {
    if (!campaignId) {
        onData?.([]);
        return () => {};
    }
    return listenItems(itemsCol(campaignId), "subscribeCampaignItems", onData, onError);
}

export function subscribeCharacterItems(campaignId, characterId, onData, onError) {
    if (!campaignId || !characterId) {
        onData?.([]);
        return () => {};
    }
    const q = query(itemsCol(campaignId), where("ownerCharacterId", "==", characterId));
    return listenItems(q, "subscribeCharacterItems", onData, onError);
}

export function subscribeVaultItems(campaignId, onData, onError) {
    if (!campaignId) {
        onData?.([]);
        return () => {};
    }
    const q = query(itemsCol(campaignId), where("ownerType", "==", "vault"));
    return listenItems(q, "subscribeVaultItems", onData, onError);
}

export async function createCampaignItem(campaignId, partial, uid) {
    if (!campaignId) throw new Error("createCampaignItem: missing campaignId");
    const item = emptyItem({
        ...partial,
        campaignId,
        createdBy: uid || null,
    });
    const payload = {
        ...persistable(item),
        campaignId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid || null,
    };
    await setDoc(itemDoc(campaignId, item.id), payload);
    return { ...item, campaignId, createdBy: uid || null };
}

export async function saveCampaignItem(campaignId, item, uid) {
    const n = normalizeItem(item);
    if (!campaignId || !n?.id) throw new Error("saveCampaignItem: invalid item");
    const payload = {
        ...persistable({ ...n, campaignId }),
        campaignId,
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
    };
    await setDoc(itemDoc(campaignId, n.id), payload, { merge: true });
    return { ...n, campaignId };
}

export async function updateCampaignItem(campaignId, itemId, data, uid) {
    if (!campaignId || !itemId) return null;
    const { id: _id, createdAt: _c, ...rest } = data || {};
    await updateDoc(itemDoc(campaignId, itemId), {
        ...rest,
        updatedAt: serverTimestamp(),
        updatedBy: uid || null,
    });
    return normalizeItem({ id: itemId, ...rest, campaignId });
}

export async function deleteCampaignItem(campaignId, itemId, imageUrl) {
    if (!campaignId || !itemId) return;
    if (imageUrl) {
        try {
            await deleteStorageFile(imageUrl);
        } catch (err) {
            console.warn("[itemService] delete item image", err?.code || err?.message || err);
        }
    }
    await deleteDoc(itemDoc(campaignId, itemId));
}
