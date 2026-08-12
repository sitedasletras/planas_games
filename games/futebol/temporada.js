(() => {
  'use strict';

  const S = window.WSPSeason;
  const squad = window.WSPSquad.loadSquad();
  const club = window.WSPClub.loadClub();
  let state = S.loadState();

  const bannerEl = document.getElementById('season-banner');
  const outcomeEl = document.getElementById('outcome-banner');
  const leagueCardEl = document.getElementById('league-card');
  const copaSectionTitle = document.getElementById('copa-section-title');
  const copaCardEl = document.getElementById('copa-card');
  const historyEl = document.getElementById('history-list');

  function formatMoney(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

  function ensureCompetitions() {
    S.ensureLeague(state, squad.clubName, squad);
    if (S.copaEligible(state.tierIndex)) S.ensureCopa(state, squad.clubName, squad);
    S.saveState(state);
  }

  function consumePendingResult() {
    let resultRaw, pendingRaw;
    try {
      resultRaw = localStorage.getItem('wsp_season_result');
      pendingRaw = localStorage.getItem('wsp_season_pending');
    } catch (e) { return; }
    if (!resultRaw || !pendingRaw) return;
    const result = JSON.parse(resultRaw);
    const pending = JSON.parse(pendingRaw);
    localStorage.removeItem('wsp_season_result');
    localStorage.removeItem('wsp_season_pending');

    if (pending.type === 'liga' && state.league) {
      S.playRound(state, result);
    } else if (pending.type === 'copa' && state.copa) {
      const copa = state.copa;
      if (pending.part === 'grupos') {
        S.playAllGroupsRound(copa, result);
        if (copa.stage === 'grupos' && S.allGroupsOver(copa)) S.advanceFromGroups(copa);
      } else if (pending.part === 'playoff') {
        S.playPlayoff(copa, result);
      } else {
        S.playKnockoutStage(copa, pending.part, result);
      }
    }
    S.saveState(state);
  }

  function goPlay(type, part) {
    try {
      localStorage.setItem('wsp_season_pending', JSON.stringify({ type, part }));
    } catch (e) { /* storage unavailable */ }
    window.location.href = 'match.html?season=1';
  }

  function standingsTable(rows, highlightId) {
    const table = document.createElement('table');
    table.className = 'standings';
    table.innerHTML = `<thead><tr>
      <th>#</th><th class="name-h" style="text-align:left">Time</th><th>PJ</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Pts</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.id === highlightId) tr.className = 'me';
      const sg = r.gf - r.ga;
      tr.innerHTML = `<td>${i + 1}</td><td class="name">${r.name}</td><td>${r.played}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${sg > 0 ? '+' : ''}${sg}</td><td class="pts">${r.pts}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function bracketRow(nameA, nameB, golsA, golsB, isMe) {
    const row = document.createElement('div');
    row.className = 'bracket-row' + (isMe ? ' me' : '');
    const names = document.createElement('div');
    names.className = 'names';
    names.textContent = nameA + ' x ' + nameB;
    row.appendChild(names);
    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = golsA == null ? '-' : golsA + ' - ' + golsB;
    row.appendChild(score);
    return row;
  }

  function nameFor(id, teamsPool) {
    if (id === 'user') return squad.clubName;
    const t = teamsPool.find((x) => x.id === id);
    return t ? t.name : '???';
  }

  // ---------- League panel ----------
  function renderLeague() {
    leagueCardEl.innerHTML = '';
    const league = state.league;
    const tier = S.TIERS[state.tierIndex];
    const sub = document.createElement('div');
    sub.className = 'comp-sub';
    sub.textContent = tier.label + ' — Rodada ' + Math.min(league.round + 1, 18) + '/18';
    leagueCardEl.appendChild(sub);

    const table = S.sortedStandings(league);
    leagueCardEl.appendChild(standingsTable(table, 'user'));

    const actions = document.createElement('div');
    actions.className = 'comp-actions';

    if (!S.isLeagueOver(league)) {
      const fixture = S.currentUserFixture(league);
      if (fixture) {
        const playBtn = document.createElement('button');
        playBtn.className = 'comp-btn';
        playBtn.textContent = 'Jogar minha partida';
        playBtn.addEventListener('click', () => goPlay('liga'));
        actions.appendChild(playBtn);
      }
      const simBtn = document.createElement('button');
      simBtn.className = 'comp-btn secondary';
      simBtn.textContent = 'Simular rodada';
      simBtn.addEventListener('click', () => {
        S.playRound(state);
        S.saveState(state);
        render();
      });
      actions.appendChild(simBtn);
    } else {
      const endBtn = document.createElement('button');
      endBtn.className = 'comp-btn';
      endBtn.textContent = 'Encerrar Temporada';
      endBtn.addEventListener('click', () => {
        const outcome = S.leagueOutcome(league);
        const oldTierIndex = state.tierIndex;
        S.finishLeagueSeason(state);
        const tierChanged = state.tierIndex !== oldTierIndex;
        const seasonEnd = window.WSPClub.payEndOfSeason(club, squad);
        showOutcome(
          `Temporada encerrada: ${ordinalPt(outcome.userPos)} lugar no ${tier.label}.\n` +
          (outcome.userPromoted && tierChanged ? '⬆️ Promovido para ' + S.TIERS[state.tierIndex].label + '!'
            : outcome.userRelegated && tierChanged ? '⬇️ Rebaixado para ' + S.TIERS[state.tierIndex].label + '.'
            : outcome.userRelegated ? 'Já está na divisão mais baixa — permanece no mesmo nível.'
            : outcome.userPromoted ? 'Já está no topo da pirâmide — permanece no mesmo nível.'
            : 'Permanece no mesmo nível.') +
          `\nFérias + 13º salário do elenco: -${formatMoney(seasonEnd.total)} (caixa: ${formatMoney(club.budget)})`
        );
        ensureCompetitions();
        render();
      });
      actions.appendChild(endBtn);
    }
    leagueCardEl.appendChild(actions);
  }

  // ---------- Copa panel ----------
  function copaTeamsPool(copa) {
    const pool = [];
    copa.groups.forEach((g) => g.members.forEach((m) => pool.push(m)));
    return pool;
  }

  function renderCopa() {
    if (!S.copaEligible(state.tierIndex)) {
      copaSectionTitle.style.display = 'none';
      copaCardEl.style.display = 'none';
      return;
    }
    copaSectionTitle.style.display = '';
    copaCardEl.style.display = '';
    copaCardEl.innerHTML = '';
    const copa = state.copa;
    const copaTier = S.COPA_TIERS[state.copaTierIndex];
    const pool = copaTeamsPool(copa);

    const sub = document.createElement('div');
    sub.className = 'comp-sub';
    sub.textContent = copaTier.label + ' — ' + stageLabel(copa.stage);
    copaCardEl.appendChild(sub);

    if (copa.stage === 'grupos') {
      const myGroup = copa.groups.find((g) => g.members.some((m) => m.id === 'user'));
      const gsub = document.createElement('div');
      gsub.className = 'comp-sub';
      gsub.textContent = 'Meu grupo — jogo ' + Math.min(myGroup.round + 1, 3) + '/3';
      copaCardEl.appendChild(gsub);
      copaCardEl.appendChild(standingsTable(S.groupStandingsSorted(myGroup), 'user'));
    } else if (copa.stage === 'playoff') {
      const list = document.createElement('div');
      list.className = 'bracket-list';
      copa.playoff.pairs.forEach((p) => {
        const isMe = p.a === 'user' || p.b === 'user';
        list.appendChild(bracketRow(nameFor(p.a, pool), nameFor(p.b, pool), p.golsA, p.golsB, isMe));
      });
      copaCardEl.appendChild(list);
    } else if (['oitavas', 'quartas', 'semis', 'final'].includes(copa.stage)) {
      const stageObj = copa[copa.stage];
      const list = document.createElement('div');
      list.className = 'bracket-list';
      stageObj.matches.forEach((m) => {
        const isMe = m.home === 'user' || m.away === 'user';
        list.appendChild(bracketRow(nameFor(m.home, pool), nameFor(m.away, pool), m.golsHome, m.golsAway, isMe));
      });
      copaCardEl.appendChild(list);
    } else if (copa.stage === 'concluida') {
      const msg = document.createElement('div');
      msg.className = 'comp-empty';
      msg.textContent = copa.champion === 'user' ? '🏆 Campeão da copa!' : (nameFor(copa.champion, pool) + ' é o campeão.');
      copaCardEl.appendChild(msg);
    }

    const actions = document.createElement('div');
    actions.className = 'comp-actions';

    if (copa.stage === 'concluida') {
      const endBtn = document.createElement('button');
      endBtn.className = 'comp-btn';
      endBtn.textContent = 'Encerrar Copa';
      endBtn.addEventListener('click', () => {
        const oldCopaTierIndex = state.copaTierIndex;
        const result = S.finishCopaSeason(state);
        const copaTierChanged = state.copaTierIndex !== oldCopaTierIndex;
        showOutcome(
          (result.champion ? '🏆 ' + squad.clubName + ' foi campeão da ' + copaTier.label + '!\n' : '') +
          (result.userPromoted && copaTierChanged ? '⬆️ Time promovido para a ' + S.COPA_TIERS[state.copaTierIndex].label + ' na próxima temporada.'
            : result.userRelegated && copaTierChanged ? '⬇️ Time rebaixado para a ' + S.COPA_TIERS[state.copaTierIndex].label + ' na próxima temporada.'
            : result.userRelegated ? 'Já está na copa mais baixa — permanece no mesmo nível.'
            : result.userPromoted ? 'Já está no topo das copas disponíveis — permanece no mesmo nível.'
            : 'Time segue no mesmo nível da copa.')
        );
        ensureCompetitions();
        render();
      });
      actions.appendChild(endBtn);
    } else if (!S.userStillIn(copa)) {
      const msg = document.createElement('div');
      msg.className = 'comp-empty';
      msg.textContent = 'Eliminado nesta copa — aguarde o restante do chaveamento.';
      copaCardEl.appendChild(msg);
      const simBtn = document.createElement('button');
      simBtn.className = 'comp-btn secondary';
      simBtn.textContent = 'Simular fase';
      simBtn.addEventListener('click', () => { advanceCopaStage(copa, null); render(); });
      actions.appendChild(simBtn);
    } else {
      const fixture = S.copaUserFixture(copa);
      if (fixture) {
        const playBtn = document.createElement('button');
        playBtn.className = 'comp-btn';
        playBtn.textContent = 'Jogar minha partida';
        playBtn.addEventListener('click', () => goPlay('copa', copa.stage));
        actions.appendChild(playBtn);
      }
      const simBtn = document.createElement('button');
      simBtn.className = 'comp-btn secondary';
      simBtn.textContent = 'Simular fase';
      simBtn.addEventListener('click', () => { advanceCopaStage(copa, null); render(); });
      actions.appendChild(simBtn);
    }
    copaCardEl.appendChild(actions);
  }

  function advanceCopaStage(copa, userResult) {
    if (copa.stage === 'grupos') {
      S.playAllGroupsRound(copa, userResult);
      if (copa.stage === 'grupos' && S.allGroupsOver(copa)) S.advanceFromGroups(copa);
    } else if (copa.stage === 'playoff') {
      S.playPlayoff(copa, userResult);
    } else if (copa.stage !== 'concluida') {
      S.playKnockoutStage(copa, copa.stage, userResult);
    }
    S.saveState(state);
  }

  function stageLabel(stage) {
    return { grupos: 'Fase de Grupos', playoff: 'Playoff (2º x 3º)', oitavas: 'Oitavas de Final',
      quartas: 'Quartas de Final', semis: 'Semifinal', final: 'Final', concluida: 'Concluída' }[stage] || stage;
  }

  function ordinalPt(n) { return n + 'º'; }

  function showOutcome(text) {
    outcomeEl.textContent = text;
    outcomeEl.classList.remove('hidden');
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    if (!state.history.length) {
      const empty = document.createElement('div');
      empty.className = 'comp-empty';
      empty.style.padding = '0 14px';
      empty.textContent = 'Nenhuma temporada concluída ainda.';
      historyEl.appendChild(empty);
      return;
    }
    state.history.slice(0, 12).forEach((h) => {
      const row = document.createElement('div');
      row.className = 'history-row';
      let desc;
      if (h.type === 'liga') {
        desc = h.tierLabel + ' — ' + ordinalPt(h.userPos) + ' lugar' + (h.promoted ? ' (subiu)' : h.relegated ? ' (caiu)' : '');
      } else {
        desc = h.tierLabel + (h.champion ? ' — Campeão!' : h.promoted ? ' — avançou às quartas' : h.relegated ? ' — caiu na fase de grupos' : '');
      }
      row.innerHTML = `<span class="tag">Temp. ${h.seasonLetter}</span><span>${desc}</span>`;
      historyEl.appendChild(row);
    });
  }

  function render() {
    bannerEl.innerHTML = `
      <div class="season-letter">Temporada ${S.seasonLetter(state.seasonIndex)}</div>
      <div class="season-tier">${squad.clubName} — ${S.TIERS[state.tierIndex].label}</div>
    `;
    renderLeague();
    renderCopa();
    renderHistory();
  }

  consumePendingResult();
  ensureCompetitions();
  render();
})();
