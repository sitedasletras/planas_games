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

  // ---------- Nuvem (Firebase) ----------
  const cloudSaveBtn = document.getElementById('cloud-save-btn');
  const cloudSaveStatusEl = document.getElementById('cloud-save-status');
  const cloudCodeInputEl = document.getElementById('cloud-code-input');
  const cloudLoadBtn = document.getElementById('cloud-load-btn');
  const cloudLoadStatusEl = document.getElementById('cloud-load-status');

  if (window.WSPCloud) {
    const existingCode = window.WSPCloud.getSyncCode();
    if (existingCode) cloudCodeInputEl.value = existingCode;

    cloudSaveBtn.addEventListener('click', async () => {
      cloudSaveBtn.disabled = true;
      cloudSaveStatusEl.textContent = 'Salvando na nuvem...';
      try {
        const code = await window.WSPCloud.saveToCloud();
        cloudSaveStatusEl.textContent = 'Salvo! Seu código de sincronização é: ' + code;
        cloudCodeInputEl.value = code;
      } catch (e) {
        cloudSaveStatusEl.textContent = 'Não foi possível salvar na nuvem agora. Tente de novo em instantes.';
      }
      cloudSaveBtn.disabled = false;
    });

    cloudLoadBtn.addEventListener('click', async () => {
      const code = cloudCodeInputEl.value.trim();
      if (!code) { cloudLoadStatusEl.textContent = 'Digite um código de sincronização primeiro.'; return; }
      if (!confirm('Isso vai substituir o progresso atual neste aparelho. Continuar?')) return;
      cloudLoadBtn.disabled = true;
      cloudLoadStatusEl.textContent = 'Buscando na nuvem...';
      try {
        const applied = await window.WSPCloud.loadFromCloud(code);
        cloudLoadStatusEl.textContent = 'Carregado com sucesso (' + applied.join(', ') + '). Voltando para o início...';
        setTimeout(() => { window.location.href = 'index.html'; }, 1200);
      } catch (e) {
        cloudLoadStatusEl.textContent = e.message || 'Não foi possível carregar esse código.';
        cloudLoadBtn.disabled = false;
      }
    });
  } else {
    cloudSaveBtn.disabled = true;
    cloudLoadBtn.disabled = true;
    cloudSaveStatusEl.textContent = 'Nuvem indisponível no momento.';
  }
})();
