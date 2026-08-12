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
  const PENDING_EMAIL_KEY = 'wsp_pending_email';

  let app = null, auth = null, db = null;

  function ensureApp() {
    if (!app) {
      app = firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();
    }
  }

  function actionCodeSettings() {
    return {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true,
    };
  }

  async function sendLoginLink(email) {
    ensureApp();
    await auth.sendSignInLinkToEmail(email, actionCodeSettings());
    localStorage.setItem(PENDING_EMAIL_KEY, email);
  }

  function isLoginLink() {
    ensureApp();
    return auth.isSignInWithEmailLink(window.location.href);
  }

  async function completeLoginFromLink(fallbackEmail) {
    ensureApp();
    const email = localStorage.getItem(PENDING_EMAIL_KEY) || fallbackEmail;
    if (!email) { const err = new Error('email-needed'); err.code = 'email-needed'; throw err; }
    const result = await auth.signInWithEmailLink(email, window.location.href);
    localStorage.removeItem(PENDING_EMAIL_KEY);
    window.history.replaceState({}, document.title, window.location.pathname);
    return result.user;
  }

  function onAuthChange(cb) {
    ensureApp();
    return auth.onAuthStateChanged(cb);
  }

  function currentUser() {
    ensureApp();
    return auth.currentUser;
  }

  function signOut() {
    ensureApp();
    return auth.signOut();
  }

  function requireUser() {
    const user = auth.currentUser;
    if (!user) throw new Error('Você precisa estar conectado com seu e-mail primeiro.');
    return user;
  }

  async function saveToCloud() {
    ensureApp();
    const user = requireUser();
    const data = {};
    KEYS.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw != null) data[k] = raw;
    });
    await db.collection('saves').doc(user.uid).set({
      data,
      email: user.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function loadFromCloud() {
    ensureApp();
    const user = requireUser();
    const docSnap = await db.collection('saves').doc(user.uid).get();
    if (!docSnap.exists) throw new Error('Nenhum save salvo na nuvem para esse e-mail ainda.');
    const stored = docSnap.data();
    if (!stored || !stored.data) throw new Error('Save vazio ou em formato inválido.');
    const foundKeys = Object.keys(stored.data).filter((k) => KEYS.includes(k));
    if (!foundKeys.length) throw new Error('Nenhum dado reconhecido nesse save.');
    foundKeys.forEach((k) => localStorage.setItem(k, stored.data[k]));
    return foundKeys;
  }

  async function hasCloudSave() {
    ensureApp();
    const user = auth.currentUser;
    if (!user) return false;
    const docSnap = await db.collection('saves').doc(user.uid).get();
    return docSnap.exists;
  }

  window.WSPCloud = {
    sendLoginLink, isLoginLink, completeLoginFromLink, onAuthChange, currentUser, signOut,
    saveToCloud, loadFromCloud, hasCloudSave,
  };
})();
