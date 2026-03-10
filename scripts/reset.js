import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
    fs.readFileSync("./valtier-map-system-firebase-admins.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = 'ZmK4TxrcQFfGkMVmuJoJ8IHG7Bb2'; // El UID de tu captura
const newPassword = 'Megamago5812352987';

admin.auth().updateUser(uid, {
  password: newPassword
})
  .then(() => {
    console.log('SUCCESS: Contraseña actualizada correctamente');
    process.exit();
  })
  .catch((error) => {
    console.error('ERROR:', error);
    process.exit(1);
  });