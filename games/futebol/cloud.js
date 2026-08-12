(() => {
  'use strict';

  const firebaseConfig = {
    apiKey: 'AIzaSyAYUsetTFCMr5kKx5fNeZ3GK2ZtyjqjhpM',
    authDomain: 'planas-games.firebaseapp.com',
    projectId: 'planas-games',
    storageBucket: 'planas-games.firebasestorage.app',
    messagingSenderId: '250288746158',
    appId: '1:250288746158:web:8e3ad40640159619a8c73f',
  };

  const KEYS = ['wsp_squad_v2', 'wsp_club_v1', 'wsp_season_v1'];
  const CODE_KEY = 'wsp_sync_code';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem caracteres ambíguos (0/O, 1/I)

  let app = null, auth = null, db = null, authReadyPromise = null;

  function ensureInit() {
    if (authReadyPromise) return authReadyPromise;
    if (!app) {
      app = firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();
    }
    authReadyPromise = new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) { unsubscribe(); resolve(user); }
      }, reject);
      auth.signInAnonymously().catch(reject);
    }).catch((err) => {
      authReadyPromise = null; // permite tentar de novo na próxima chamada, em vez de travar pra sempre
      throw err;
    });
    return authReadyPromise;
  }

  function randomCode() {
    let code = '';
    for (let i = 0; i < 8; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return code;
  }

  function getSyncCode() {
    return localStorage.getItem(CODE_KEY);
  }

  function getOrCreateSyncCode() {
    let code = localStorage.getItem(CODE_KEY);
    if (!code) {
      code = randomCode();
      localStorage.setItem(CODE_KEY, code);
    }
    return code;
  }

  async function saveToCloud() {
    await ensureInit();
    const code = getOrCreateSyncCode();
    const data = {};
    KEYS.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw != null) data[k] = raw;
    });
    await db.collection('saves').doc(code).set({
      data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return code;
  }

  async function loadFromCloud(code) {
    await ensureInit();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Código vazio.');
    const docSnap = await db.collection('saves').doc(cleanCode).get();
    if (!docSnap.exists) throw new Error('Código não encontrado na nuvem.');
    const stored = docSnap.data();
    if (!stored || !stored.data) throw new Error('Save vazio ou em formato inválido.');
    const foundKeys = Object.keys(stored.data).filter((k) => KEYS.includes(k));
    if (!foundKeys.length) throw new Error('Nenhum dado reconhecido nesse save.');
    foundKeys.forEach((k) => localStorage.setItem(k, stored.data[k]));
    localStorage.setItem(CODE_KEY, cleanCode);
    return foundKeys;
  }

  window.WSPCloud = { saveToCloud, loadFromCloud, getSyncCode, getOrCreateSyncCode };
})();
