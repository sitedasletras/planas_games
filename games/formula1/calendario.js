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

  // Pool bem maior que as 21 vagas de uma temporada — é o que permite trocar
  // pelo menos metade do calendário a cada nova temporada (selectSeasonCircuits)
  // em vez de repetir sempre a mesma lista, como o usuário pediu. "tipo" é só
  // sabor (inspirado na mistura rua/permanente/misto de circuitos reais) —
  // nomes fictícios, sem usar os nomes reais de GPs.
  //
  // curves = número de curvas; sentido = horário/anti-horário; clima = tendência
  // predominante do circuito (usada de verdade em corridamotor.js pra pesar a
  // chance de chuva na corrida, não é só decorativo); ultrapassagem = quão fácil
  // é passar ali (afeta pouco a simulação hoje, mas já fica documentado — campos
  // inspirados na "planilha" de circuitos que o usuário mandou).
  const CIRCUIT_POOL = [
    { name: 'Autódromo das Bandeiras', laps: 58, type: 'permanente', curves: 15, sentido: 'horário', clima: 'seco', ultrapassagem: 'média' },
    { name: 'Circuito da Serra Encantada', laps: 52, type: 'permanente', curves: 13, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'difícil' },
    { name: 'Pista do Litoral Dourado', laps: 63, type: 'misto', curves: 17, sentido: 'horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Anel de Ipanema', laps: 68, type: 'rua', curves: 21, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'difícil' },
    { name: 'Circuito do Cerrado', laps: 55, type: 'permanente', curves: 14, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Autódromo Vale das Águias', laps: 57, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'média' },
    { name: 'Traçado da Baía Azul', laps: 60, type: 'misto', curves: 18, sentido: 'horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Circuito Terras Altas', laps: 50, type: 'permanente', curves: 12, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Pista Real do Norte', laps: 54, type: 'permanente', curves: 15, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'média' },
    { name: 'Anel Metropolitano', laps: 66, type: 'rua', curves: 20, sentido: 'horário', clima: 'instável', ultrapassagem: 'difícil' },
    { name: 'Circuito das Cataratas', laps: 53, type: 'permanente', curves: 14, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'média' },
    { name: 'Autódromo Costa Esmeralda', laps: 59, type: 'misto', curves: 16, sentido: 'horário', clima: 'seco', ultrapassagem: 'média' },
    { name: 'Traçado do Deserto Vermelho', laps: 56, type: 'permanente', curves: 13, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Circuito Ilha do Sol', laps: 61, type: 'misto', curves: 17, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Pista Nevoeiro', laps: 49, type: 'permanente', curves: 12, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'difícil' },
    { name: 'Anel Real Imperial', laps: 52, type: 'rua', curves: 19, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'difícil' },
    { name: 'Circuito Vale Dourado', laps: 58, type: 'permanente', curves: 15, sentido: 'horário', clima: 'seco', ultrapassagem: 'média' },
    { name: 'Autódromo dos Ventos', laps: 64, type: 'misto', curves: 18, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Traçado da Montanha Negra', laps: 51, type: 'permanente', curves: 13, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'difícil' },
    { name: 'Circuito Grande Baía', laps: 62, type: 'misto', curves: 17, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Pista Estrela do Sul', laps: 57, type: 'permanente', curves: 14, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Circuito Rua Nova', laps: 72, type: 'rua', curves: 22, sentido: 'horário', clima: 'instável', ultrapassagem: 'difícil' },
    { name: 'Autódromo Portal do Sul', laps: 56, type: 'permanente', curves: 15, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média' },
    { name: 'Circuito das Ilhas Claras', laps: 60, type: 'misto', curves: 18, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'média' },
    { name: 'Traçado Real da Baía', laps: 70, type: 'rua', curves: 20, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'difícil' },
    { name: 'Circuito Vento Norte', laps: 54, type: 'permanente', curves: 13, sentido: 'horário', clima: 'instável', ultrapassagem: 'fácil' },
    { name: 'Autódromo Fronteira Dourada', laps: 58, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média' },
    { name: 'Circuito da Lagoa Azul', laps: 62, type: 'misto', curves: 17, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'média' },
    { name: 'Pista Alto da Serra', laps: 51, type: 'permanente', curves: 14, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'difícil' },
    { name: 'Circuito Rua Central', laps: 74, type: 'rua', curves: 23, sentido: 'horário', clima: 'seco', ultrapassagem: 'difícil' },
    { name: 'Autódromo Terras do Sol', laps: 57, type: 'permanente', curves: 15, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Circuito Costa Norte', laps: 61, type: 'misto', curves: 16, sentido: 'horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Traçado das Palmeiras', laps: 68, type: 'rua', curves: 21, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'difícil' },
    { name: 'Circuito Grande Vale', laps: 55, type: 'permanente', curves: 13, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Autódromo Colinas Verdes', laps: 59, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Circuito Baía Serena', laps: 63, type: 'misto', curves: 18, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'média' },
    { name: 'Pista Duna Dourada', laps: 52, type: 'permanente', curves: 12, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'fácil' },
    { name: 'Circuito Rua do Porto', laps: 71, type: 'rua', curves: 22, sentido: 'horário', clima: 'instável', ultrapassagem: 'difícil' },
    { name: 'Autódromo Planalto Norte', laps: 56, type: 'permanente', curves: 14, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média' },
    { name: 'Circuito Vale de Prata', laps: 60, type: 'misto', curves: 17, sentido: 'horário', clima: 'instável', ultrapassagem: 'média' },
    { name: 'Traçado Litoral Sul', laps: 69, type: 'rua', curves: 20, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'difícil' },
    { name: 'Circuito Estrela Polar', laps: 53, type: 'permanente', curves: 13, sentido: 'horário', clima: 'instável', ultrapassagem: 'fácil' },
  ];

  const CLIMATE_RAIN_CHANCE = { seco: 0.08, instável: 0.28, chuvoso: 0.5 };

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

  // garante que pelo menos metade do calendário troque de uma temporada pra
  // outra: prioriza circuitos que não estavam na lista anterior e só reusa
  // os antigos pra completar as 21 vagas, até um teto de metade repetida
  function selectSeasonCircuits(previousNames) {
    const prevSet = new Set(previousNames || []);
    const maxCarryover = Math.floor(SEASON_RACE_COUNT / 2);
    const freshPool = shuffle(CIRCUIT_POOL.filter((c) => !prevSet.has(c.name)));
    const repeatPool = shuffle(CIRCUIT_POOL.filter((c) => prevSet.has(c.name)));
    const chosen = [];
    while (chosen.length < SEASON_RACE_COUNT && freshPool.length) chosen.push(freshPool.pop());
    while (chosen.length < SEASON_RACE_COUNT && repeatPool.length
      && chosen.filter((c) => prevSet.has(c.name)).length < maxCarryover) {
      chosen.push(repeatPool.pop());
    }
    while (chosen.length < SEASON_RACE_COUNT && (freshPool.length || repeatPool.length)) {
      chosen.push(freshPool.length ? freshPool.pop() : repeatPool.pop());
    }
    return shuffle(chosen);
  }

  function buildCalendar(previousCircuitNames) {
    const circuits = selectSeasonCircuits(previousCircuitNames);
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
        type: circuit.type,
        curves: circuit.curves,
        sentido: circuit.sentido,
        clima: circuit.clima,
        ultrapassagem: circuit.ultrapassagem,
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

  function freshState(previousCircuitNames, previousMotorPerformance) {
    const motorPerformance = window.WSPF1Corrida
      ? window.WSPF1Corrida.rollMotorPerformances(previousMotorPerformance)
      : {};
    return {
      seasonNumber: 1,
      weekends: buildCalendar(previousCircuitNames),
      weekendIndex: 0,
      points: {}, // entrantId -> pontos acumulados na temporada
      motorPerformance, // nome do motor -> % de rendimento nesta temporada
      seasonOver: false,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.motorPerformance) {
          parsed.motorPerformance = window.WSPF1Corrida ? window.WSPF1Corrida.rollMotorPerformances(null) : {};
          saveState(parsed);
        }
        return parsed;
      }
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
    const previousCircuitNames = (state.weekends || []).map((w) => w.circuit);
    const fresh = freshState(previousCircuitNames, state.motorPerformance);
    fresh.seasonNumber = (state.seasonNumber || 1) + 1;
    saveState(fresh);
    return fresh;
  }

  window.WSPF1Calendario = {
    GAME_DAY_REAL_MS, SEASON_RACE_COUNT, SPRINT_WEEKEND_COUNT, CIRCUIT_POOL, SESSION_TYPES, CLIMATE_RAIN_CHANCE,
    RACE_POINTS, SPRINT_POINTS,
    loadState, saveState, freshState, selectSeasonCircuits,
    currentWeekend, currentSessionType, isSeasonOver,
    resolveFreePractice, resolveQualifying, recordSessionResult,
    driverStandings, constructorStandings, startNewSeason,
  };
})();
