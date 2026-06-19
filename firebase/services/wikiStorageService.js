import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { storage } from "../firebaseConfig";

/** Upload a wiki entity cover image. Returns { url, path }. */
export async function uploadWikiEntityImage(campaignId, entityId, file) {
    const ext = file.name.split(".").pop().toLowerCase() || "jpg";
    const path = `wiki-images/${campaignId}/entities/${entityId || "new"}/cover.${ext}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, path: snapshot.ref.fullPath };
}

/** Upload an inline image for use inside a Markdown body. Returns { url, path }. */
export async function uploadWikiInlineImage(campaignId, file) {
    const ext = file.name.split(".").pop().toLowerCase() || "jpg";
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 40);
    const path = `wiki-images/${campaignId}/inline/${ts}_${safeName}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, path: snapshot.ref.fullPath };
}

/** Delete a wiki image from Storage (best-effort; ignores not-found errors). */
export async function deleteWikiImage(storagePath) {
    if (!storagePath) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
    } catch (e) {
        // Ignore "object not found" — image may already be gone
        if (e.code !== "storage/object-not-found") console.warn("deleteWikiImage:", e);
    }
}

/** Delete several wiki images (deduped). */
export async function deleteWikiImages(storagePaths) {
    const unique = [...new Set(storagePaths.filter(Boolean))];
    await Promise.all(unique.map((p) => deleteWikiImage(p)));
}
