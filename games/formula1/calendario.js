(() => {
  'use strict';

  // Temporada de F1: 21 finais de semana de GP, 7 dos quais (distribuídos ao
  // longo do calendário, não amontoados) também têm Corrida Sprint — nesses
  // fins de semana o circuito recebe treino livre, classificatória, sprint
  // E corrida principal. Falhas mecânicas/batidas de 1 a 3 corridas da
  // temporada são sorteadas de uma vez via corrida.js.

  const STORAGE_KEY = 'wsp_f1_temporada_v1';
  const GAME_DAY_REAL_MS = 2 * 60 * 60 * 1000; // mesma escala do futebol

  const SEASON_RACE_COUNT = 21;
  const SPRINT_WEEKEND_COUNT = 7;

  const CIRCUIT_POOL = [
    { name: 'Autódromo das Bandeiras', laps: 58 },
    { name: 'Circuito da Serra Encantada', laps: 52 },
    { name: 'Pista do Litoral Dourado', laps: 63 },
    { name: 'Anel de Ipanema', laps: 68 },
    { name: 'Circuito do Cerrado', laps: 55 },
    { name: 'Autódromo Vale das Águias', laps: 57 },
    { name: 'Traçado da Baía Azul', laps: 60 },
    { name: 'Circuito Terras Altas', laps: 50 },
    { name: 'Pista Real do Norte', laps: 54 },
    { name: 'Anel Metropolitano', laps: 66 },
    { name: 'Circuito das Cataratas', laps: 53 },
    { name: 'Autódromo Costa Esmeralda', laps: 59 },
    { name: 'Traçado do Deserto Vermelho', laps: 56 },
    { name: 'Circuito Ilha do Sol', laps: 61 },
    { name: 'Pista Nevoeiro', laps: 49 },
    { name: 'Anel Real Imperial', laps: 52 },
    { name: 'Circuito Vale Dourado', laps: 58 },
    { name: 'Autódromo dos Ventos', laps: 64 },
    { name: 'Traçado da Montanha Negra', laps: 51 },
    { name: 'Circuito Grande Baía', laps: 62 },
    { name: 'Pista Estrela do Sul', laps: 57 },
  ];

  const SESSION_TYPES = {
    treino_livre: { label: 'Treino Livre', icon: '🔧' },
    classificatoria: { label: 'Classificatória', icon: '⏱️' },
    sprint: { label: 'Corrida Sprint', icon: '🏃' },
    corrida: { label: 'Corrida', icon: '🏁' },
  };

  const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // espalha os 7 fins de semana de sprint ao longo dos 21, evitando ficarem
  // amontoados numa ponta só do calendário
  function distributeSprintWeekends(totalRaces, sprintCount) {
    const step = totalRaces / sprintCount;
    const set = new Set();
    for (let i = 0; i < sprintCount; i++) {
      const base = Math.floor(i * step + step / 2);
      const jitter = Math.floor((Math.random() - 0.5) * Math.max(1, Math.min(2, step - 1)));
      let idx = Math.max(0, Math.min(totalRaces - 1, base + jitter));
      while (set.has(idx) && idx < totalRaces - 1) idx++;
      set.add(idx);
    }
    return set;
  }

  function buildCalendar() {
    const circuits = shuffle(CIRCUIT_POOL).slice(0, SEASON_RACE_COUNT);
    const sprintSet = distributeSprintWeekends(SEASON_RACE_COUNT, SPRINT_WEEKEND_COUNT);
    const failureSet = new Set(window.WSPF1Corrida ? window.WSPF1Corrida.scheduleFailureEvents(SEASON_RACE_COUNT) : []);
    return circuits.map((circuit, i) => {
      const sessions = ['treino_livre', 'classificatoria'];
      if (sprintSet.has(i)) sessions.push('sprint');
      sessions.push('corrida');
      return {
        index: i,
        circuit: circuit.name,
        laps: circuit.laps,
        hasSprint: sprintSet.has(i),
        hasFailureEvent: failureSet.has(i),
        sessions,
        sessionIdx: 0,
        gridOrder: null, // definido pela classificatória, usado por sprint e corrida
        results: {},
        done: false,
      };
    });
  }

  function freshState() {
    return {
      seasonNumber: 1,
      weekends: buildCalendar(),
      weekendIndex: 0,
      points: {}, // entrantId -> pontos acumulados na temporada
      seasonOver: false,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = freshState();
    saveState(fresh);
    return fresh;
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function currentWeekend(state) {
    if (state.weekendIndex >= state.weekends.length) return null;
    return state.weekends[state.weekendIndex];
  }

  function currentSessionType(state) {
    const w = currentWeekend(state);
    if (!w) return null;
    if (w.sessionIdx >= w.sessions.length) return null;
    return w.sessions[w.sessionIdx];
  }

  function isSeasonOver(state) {
    return state.weekendIndex >= state.weekends.length;
  }

  // resolve treino livre e classificatória sem simulação visual — só a
  // corrida e a sprint passam pelo motor de corrida (corridamotor.js)
  function resolveInstantSession(entrants, bonusTrait) {
    return entrants
      .map((e) => ({ id: e.id, score: e.pace + (Math.random() - 0.5) * 14 + (bonusTrait && e.traits && e.traits.includes(bonusTrait) ? 5 : 0) }))
      .sort((a, b) => b.score - a.score)
      .map((e) => e.id);
  }

  function resolveFreePractice(entrants) {
    return resolveInstantSession(entrants, null);
  }

  function resolveQualifying(entrants) {
    return resolveInstantSession(entrants, 'qualy');
  }

  function awardPoints(state, order, table) {
    order.forEach((entrantId, i) => {
      if (i >= table.length) return;
      state.points[entrantId] = (state.points[entrantId] || 0) + table[i];
    });
  }

  // registra o resultado da sessão atual (array de entrantId em ordem de
  // chegada/classificação) e avança pro próximo tipo de sessão do f.d.s.
  function recordSessionResult(state, order) {
    const w = currentWeekend(state);
    const type = currentSessionType(state);
    if (!w || !type) return { ok: false };
    w.results[type] = order;
    if (type === 'classificatoria') w.gridOrder = order;
    if (type === 'sprint') awardPoints(state, order, SPRINT_POINTS);
    if (type === 'corrida') awardPoints(state, order, RACE_POINTS);
    w.sessionIdx++;
    if (w.sessionIdx >= w.sessions.length) {
      w.done = true;
      state.weekendIndex++;
    }
    saveState(state);
    return { ok: true, weekendDone: w.done, seasonOver: isSeasonOver(state) };
  }

  function driverStandings(state, entrants) {
    return entrants
      .map((e) => ({ id: e.id, name: e.driverName, team: e.teamName, isPlayer: e.isPlayer, points: state.points[e.id] || 0 }))
      .sort((a, b) => b.points - a.points);
  }

  function constructorStandings(state, entrants) {
    const byTeam = {};
    entrants.forEach((e) => {
      if (!byTeam[e.teamId]) byTeam[e.teamId] = { teamId: e.teamId, teamName: e.teamName, isPlayer: e.isPlayer, points: 0 };
      byTeam[e.teamId].points += state.points[e.id] || 0;
    });
    return Object.values(byTeam).sort((a, b) => b.points - a.points);
  }

  function startNewSeason(state) {
    const fresh = freshState();
    fresh.seasonNumber = (state.seasonNumber || 1) + 1;
    saveState(fresh);
    return fresh;
  }

  window.WSPF1Calendario = {
    GAME_DAY_REAL_MS, SEASON_RACE_COUNT, SPRINT_WEEKEND_COUNT, CIRCUIT_POOL, SESSION_TYPES,
    RACE_POINTS, SPRINT_POINTS,
    loadState, saveState, freshState,
    currentWeekend, currentSessionType, isSeasonOver,
    resolveFreePractice, resolveQualifying, recordSessionResult,
    driverStandings, constructorStandings, startNewSeason,
  };
})();
