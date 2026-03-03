import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDkwvo445GjREp6gMgF26rmwt_lB08TOAE",
    authDomain: "valtier-map-system.firebaseapp.com",
    projectId: "valtier-map-system",
    storageBucket: "valtier-map-system.firebasestorage.app",
    messagingSenderId: "405305963933",
    appId: "1:405305963933:web:a3d26b6dc8bfadb4386b74",
    measurementId: "G-PPSWHN469Y"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
