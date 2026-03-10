import { serverTimestamp } from "firebase/firestore";

export function createMap({
    campaignId,
    name,
    description,
    imageUrl,
    width,
    height,
    unit,
    metersPerPixel
}) {
    return {
        campaignId,
        name,
        description,
        imageUrl,
        width,
        height,
        unit,
        metersPerPixel,
        createdAt: serverTimestamp()
    };
}