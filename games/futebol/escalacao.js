(() => {
  'use strict';
  const { POSITIONS, FEET, loadSquad, isInjured } = window.WSPSquad;

  const STORAGE_KEY = 'wsp_lineup_v1';
  const BUCKET_ABBR = { GK: 'GOL', DEF: 'ZAG', MID: 'MEI', ATT: 'ATA' };
  const LINE_LABEL = { gk: 'Goleiro', def: 'Defesa', mid: 'Meio-campo', att: 'Ataque' };
  const BUCKET_ORDER = ['GK', 'DEF', 'MID', 'ATT'];
  const FOOT_LABEL = {};
  FEET.forEach((f) => { FOOT_LABEL[f.key] = f.label; });

  const squad = loadSquad();
  const byId = {};
  squad.players.forEach((p) => { byId[p.id] = p; });

  const formationBadgeEl = document.getElementById('formation-badge');
  const steppersEl = document.getElementById('formation-steppers');
  const totalEl = document.getElementById('formation-total');
  const sectionsEl = document.getElementById('lineup-sections');
  const benchListEl = document.getElementById('bench-list');
  const saveBtn = document.getElementById('save-lineup-btn');
  const pickerOverlay = document.getElementById('picker-overlay');
  const pickerTitleEl = document.getElementById('picker-title');
  const pickerListEl = document.getElementById('picker-list');
  const pickerCloseBtn = document.getElementById('picker-close');

  let formation = { def: 4, mid: 3, att: 3 };
  const assignment = { gk: null, def: [], mid: [], att: [] };

  function resizeLine(line, n) {
    const arr = assignment[line];
    while (arr.length < n) arr.push(null);
    while (arr.length > n) arr.pop();
  }

  // hidrata com a última escalação salva (se ainda bater com o elenco atual)
  let savedRaw = null;
  try { savedRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { savedRaw = null; }
  if (savedRaw && Array.isArray(savedRaw.formation) && savedRaw.formation.length === 3) {
    formation = { def: savedRaw.formation[0] | 0, mid: savedRaw.formation[1] | 0, att: savedRaw.formation[2] | 0 };
  }
  resizeLine('def', formation.def);
  resizeLine('mid', formation.mid);
  resizeLine('att', formation.att);
  if (savedRaw) {
    if (savedRaw.gkId && byId[savedRaw.gkId]) assignment.gk = savedRaw.gkId;
    ['def', 'mid', 'att'].forEach((line) => {
      const ids = (savedRaw.lines && savedRaw.lines[line]) || [];
      ids.forEach((id, i) => { if (i < assignment[line].length && byId[id]) assignment[line][i] = id; });
    });
  }

  function usedIds() {
    const s = new Set();
    if (assignment.gk) s.add(assignment.gk);
    ['def', 'mid', 'att'].forEach((line) => assignment[line].forEach((id) => { if (id) s.add(id); }));
    return s;
  }

  function getSlotValue(line, index) { return line === 'gk' ? assignment.gk : assignment[line][index]; }
  function setSlotValue(line, index, id) { if (line === 'gk') assignment.gk = id; else assignment[line][index] = id; }

  function positionLabelShort(p) {
    return (POSITIONS[p.position] && POSITIONS[p.position].label) || '';
  }

  // linha de estatísticas usada no seletor de jogador — nota, potencial, idade
  // e pé, pra dar informação suficiente pra escolher (ex: qual lateral é canhoto)
  function statsLine(p) {
    return '<span class="picker-stat">Nota ' + (p.rating || 60) + '</span>' +
      '<span class="picker-stat">Pot ' + (p.potential || 5) + '</span>' +
      '<span class="picker-stat">' + p.age + ' anos</span>' +
      '<span class="picker-stat">' + (FOOT_LABEL[p.foot] || p.foot) + '</span>';
  }

  function conditionTag(p) {
    const c = p.condition == null ? 100 : Math.round(p.condition);
    const tier = c >= 80 ? 'good' : c >= 50 ? 'mid' : 'low';
    return '<span class="condition-tag ' + tier + '">' + c + '%</span>';
  }

  let toastTimer = null;
  function showToast(msg) {
    let toast = document.getElementById('save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'save-toast';
      toast.className = 'save-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2400);
  }

  function openPicker(line, index) {
    pickerTitleEl.textContent = 'Escolher jogador — ' + LINE_LABEL[line] + (line === 'gk' ? '' : ' ' + (index + 1));
    const used = usedIds();
    const current = getSlotValue(line, index);
    const available = squad.players
      .filter((p) => !used.has(p.id) || p.id === current)
      .sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) || a.number - b.number);

    pickerListEl.innerHTML = '';
    if (!available.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;font-size:0.8rem;padding:8px;';
      empty.textContent = 'Nenhum jogador disponível — libere uma vaga em outra posição primeiro.';
      pickerListEl.appendChild(empty);
    }
    available.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'picker-player' + (p.id === current ? ' selected' : '');
      const hurt = isInjured && isInjured(p);
      btn.innerHTML =
        '<div class="picker-row-top">' +
          '<span class="num">#' + p.number + '</span>' +
          '<span class="nm">' + p.name + (hurt ? ' 🤕' : '') + '</span>' +
          conditionTag(p) +
        '</div>' +
        '<div class="picker-row-bottom">' +
          '<span class="pos">' + positionLabelShort(p) + ' · ' + BUCKET_ABBR[p.bucket] + '</span>' +
          statsLine(p) +
        '</div>';
      if (hurt) btn.title = 'Machucado — pode ser substituído automaticamente se ainda estiver fora no dia do jogo';
      btn.addEventListener('click', () => {
        setSlotValue(line, index, p.id);
        closePicker();
        renderAll();
      });
      pickerListEl.appendChild(btn);
    });
    pickerOverlay.classList.remove('hidden');
  }
  function closePicker() { pickerOverlay.classList.add('hidden'); }
  pickerCloseBtn.addEventListener('click', closePicker);

  function slotRow(line, index) {
    const playerId = getSlotValue(line, index);
    const btn = document.createElement('button');
    btn.className = 'lineup-slot ' + line;
    if (playerId && byId[playerId]) {
      const p = byId[playerId];
      const filled = document.createElement('div');
      filled.className = 'lineup-slot-filled';
      filled.innerHTML = '<span class="num">#' + p.number + '</span><span class="nm">' + p.name + (isInjured && isInjured(p) ? ' 🤕' : '') + '</span>' +
        conditionTag(p) + '<span class="pos">' + positionLabelShort(p) + '</span>';
      btn.appendChild(filled);
      const clearBtn = document.createElement('span');
      clearBtn.className = 'lineup-slot-clear';
      clearBtn.textContent = '×';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSlotValue(line, index, null);
        renderAll();
      });
      btn.appendChild(clearBtn);
    } else {
      const empty = document.createElement('div');
      empty.className = 'lineup-slot-empty';
      empty.textContent = '+ Toque para escolher';
      btn.appendChild(empty);
    }
    btn.addEventListener('click', () => openPicker(line, index));
    return btn;
  }

  function addSection(title, line, count) {
    if (count <= 0) return;
    const section = document.createElement('div');
    section.className = 'elenco-section';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    section.appendChild(h2);
    for (let i = 0; i < count; i++) section.appendChild(slotRow(line, i));
    sectionsEl.appendChild(section);
  }

  function renderFormationBadge() {
    formationBadgeEl.textContent = formation.def + '-' + formation.mid + '-' + formation.att;
  }

  function renderSteppers() {
    steppersEl.innerHTML = '';
    const total = formation.def + formation.mid + formation.att;
    [['def', 'Defesa'], ['mid', 'Meio-campo'], ['att', 'Ataque']].forEach(([key, label]) => {
      const wrap = document.createElement('div');
      wrap.className = 'stepper';
      const lab = document.createElement('div');
      lab.className = 'stepper-label';
      lab.textContent = label;
      wrap.appendChild(lab);

      const ctrl = document.createElement('div');
      ctrl.className = 'stepper-controls';
      const minus = document.createElement('button');
      minus.className = 'stepper-btn';
      minus.textContent = '−';
      minus.disabled = formation[key] <= 0;
      minus.addEventListener('click', () => {
        formation[key] = Math.max(0, formation[key] - 1);
        resizeLine(key, formation[key]);
        renderAll();
      });
      const val = document.createElement('div');
      val.className = 'stepper-value';
      val.textContent = formation[key];
      const plus = document.createElement('button');
      plus.className = 'stepper-btn';
      plus.textContent = '+';
      plus.disabled = total >= 10 || formation[key] >= 9;
      plus.addEventListener('click', () => {
        formation[key] = Math.min(9, formation[key] + 1);
        resizeLine(key, formation[key]);
        renderAll();
      });
      ctrl.appendChild(minus);
      ctrl.appendChild(val);
      ctrl.appendChild(plus);
      wrap.appendChild(ctrl);
      steppersEl.appendChild(wrap);
    });

    totalEl.textContent = total === 10
      ? '10/10 jogadores de linha — esquema completo'
      : total + '/10 jogadores de linha — ajuste para somar exatamente 10';
    totalEl.className = 'formation-total' + (total === 10 ? '' : ' invalid');
  }

  function renderLineup() {
    sectionsEl.innerHTML = '';
    addSection('Goleiro', 'gk', 1);
    addSection('Defesa (' + formation.def + ')', 'def', formation.def);
    addSection('Meio-campo (' + formation.mid + ')', 'mid', formation.mid);
    addSection('Ataque (' + formation.att + ')', 'att', formation.att);
  }

  function renderBench() {
    const used = usedIds();
    const bench = squad.players
      .filter((p) => !used.has(p.id))
      .sort((a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) || a.number - b.number);
    benchListEl.innerHTML = '';
    if (!bench.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;font-size:0.78rem;font-style:italic;padding:4px 2px;';
      empty.textContent = 'Todo o elenco está escalado.';
      benchListEl.appendChild(empty);
      return;
    }
    bench.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'player-card ' + p.bucket.toLowerCase();
      const info = document.createElement('div');
      info.className = 'player-info';
      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = '#' + p.number + ' ' + p.name + (isInjured && isInjured(p) ? ' 🤕' : '');
      info.appendChild(name);
      const pos = document.createElement('div');
      pos.className = 'player-position';
      pos.textContent = positionLabelShort(p) + ' · ' + BUCKET_ABBR[p.bucket];
      info.appendChild(pos);
      card.appendChild(info);
      benchListEl.appendChild(card);
    });
  }

  function renderAll() {
    renderFormationBadge();
    renderSteppers();
    renderLineup();
    renderBench();
  }

  saveBtn.addEventListener('click', () => {
    const total = formation.def + formation.mid + formation.att;
    if (total !== 10) { showToast('A soma de Defesa + Meio + Ataque precisa ser 10.'); return; }
    if (!assignment.gk) { showToast('Escolha o goleiro antes de salvar.'); return; }
    const incomplete = ['def', 'mid', 'att'].some((line) => assignment[line].some((id) => !id));
    if (incomplete) { showToast('Preencha todas as vagas antes de salvar.'); return; }

    const payload = {
      formation: [formation.def, formation.mid, formation.att],
      gkId: assignment.gk,
      lines: { def: assignment.def.slice(), mid: assignment.mid.slice(), att: assignment.att.slice() },
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    showToast('Escalação salva! Vale a partir da próxima partida.');
  });

  renderAll();
})();
