(() => {
  'use strict';

  const S = window.WSPSeason;
  const squad = window.WSPSquad.loadSquad();
  const club = window.WSPClub.loadClub();
  const state = S.loadState();

  let pending = null;
  try { pending = JSON.parse(localStorage.getItem('wsp_season_pending') || 'null'); } catch (e) { pending = null; }

  if (!pending || !pending.opponentName) {
    window.location.href = 'temporada.html';
    return;
  }

  const stageEl = document.getElementById('confronto-stage');
  const homeCrestEl = document.getElementById('home-crest');
  const homeNameEl = document.getElementById('home-name');
  const homeFormEl = document.getElementById('home-form');
  const awayCrestEl = document.getElementById('away-crest');
  const awayNameEl = document.getElementById('away-name');
  const awayFormEl = document.getElementById('away-form');
  const homeGrlEl = document.getElementById('home-grl');
  const awayGrlEl = document.getElementById('away-grl');
  const homeFillEl = document.getElementById('home-fill');
  const awayFillEl = document.getElementById('away-fill');
  const grlHintEl = document.getElementById('grl-hint');
  const enterBtn = document.getElementById('enter-btn');

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || '?';
  }

  function colorForName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return 'hsl(' + (hash % 360) + ', 55%, 40%)';
  }

  function recentForm(fixturesRounds, teamId, count) {
    const results = [];
    fixturesRounds.forEach((round) => {
      round.forEach((m) => {
        if (!m.played || (m.home !== teamId && m.away !== teamId)) return;
        const isHome = m.home === teamId;
        const gf = isHome ? m.golsHome : m.golsAway;
        const ga = isHome ? m.golsAway : m.golsHome;
        results.push(gf > ga ? 'v' : gf < ga ? 'd' : 'e');
      });
    });
    return results.slice(-count);
  }

  function renderForm(el, letters, count) {
    el.innerHTML = '';
    const padded = new Array(Math.max(0, count - letters.length)).fill(null).concat(letters);
    padded.forEach((letter) => {
      const chip = document.createElement('span');
      chip.className = 'form-chip' + (letter ? ' ' + letter : ' empty');
      chip.textContent = letter ? letter.toUpperCase() : '-';
      el.appendChild(chip);
    });
  }

  function stageLabel() {
    if (pending.type === 'liga') {
      const round = state.league ? Math.min(state.league.round + 1, 18) : 1;
      return S.TIERS[state.tierIndex].label + ' — Rodada ' + round + '/18';
    }
    const labels = { grupos: 'Fase de Grupos', playoff: 'Playoff (2º x 3º)', oitavas: 'Oitavas de Final',
      quartas: 'Quartas de Final', semis: 'Semifinal', final: 'Final' };
    return S.COPA_TIERS[state.copaTierIndex].label + ' — ' + (labels[pending.part] || pending.part);
  }

  // ---------- Crests ----------
  homeCrestEl.textContent = club.crest.emblem;
  homeCrestEl.style.background = window.WSPClub.crestColor(club);
  homeCrestEl.style.borderColor = club.colors.detail;
  homeNameEl.textContent = squad.clubName;

  awayCrestEl.textContent = initials(pending.opponentName);
  awayCrestEl.style.background = colorForName(pending.opponentName);
  awayNameEl.textContent = pending.opponentName;

  stageEl.textContent = stageLabel();

  // ---------- Strength comparison ----------
  const userStrength = S.estimateSquadStrength(squad);
  const oppStrength = pending.opponentStrength != null ? pending.opponentStrength : 0.5;
  const homeGrl = Math.round(userStrength * 99);
  const awayGrl = Math.round(oppStrength * 99);
  const total = homeGrl + awayGrl || 1;

  homeGrlEl.textContent = homeGrl;
  awayGrlEl.textContent = awayGrl;
  homeFillEl.style.width = (homeGrl / total * 100) + '%';
  awayFillEl.style.width = (awayGrl / total * 100) + '%';
  grlHintEl.textContent = homeGrl > awayGrl
    ? squad.clubName + ' entra favorito neste confronto.'
    : homeGrl < awayGrl
    ? pending.opponentName + ' entra favorito neste confronto.'
    : 'Times equilibrados neste confronto.';

  // ---------- Recent form ----------
  let homeForm = [], awayForm = [];
  if (pending.type === 'liga' && state.league) {
    homeForm = recentForm(state.league.fixtures, 'user', 5);
    if (pending.opponentId) awayForm = recentForm(state.league.fixtures, pending.opponentId, 5);
  } else if (pending.type === 'copa' && state.copa && pending.part === 'grupos') {
    const myGroup = state.copa.groups.find((g) => g.members.some((m) => m.id === 'user'));
    if (myGroup) {
      homeForm = recentForm(myGroup.fixtures, 'user', 5);
      if (pending.opponentId) awayForm = recentForm(myGroup.fixtures, pending.opponentId, 5);
    }
  }
  renderForm(homeFormEl, homeForm, 5);
  renderForm(awayFormEl, awayForm, 5);

  enterBtn.addEventListener('click', () => {
    window.location.href = 'match.html?season=1';
  });
})();
