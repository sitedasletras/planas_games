(() => {
  'use strict';
  const { loadClub, saveClub, moraleLabel, FACILITY_GROUPS } = window.WSPClub;
  const { loadSquad, isInjured } = window.WSPSquad || {};
  const Cal = window.WSPCalendar;

  const STORAGE_KEY = 'wsp_board_v1';
  const COOLDOWN_MS = (Cal && Cal.GAME_DAY_REAL_MS) || 2 * 60 * 60 * 1000; // 1 dia do jogo
  const GRANT_MIN = 150, GRANT_MAX = 400;
  const DISCOUNT_PCT = 0.3;

  const club = loadClub();
  const squad = loadSquad ? loadSquad() : null;
  const quoteEl = document.getElementById('board-quote');
  const btnEl = document.getElementById('board-action-btn');
  const reportGridEl = document.getElementById('report-grid');
  const priorityEl = document.getElementById('board-priority');
  const priorityOptionsEl = document.getElementById('board-priority-options');

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return raw || { lastMeetingAt: null, lastGrant: null, awaitingPriority: false };
    } catch (e) { return { lastMeetingAt: null, lastGrant: null, awaitingPriority: false }; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  }

  let state = loadState();

  function formatMoney(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

  function cooldownRemaining() {
    if (!state.lastMeetingAt) return 0;
    return Math.max(0, state.lastMeetingAt + COOLDOWN_MS - Date.now());
  }

  function boardQuote() {
    const cal = Cal ? Cal.loadCalendar() : null;
    const last = cal && cal.lastMatch;
    if (last) {
      const diff = last.golsFor - last.golsAgainst;
      if (diff >= 3) return 'A diretoria parabeniza a comissão técnica pelo desempenho na última partida. O trabalho está no caminho certo.';
      if (diff > 0) return 'A diretoria observa o resultado recente com satisfação e mantém a confiança no planejamento do clube.';
      if (diff === 0) return 'A diretoria pede mais consistência nos próximos compromissos, mas reconhece o empenho do elenco.';
      if (diff > -3) return 'A diretoria cobra uma reação após o resultado recente e espera evolução nas próximas rodadas.';
      return 'A diretoria está preocupada com a sequência de resultados e convoca a comissão técnica pra alinhar expectativas.';
    }
    if ((club.budget || 0) < 2000) return 'As contas do clube estão apertadas. A diretoria pede cautela nos próximos investimentos.';
    return 'A diretoria acompanha de perto o trabalho da comissão técnica e reforça o apoio ao projeto do clube.';
  }

  function reportItem(label, value) {
    const item = document.createElement('div');
    item.className = 'report-item';
    const l = document.createElement('div');
    l.className = 'report-label';
    l.textContent = label;
    item.appendChild(l);
    const v = document.createElement('div');
    v.className = 'report-value';
    v.textContent = value;
    item.appendChild(v);
    return item;
  }

  function renderReport() {
    reportGridEl.innerHTML = '';
    reportGridEl.appendChild(reportItem('Caixa do clube', formatMoney(club.budget)));
    const morale = club.morale == null ? 50 : club.morale;
    reportGridEl.appendChild(reportItem('Moral do elenco', moraleLabel(morale) + ' (' + morale + ')'));

    const cal = Cal ? Cal.loadCalendar() : null;
    const last = cal && cal.lastMatch;
    reportGridEl.appendChild(reportItem('Último resultado', last ? (last.golsFor + ' x ' + last.golsAgainst + ' vs ' + last.adv) : 'Nenhuma partida ainda'));

    if (squad && squad.players.length) {
      const avgRating = squad.players.reduce((s, p) => s + (p.rating || 60), 0) / squad.players.length;
      reportGridEl.appendChild(reportItem('Nota média do elenco', avgRating.toFixed(1)));
      const avgCondition = squad.players.reduce((s, p) => s + (p.condition == null ? 100 : p.condition), 0) / squad.players.length;
      reportGridEl.appendChild(reportItem('Condicionamento médio', Math.round(avgCondition) + '%'));
      const injuredCount = isInjured ? squad.players.filter((p) => isInjured(p)).length : 0;
      reportGridEl.appendChild(reportItem('Departamento médico', injuredCount + ' machucado(s)'));
    }

    const deptLevels = Object.values(club.departments || {});
    if (deptLevels.length) {
      const avgDept = deptLevels.reduce((s, l) => s + l, 0) / deptLevels.length;
      reportGridEl.appendChild(reportItem('Nível médio do Campus', avgDept.toFixed(1) + '/20'));
    }
  }

  function renderPriorityOptions() {
    priorityOptionsEl.innerHTML = '';
    Object.keys(FACILITY_GROUPS).forEach((groupKey) => {
      const group = FACILITY_GROUPS[groupKey];
      const btn = document.createElement('button');
      btn.className = 'board-priority-btn';
      btn.textContent = group.icon + ' ' + group.label + ' — ' + Math.round(DISCOUNT_PCT * 100) + '% de desconto na próxima melhoria';
      btn.addEventListener('click', () => {
        club.pendingDiscount = { group: groupKey, pct: DISCOUNT_PCT };
        saveClub(club);
        state.awaitingPriority = false;
        saveState(state);
        priorityEl.classList.add('hidden');
        quoteEl.textContent = boardQuote() + '\n\nA diretoria decide priorizar "' + group.label + '" — próxima melhoria nessa área sai com desconto.';
      });
      priorityOptionsEl.appendChild(btn);
    });
  }

  function render() {
    renderReport();
    const remaining = cooldownRemaining();
    let text = boardQuote();
    if (remaining > 0 && state.lastGrant) {
      text += '\n\nA diretoria liberou uma verba de apoio: +' + formatMoney(state.lastGrant) + '.';
    }
    quoteEl.textContent = text;
    if (remaining > 0) {
      btnEl.textContent = 'Próxima reunião em ' + (Cal ? Cal.formatCountdown(remaining) : Math.ceil(remaining / 60000) + 'min');
      btnEl.disabled = true;
    } else {
      btnEl.textContent = 'Ouvir a diretoria';
      btnEl.disabled = false;
    }
    if (state.awaitingPriority && remaining > 0) {
      renderPriorityOptions();
      priorityEl.classList.remove('hidden');
    } else {
      priorityEl.classList.add('hidden');
    }
  }

  btnEl.addEventListener('click', () => {
    if (cooldownRemaining() > 0) return;
    const grant = Math.round((GRANT_MIN + Math.random() * (GRANT_MAX - GRANT_MIN)) / 10) * 10;
    club.budget += grant;
    saveClub(club);
    state.lastMeetingAt = Date.now();
    state.lastGrant = grant;
    state.awaitingPriority = true;
    saveState(state);
    render();
  });

  render();
  setInterval(render, 60000);
})();
