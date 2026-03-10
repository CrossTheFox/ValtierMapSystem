import { serverTimestamp } from "firebase/firestore";

export function createPlayer({
    uid,
    nickname,
    role = "player"
}) {
    return {
        uid,
        nickname,
        role,
        campaignIds: [],
        createdAt: serverTimestamp()
    };
}