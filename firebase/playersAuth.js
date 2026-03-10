import { auth } from "./firebaseConfig";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut  } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function registerPlayer(nickname, password) {

    const fakeEmail = `${nickname}@valtia.com`;

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

    const fakeEmail = `${nickname}@valtia.com`;

    return await signInWithEmailAndPassword(
        auth,
        fakeEmail,
        password
    );
}

export async function logoutPlayer() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        throw error;
    }
}
