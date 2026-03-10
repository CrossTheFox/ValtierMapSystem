import { serverTimestamp } from "firebase/firestore";

export function createCampaign({
    name,
    description,
    ownerId
}) {
    return {
        name,
        description,
        ownerId,
        mapIds: [],
        playerIds: [],
        createdAt: serverTimestamp()
    };
}