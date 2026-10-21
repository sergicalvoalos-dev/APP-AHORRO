// Conexión con Firebase: inicio de sesión con Google y guardado de los datos en Cloud Firestore.
// La configuración de Firebase no es secreta: está pensada para ir en el código de la web.
// Lo que protege tus datos son las reglas de seguridad de Firestore (ver firestore.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, onSnapshot, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCyAg7xeeDIXGvhrviY48ZakFN5wom9Pdk',
  authDomain: 'app-ahorro-6e50b.firebaseapp.com',
  projectId: 'app-ahorro-6e50b',
  storageBucket: 'app-ahorro-6e50b.firebasestorage.app',
  messagingSenderId: '610338685753',
  appId: '1:610338685753:web:58af86d4ac4f03f5879ee8'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Caché local: la app se abre y se puede consultar aunque no haya conexión.
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}

const $ = (s) => document.querySelector(s);
const APP = window.APP;

let unsub = null;
let ref = null;
let pending = null;
let timer = null;

function authError(e) {
  const c = (e && e.code) || '';
  if (c === 'auth/unauthorized-domain') return 'Este dominio no está autorizado en Firebase. Añádelo en Authentication → Configuración → Dominios autorizados.';
  if (c === 'auth/operation-not-allowed') return 'El inicio de sesión con Google no está activado en Firebase (Authentication → Método de inicio de sesión).';
  if (c === 'auth/network-request-failed') return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
  if (c === 'auth/popup-blocked') return 'El navegador ha bloqueado la ventana de inicio de sesión. Permite las ventanas emergentes para esta web.';
  return 'No se pudo iniciar sesión' + (c ? ' (' + c + ')' : '') + '.';
}

function dataError(e) {
  const c = (e && e.code) || '';
  if (c === 'permission-denied') return 'Firebase no deja leer tus datos. Comprueba que has pegado las reglas de seguridad en Firestore → Reglas.';
  if (c === 'not-found' || c === 'failed-precondition') return 'No se encuentra la base de datos. Comprueba que has creado Cloud Firestore en tu proyecto de Firebase.';
  return 'No se pudieron cargar tus datos' + (c ? ' (' + c + ')' : '') + '. Recarga la página para intentarlo de nuevo.';
}

function showLogin(msg, signedIn) {
  $('#loading').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-msg').textContent = msg || '';
  $('#btn-login').hidden = !!signedIn;
  $('#btn-login-out').hidden = !signedIn;
}

$('#btn-login').addEventListener('click', async () => {
  $('#login-msg').textContent = '';
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      try { await signInWithRedirect(auth, provider); } catch (e2) { $('#login-msg').textContent = authError(e2); }
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      $('#login-msg').textContent = authError(e);
    }
  }
});
const salir = async () => { await flush(); await signOut(auth); };
$('#btn-salir').addEventListener('click', salir);
$('#btn-login-out').addEventListener('click', salir);

getRedirectResult(auth).catch((e) => showLogin(authError(e)));

// Guarda el estado en Firestore. Se espera un momento para no escribir en cada tecla.
async function flush() {
  clearTimeout(timer);
  if (!pending || !ref) return;
  const json = pending;
  pending = null;
  try {
    APP.setStatus(navigator.onLine ? 'saving' : 'offline');
    await setDoc(ref, { estado: json, version: 1, actualizado: serverTimestamp() });
  } catch (e) {
    console.error(e);
    pending = pending || json;
    APP.setStatus('error');
  }
}

APP.onSave((json) => {
  pending = json;
  APP.setStatus('pend');
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
});

window.addEventListener('beforeunload', (e) => {
  if (pending) { flush(); e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

onAuthStateChanged(auth, (user) => {
  if (unsub) { unsub(); unsub = null; }
  if (!user) {
    ref = null;
    pending = null;
    APP.reset();
    showLogin('');
    return;
  }
  $('#login').hidden = true;
  $('#loading').hidden = false;
  $('#loading-msg').textContent = 'Cargando tus datos…';
  $('#btn-salir').title = 'Cerrar sesión (' + (user.email || '') + ')';
  ref = doc(db, 'usuarios', user.uid);
  let started = false;
  unsub = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    // La primera vez en un dispositivo, sin datos en caché: esperar a la respuesta del servidor
    // para no empezar con un panel vacío y sobrescribir lo que ya tienes guardado.
    if (!started && !snap.exists() && snap.metadata.fromCache) return;
    const data = snap.exists() ? snap.data().estado : null;
    if (!started) {
      started = true;
      APP.start(data, user.uid);
      $('#loading').hidden = true;
      $('#app').hidden = false;
    } else if (!snap.metadata.hasPendingWrites && data) {
      APP.update(data);
    }
    if (pending) return;
    APP.setStatus(snap.metadata.hasPendingWrites ? (navigator.onLine ? 'saving' : 'offline') : 'saved');
  }, (e) => {
    console.error(e);
    showLogin(dataError(e), true);
  });
});
