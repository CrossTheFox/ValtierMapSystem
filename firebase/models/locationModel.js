import { serverTimestamp } from "firebase/firestore";

export function createLocation({
    mapId,
    name,
    description,
    history,
    x,
    y,
    imageUrl,
    wikiEntityId = null,
}) {
    return {
        mapId,
        name,
        description: description || "",
        history: history || "",
        position: { x, y },
        imageUrl,
        /** Instance → wiki LOCACION (1 wiki : N pins). Canonical FK. */
        wikiEntityId: wikiEntityId || null,
        createdAt: serverTimestamp()
    };
}
