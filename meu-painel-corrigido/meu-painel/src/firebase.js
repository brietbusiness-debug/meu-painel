import { initializeApp }   from "firebase/app";
import { getFirestore }    from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            "AIzaSyDFNzsw7cyDR-02Qnn4Yjjvfcu-Wt4Dfp0",
  authDomain:        "meu-painel-b4441.firebaseapp.com",
  projectId:         "meu-painel-b4441",
  storageBucket:     "meu-painel-b4441.firebasestorage.app",
  messagingSenderId: "319614969506",
  appId:             "1:319614969506:web:66a1f8336a467084ccd9fb",
};

const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export async function loginComGoogle() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function checkRedirectResult() {
  return null; // não usa redirect
}

export async function loginComEmail(email, senha) {
  const result = await signInWithEmailAndPassword(auth, email, senha);
  return result.user;
}

export async function criarConta(nome, email, senha) {
  const result = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(result.user, { displayName: nome });
  return result.user;
}

export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
  window.location.reload();
}

export function onUsuario(callback) {
  return onAuthStateChanged(auth, callback);
}

let cachedUID = null;

export async function getUID() {
  if (cachedUID) return cachedUID;
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) { cachedUID = user.uid; resolve(user.uid); }
      else { reject(new Error("Não autenticado")); }
    });
  });
}

// Limpa o cache quando o token muda (logout)
auth.onIdTokenChanged((user) => { if (!user) cachedUID = null; });

export { db, auth };
