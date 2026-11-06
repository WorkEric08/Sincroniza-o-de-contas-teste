import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZV68LSu_SJr59Mmd1mw1V2B4Voqmh4Uk",
  authDomain: "lista-de-tarefas-sincronizadas.firebaseapp.com",
  projectId: "lista-de-tarefas-sincronizadas",
  storageBucket: "lista-de-tarefas-sincronizadas.firebasestorage.app",
  messagingSenderId: "1089405162048",
  appId: "1:1089405162048:web:08911aa29e40793af385a5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Cache local = funciona offline e sincroniza quando a internet volta
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

const $ = (id) => document.getElementById(id);
let pararDeEscutar = null;

// No app nativo o login do Google é feito pelo SDK nativo do Firebase
// (o popup web é bloqueado pelo Google dentro de WebViews). O token
// nativo é usado para também autenticar o SDK web, que é quem o resto
// do app (Firestore) já conhece.
async function entrarComGoogle() {
  if (Capacitor.isNativePlatform()) {
    const resultado = await FirebaseAuthentication.signInWithGoogle();
    const idToken = resultado.credential?.idToken;
    if (!idToken) throw new Error("Login nativo não retornou idToken.");
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  } else {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }
}

async function sair() {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut();
  }
  await signOut(auth);
}

$("btnLogin").onclick = () => entrarComGoogle();
$("btnSair").onclick = () => sair();

onAuthStateChanged(auth, (user) => {
  if (pararDeEscutar) {
    pararDeEscutar();
    pararDeEscutar = null;
  }

  $("telaLogin").classList.toggle("oculto", !!user);
  $("telaApp").classList.toggle("oculto", !user);
  if (!user) return;

  $("status").textContent = "Conectado como " + user.email;

  // Cada usuário só mexe na própria pasta: users/{uid}/tarefas
  const tarefas = collection(db, "users", user.uid, "tarefas");

  pararDeEscutar = onSnapshot(query(tarefas, orderBy("criadaEm")), (snap) => {
    $("lista").innerHTML = "";
    snap.forEach((d) => {
      const t = d.data();
      const li = document.createElement("li");
      li.className = t.feita ? "feita" : "";
      li.innerHTML = `<input type="checkbox" ${t.feita ? "checked" : ""}>
                      <span></span><button class="del">X</button>`;
      li.querySelector("span").textContent = t.texto;
      li.querySelector("input").onchange = (e) =>
        updateDoc(doc(tarefas, d.id), { feita: e.target.checked });
      li.querySelector(".del").onclick = () => deleteDoc(doc(tarefas, d.id));
      $("lista").appendChild(li);
    });
  });

  $("form").onsubmit = async (e) => {
    e.preventDefault();
    const texto = $("texto").value.trim();
    if (!texto) return;
    $("texto").value = "";
    await addDoc(tarefas, { texto, feita: false, criadaEm: serverTimestamp() });
  };
});
