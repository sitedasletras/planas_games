(() => {
  'use strict';

  const S = window.WSPSeason;
  const squad = window.WSPSquad.loadSquad();
  const state = S.loadState();
  const cs = state.careerStats || S.freshCareerStats();

  const trophyRowEl = document.getElementById('trophy-row');
  const scorersRowEl = document.getElementById('scorers-row');
  const wdlBarEl = document.getElementById('wdl-bar');
  const winsValEl = document.getElementById('wins-val');
  const drawsValEl = document.getElementById('draws-val');
  const lossesValEl = document.getElementById('losses-val');
  const recordListEl = document.getElementById('record-list');

  function trophyItem(icon, label, count, isText) {
    const item = document.createElement('div');
    item.className = 'trophy-item';
    const iconEl = document.createElement('div');
    iconEl.className = 'trophy-icon';
    iconEl.textContent = icon;
    const countEl = document.createElement('div');
    countEl.className = 'trophy-count' + (isText ? ' text' : '');
    countEl.textContent = count;
    const labelEl = document.createElement('div');
    labelEl.className = 'trophy-label';
    labelEl.textContent = label;
    item.appendChild(iconEl);
    item.appendChild(countEl);
    item.appendChild(labelEl);
    return item;
  }

  trophyRowEl.appendChild(trophyItem('🏆', 'Liga', cs.trophiesLiga));
  trophyRowEl.appendChild(trophyItem('🏅', 'Copa', cs.trophiesCopa));

  const total = Math.max(1, cs.wins + cs.draws + cs.losses);
  function seg(className, pct) {
    const div = document.createElement('div');
    div.className = 'wdl-seg ' + className;
    div.style.width = pct + '%';
    return div;
  }
  wdlBarEl.appendChild(seg('win', cs.wins / total * 100));
  wdlBarEl.appendChild(seg('draw', cs.draws / total * 100));
  wdlBarEl.appendChild(seg('loss', cs.losses / total * 100));

  winsValEl.textContent = cs.wins;
  drawsValEl.textContent = cs.draws;
  lossesValEl.textContent = cs.losses;

  function recordRow(label, value) {
    const row = document.createElement('div');
    row.className = 'record-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'record-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'record-value';
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    recordListEl.appendChild(row);
  }

  const saldo = cs.goalsFor - cs.goalsAgainst;
  recordRow('Partidas jogadas', cs.matchesPlayed);
  recordRow('Gols marcados', cs.goalsFor);
  recordRow('Gols sofridos', cs.goalsAgainst);
  recordRow('Saldo de gols', (saldo >= 0 ? '+' : '') + saldo);
  recordRow('Maior vitória', cs.biggestWin
    ? cs.biggestWin.golsFor + '-' + cs.biggestWin.golsAgainst + ' x ' + cs.biggestWin.opponent + ' (' + cs.biggestWin.competition + ')'
    : '—');

  function playerLabel(p) { return p.name || ('#' + p.number); }

  function topBy(field) {
    return squad.players.reduce((best, p) => (p[field] || 0) > (best ? best[field] || 0 : -1) ? p : best, null);
  }

  const topScorer = topBy('careerGoals');
  const topAssister = topBy('careerAssists');
  scorersRowEl.appendChild(trophyItem('⚽', 'Artilheiro', topScorer && topScorer.careerGoals
    ? playerLabel(topScorer) + ' (' + topScorer.careerGoals + ')' : '—', true));
  scorersRowEl.appendChild(trophyItem('🎯', 'Assistências', topAssister && topAssister.careerAssists
    ? playerLabel(topAssister) + ' (' + topAssister.careerAssists + ')' : '—', true));
})();
