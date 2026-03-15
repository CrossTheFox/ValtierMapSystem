import { auth, db, secondaryAuth } from "./firebaseConfig";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut  } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export async function registerPlayer(nickname, password, role = "player", currentCampaignId) {
    const fakeEmail = `${nickname.toLowerCase().replace(/\s+/g, '')}@valtia.com`;

    try {
        // 1. Creamos el usuario en la instancia secundaria
        const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            fakeEmail,
            password
        );

        const user = userCredential.user;

        // 2. Guardamos en Firestore usando la instancia de DB 
        // (Firestore no se ve afectado por el cambio de Auth)
        await setDoc(doc(db, "players", user.uid), {
            uid: user.uid,
            nickname: nickname,
            role: role,
            campaignIds: currentCampaignId ? [currentCampaignId] : [],
            bio: "",
            imageUrl: "",
            relations: {},
            createdAt: new Date()
        });

        // 3. LOGOUT INMEDIATO de la instancia secundaria
        // Esto asegura que el token del nuevo usuario se destruya antes de que el
        // observador de la app principal se de cuenta.
        await signOut(secondaryAuth);

        return user;
    } catch (error) {
        console.error("Critical Registration Error:", error);
        throw error;
    }
}

export async function loginPlayer(nickname, password) {

    const fakeEmail = `${nickname.toLowerCase().replace(/\s+/g, '')}@valtia.com`;

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
