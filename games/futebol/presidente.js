(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_tour_v1';

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return raw || { gender: null, seen: {} };
    } catch (e) { return { gender: null, seen: {} }; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  }

  let state = loadState();

  function avatar() { return state.gender === 'f' ? '👩‍💼' : '👨‍💼'; }
  function title() { return state.gender === 'f' ? 'Presidenta do Clube' : 'Presidente do Clube'; }

  const CSS = `
    .tour-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex;
      align-items: center; justify-content: center; z-index: 999; padding: 16px; font-family: 'Segoe UI', Arial, sans-serif; }
    .tour-overlay.hidden { display: none; }
    .tour-card { background: #16281f; border: 2px solid #ffd54a; border-radius: 14px; padding: 20px;
      max-width: 380px; width: 100%; text-align: center; color: white; max-height: 85vh; overflow-y: auto; }
    .tour-avatar { font-size: 2.6rem; margin-bottom: 6px; }
    .tour-name { font-weight: bold; color: #ffd54a; font-size: 0.85rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .tour-text { font-size: 0.9rem; line-height: 1.5; margin-bottom: 12px; white-space: pre-line; }
    .tour-progress { font-size: 0.68rem; color: #9fd8b8; margin-bottom: 12px; }
    .tour-actions { display: flex; gap: 8px; }
    .tour-actions button { flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: bold; font-size: 0.82rem; cursor: pointer; }
    #tour-skip { background: #0e1c15; color: #9fd8b8; border: 1px solid #345c48 !important; }
    #tour-next { background: #2f9e44; color: white; }
    .tour-gender-row { display: flex; gap: 10px; margin-top: 4px; }
    .tour-gender-btn { flex: 1; background: #0e1c15; border: 1px solid #345c48; border-radius: 10px;
      padding: 14px 6px; color: white; font-size: 0.8rem; cursor: pointer; }
    .tour-gender-btn:hover { border-color: #ffd54a; }
    .tour-gender-btn .emoji { display: block; font-size: 2rem; margin-bottom: 6px; }
    #tour-help-btn { position: fixed; bottom: 16px; right: 16px; width: 46px; height: 46px; border-radius: 50%;
      background: #ffd54a; color: #1c1c1c; border: none; font-size: 1.3rem; font-weight: bold; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4); z-index: 998; }
  `;

  let overlayEl, avatarEl, nameEl, textEl, progressEl, skipBtn, nextBtn;

  function ensureUI() {
    if (document.getElementById('tour-overlay')) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    overlayEl = document.createElement('div');
    overlayEl.id = 'tour-overlay';
    overlayEl.className = 'tour-overlay hidden';
    overlayEl.innerHTML =
      '<div class="tour-card">' +
      '<div class="tour-avatar" id="tour-avatar"></div>' +
      '<div class="tour-name" id="tour-name"></div>' +
      '<div class="tour-text" id="tour-text"></div>' +
      '<div class="tour-progress" id="tour-progress"></div>' +
      '<div class="tour-actions">' +
      '<button id="tour-skip">Pular</button>' +
      '<button id="tour-next">Próximo</button>' +
      '</div></div>';
    document.body.appendChild(overlayEl);

    avatarEl = document.getElementById('tour-avatar');
    nameEl = document.getElementById('tour-name');
    textEl = document.getElementById('tour-text');
    progressEl = document.getElementById('tour-progress');
    skipBtn = document.getElementById('tour-skip');
    nextBtn = document.getElementById('tour-next');
  }

  function ensureHelpButton(onClick) {
    if (document.getElementById('tour-help-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'tour-help-btn';
    btn.textContent = '❓';
    btn.title = 'Dúvidas? Chame o ' + title();
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
  }

  function showGenderPicker(onDone) {
    ensureUI();
    avatarEl.textContent = '🏟️';
    nameEl.textContent = 'Bem-vindo ao clube!';
    textEl.innerHTML = 'Antes de começar, escolha quem vai presidir o seu clube:';
    progressEl.textContent = '';
    skipBtn.classList.add('hidden');
    nextBtn.classList.add('hidden');

    const row = document.createElement('div');
    row.className = 'tour-gender-row';
    row.id = 'tour-gender-row';
    [['m', '👨‍💼', 'Presidente'], ['f', '👩‍💼', 'Presidenta']].forEach(([key, emoji, label]) => {
      const btn = document.createElement('button');
      btn.className = 'tour-gender-btn';
      btn.innerHTML = '<span class="emoji">' + emoji + '</span>' + label;
      btn.addEventListener('click', () => {
        state.gender = key;
        saveState(state);
        row.remove();
        skipBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        onDone();
      });
      row.appendChild(btn);
    });
    textEl.parentNode.insertBefore(row, progressEl);
    overlayEl.classList.remove('hidden');
  }

  // roda a sequência de passos (steps: [{text}]) pra um screenId específico —
  // só aparece sozinho na primeira vez; o botão de ajuda sempre pode reabrir.
  // opts.onOpen/opts.onFinish avisam quem chamou (ex: pausar a partida
  // enquanto o tour está na tela e retomar quando ele fechar)
  function runTour(screenId, steps, opts) {
    const force = opts && opts.force;
    const onOpen = opts && opts.onOpen;
    const onFinish = opts && opts.onFinish;
    ensureUI();
    ensureHelpButton(() => runTour(screenId, steps, Object.assign({}, opts, { force: true })));

    if (!force && state.seen[screenId]) return;
    if (onOpen) onOpen();

    function startSteps() {
      let i = 0;
      function showStep() {
        avatarEl.textContent = avatar();
        nameEl.textContent = title();
        textEl.textContent = steps[i];
        progressEl.textContent = (i + 1) + ' / ' + steps.length;
        overlayEl.classList.remove('hidden');
      }
      function finish() {
        state.seen[screenId] = true;
        saveState(state);
        overlayEl.classList.add('hidden');
        nextBtn.onclick = null;
        skipBtn.onclick = null;
        if (onFinish) onFinish();
      }
      nextBtn.onclick = () => {
        i++;
        if (i >= steps.length) finish();
        else showStep();
      };
      skipBtn.onclick = finish;
      showStep();
    }

    if (state.gender == null) showGenderPicker(startSteps);
    else startSteps();
  }

  window.WSPTour = { runTour };
})();
