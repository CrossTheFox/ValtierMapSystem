import { storage } from "../firebase/firebaseConfig";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

export async function testStorage() {
    try {
        const imageRef = ref(storage, "test-folder/test.txt");

        await uploadString(imageRef, "Hola Firebase");

        const url = await getDownloadURL(imageRef);

        console.log("🔥 Storage funcionando");
        console.log("URL:", url);

    } catch (error) {
        console.error("❌ Error Storage:", error);
    }
}
