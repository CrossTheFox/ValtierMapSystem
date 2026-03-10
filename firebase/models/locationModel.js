import { serverTimestamp } from "firebase/firestore";

export function createLocation({
    mapId,
    name,
    description,
    history,
    x,
    y
}) {
    return {
        mapId,
        name,
        description,
        history,
        position: { x, y },
        createdAt: serverTimestamp()
    };
}