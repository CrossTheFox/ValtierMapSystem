import { auth } from "./firebase/firebaseConfig";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword  } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase/firebaseConfig";

export async function registerPlayer(nickname, password) {

    const fakeEmail = `${nickname}@valtia.local`;

    const userCredential = await createUserWithEmailAndPassword(
        auth,
        fakeEmail,
        password
    );

    const user = userCredential.user;

    await setDoc(doc(db, "players", user.uid), {
        nickname: nickname,
        bio: "",
        imageUrl: "",
        relations: {},
        createdAt: new Date()
    });

    return user;
}

export async function loginPlayer(nickname, password) {

    const fakeEmail = `${nickname}@valtia.local`;

    return await signInWithEmailAndPassword(
        auth,
        fakeEmail,
        password
    );
}
