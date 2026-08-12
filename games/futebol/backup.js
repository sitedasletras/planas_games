(() => {
  'use strict';

  const KEYS = ['wsp_squad_v2', 'wsp_club_v1', 'wsp_season_v1'];

  function buildExportPayload() {
    const data = {};
    KEYS.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw != null) data[k] = raw;
    });
    return { app: 'planas_games_futebol', version: 1, exportedAt: new Date().toISOString(), data };
  }

  function encode(payload) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  function decode(code) {
    return JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  }

  function applyPayload(payload) {
    if (!payload || !payload.data) throw new Error('formato inválido');
    const foundKeys = Object.keys(payload.data).filter((k) => KEYS.includes(k));
    if (!foundKeys.length) throw new Error('nenhum dado reconhecido');
    foundKeys.forEach((k) => localStorage.setItem(k, payload.data[k]));
    return foundKeys;
  }

  const exportCodeEl = document.getElementById('export-code');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const importCodeEl = document.getElementById('import-code');
  const importFileEl = document.getElementById('import-file');
  const importBtn = document.getElementById('import-btn');
  const importStatusEl = document.getElementById('import-status');

  const payload = buildExportPayload();
  const code = encode(payload);
  exportCodeEl.value = code;

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      exportCodeEl.removeAttribute('readonly');
      exportCodeEl.select();
      document.execCommand('copy');
      exportCodeEl.setAttribute('readonly', 'readonly');
    }
    copyBtn.textContent = 'Copiado!';
    setTimeout(() => { copyBtn.textContent = 'Copiar código'; }, 1500);
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planas-games-save-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importFileEl.addEventListener('change', () => {
    const file = importFileEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { importCodeEl.value = reader.result; };
    reader.readAsText(file);
  });

  importBtn.addEventListener('click', () => {
    const raw = importCodeEl.value.trim();
    if (!raw) { importStatusEl.textContent = 'Cole um código ou escolha um arquivo primeiro.'; return; }
    if (!confirm('Isso vai substituir o progresso atual neste aparelho. Continuar?')) return;
    let parsed;
    try {
      parsed = decode(raw);
    } catch (e) {
      try { parsed = JSON.parse(raw); } catch (e2) { parsed = null; }
    }
    try {
      const applied = applyPayload(parsed);
      importStatusEl.textContent = 'Importado com sucesso (' + applied.join(', ') + '). Voltando para o início...';
      setTimeout(() => { window.location.href = 'index.html'; }, 1200);
    } catch (e) {
      importStatusEl.textContent = 'Não foi possível importar: código ou arquivo inválido.';
    }
  });

  // ---------- Nuvem (Firebase, login por e-mail sem senha) ----------
  const loggedOutEl = document.getElementById('cloud-logged-out');
  const loggedInEl = document.getElementById('cloud-logged-in');
  const emailInputEl = document.getElementById('cloud-email-input');
  const loginBtn = document.getElementById('cloud-login-btn');
  const loginStatusEl = document.getElementById('cloud-login-status');
  const userEmailEl = document.getElementById('cloud-user-email');
  const cloudSaveBtn = document.getElementById('cloud-save-btn');
  const cloudLoadBtn = document.getElementById('cloud-load-btn');
  const cloudActionStatusEl = document.getElementById('cloud-action-status');
  const cloudLogoutBtn = document.getElementById('cloud-logout-btn');

  async function initCloudUI() {
    if (!window.WSPCloud || typeof firebase === 'undefined') {
      loginStatusEl.textContent = 'Não foi possível carregar a nuvem — verifique sua conexão e recarregue a página.';
      loginBtn.disabled = true;
      return;
    }

    let justLoggedIn = false;

    try {
      if (window.WSPCloud.isLoginLink()) {
        loginStatusEl.textContent = 'Confirmando seu login...';
        try {
          await window.WSPCloud.completeLoginFromLink();
          justLoggedIn = true;
        } catch (e) {
          if (e.code === 'email-needed') {
            const typed = prompt('Confirme o e-mail que você usou para pedir o link:');
            if (typed) {
              try { await window.WSPCloud.completeLoginFromLink(typed); justLoggedIn = true; }
              catch (e2) { loginStatusEl.textContent = 'Não foi possível confirmar o login: ' + (e2.message || e2); }
            }
          } else {
            loginStatusEl.textContent = 'Não foi possível confirmar o login: ' + (e.message || e);
          }
        }
      }
    } catch (e) {
      loginStatusEl.textContent = 'Não foi possível carregar a nuvem — verifique sua conexão e recarregue a página.';
      loginBtn.disabled = true;
      return;
    }

    window.WSPCloud.onAuthChange(async (user) => {
      if (user && user.isAnonymous) {
        // sessão anônima antiga (de antes do login por e-mail existir) — não conta como logado
        window.WSPCloud.signOut();
        return;
      }
      if (user) {
        loggedOutEl.classList.add('hidden');
        loggedInEl.classList.remove('hidden');
        userEmailEl.textContent = user.email || '';

        if (justLoggedIn) {
          justLoggedIn = false;
          try {
            const has = await window.WSPCloud.hasCloudSave();
            if (has && confirm('Encontramos um save salvo na nuvem para esse e-mail. Carregar agora? (substitui o progresso deste aparelho)')) {
              await window.WSPCloud.loadFromCloud();
              cloudActionStatusEl.textContent = 'Carregado! Voltando para o início...';
              setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            }
          } catch (e) { /* sem save ainda, tudo bem */ }
        }
      } else {
        loggedOutEl.classList.remove('hidden');
        loggedInEl.classList.add('hidden');
      }
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = emailInputEl.value.trim();
      if (!email || !email.includes('@')) { loginStatusEl.textContent = 'Digite um e-mail válido.'; return; }
      loginBtn.disabled = true;
      loginStatusEl.textContent = 'Enviando link...';
      try {
        await window.WSPCloud.sendLoginLink(email);
        loginStatusEl.textContent = 'Link enviado! Abra seu e-mail e toque no link pra continuar (pode fechar essa aba).';
      } catch (e) {
        loginStatusEl.textContent = 'Não foi possível enviar o link: ' + (e.message || e);
        loginBtn.disabled = false;
      }
    });
  }

  if (cloudSaveBtn) {
    cloudSaveBtn.addEventListener('click', async () => {
      cloudSaveBtn.disabled = true;
      cloudActionStatusEl.textContent = 'Salvando na nuvem...';
      try {
        await window.WSPCloud.saveToCloud();
        cloudActionStatusEl.textContent = 'Salvo com sucesso!';
      } catch (e) {
        cloudActionStatusEl.textContent = 'Não foi possível salvar: ' + (e.message || e);
      }
      cloudSaveBtn.disabled = false;
    });
  }

  if (cloudLoadBtn) {
    cloudLoadBtn.addEventListener('click', async () => {
      if (!confirm('Isso vai substituir o progresso atual neste aparelho. Continuar?')) return;
      cloudLoadBtn.disabled = true;
      cloudActionStatusEl.textContent = 'Buscando na nuvem...';
      try {
        const applied = await window.WSPCloud.loadFromCloud();
        cloudActionStatusEl.textContent = 'Carregado (' + applied.join(', ') + '). Voltando para o início...';
        setTimeout(() => { window.location.href = 'index.html'; }, 1200);
      } catch (e) {
        cloudActionStatusEl.textContent = e.message || 'Não foi possível carregar.';
        cloudLoadBtn.disabled = false;
      }
    });
  }

  if (cloudLogoutBtn) {
    cloudLogoutBtn.addEventListener('click', async () => {
      await window.WSPCloud.signOut();
      cloudActionStatusEl.textContent = '';
    });
  }

  initCloudUI();
})();
