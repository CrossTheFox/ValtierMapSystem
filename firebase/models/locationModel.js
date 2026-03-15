import { serverTimestamp } from "firebase/firestore";

export function createLocation({
    mapId,
    name,
    description,
    history,
    x,
    y,
    imageUrl
}) {
    return {
        mapId,
        name,
        description,
        history,
        position: { x, y },
        imageUrl,
        createdAt: serverTimestamp()
    };
}