(() => {
  'use strict';
  const { loadClub, saveClub } = window.WSPClub;
  const Cal = window.WSPCalendar;

  const STORAGE_KEY = 'wsp_board_v1';
  const COOLDOWN_MS = (Cal && Cal.GAME_DAY_REAL_MS) || 2 * 60 * 60 * 1000; // 1 dia do jogo
  const GRANT_MIN = 150, GRANT_MAX = 400;

  const club = loadClub();
  const cardEl = document.getElementById('board-card');
  const quoteEl = document.getElementById('board-quote');
  const btnEl = document.getElementById('board-action-btn');

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return raw || { lastMeetingAt: null };
    } catch (e) { return { lastMeetingAt: null }; }
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

  function render() {
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
  }

  btnEl.addEventListener('click', () => {
    if (cooldownRemaining() > 0) return;
    const grant = Math.round((GRANT_MIN + Math.random() * (GRANT_MAX - GRANT_MIN)) / 10) * 10;
    club.budget += grant;
    saveClub(club);
    state.lastMeetingAt = Date.now();
    state.lastGrant = grant;
    saveState(state);
    render();
  });

  render();
  setInterval(render, 60000);
})();
