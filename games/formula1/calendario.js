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

  // 1 GP (fim de semana completo) por dia, e 4 dias de intervalo entre uma
  // temporada e a próxima — tempo pra trocar circuitos, fazer testes de
  // pré-temporada etc. Cooldown real, igual ao intervalo de partidas do
  // futebol, só que contado por fim de semana de GP em vez de por jogo.
  const GP_WEEKEND_COOLDOWN_DAYS = 1;
  const GP_WEEKEND_COOLDOWN_MS = GAME_DAY_REAL_MS * GP_WEEKEND_COOLDOWN_DAYS;
  const SEASON_GAP_DAYS = 4;
  const SEASON_GAP_MS = GAME_DAY_REAL_MS * SEASON_GAP_DAYS;

  // Pool baseado em dados reais: país/cidade e características técnicas
  // (extensão aproximada -> voltas pra ~305km, curvas, sentido, clima
  // predominante, altitude) de circuitos reais — os 22 do calendário 2026
  // (fonte: enciclopédia que o usuário mandou) mais 10 históricos famosos,
  // pra dar variedade real na rotação de temporadas. O NOME do circuito é
  // fictício ("sabor real": traduzido/evocado a partir do lugar de verdade,
  // nunca o nome oficial do GP/circuito real) — país e cidade continuam
  // reais, geografia não é marca registrada. Ex.: Silverstone (village =
  // "pedra de prata") -> "Circuito da Vila de Prata"; Zandvoort (holandês
  // "vau de areia") -> "Circuito Vau de Areia"; Interlagos (já é palavra
  // comum em português) -> "Circuito Entre Lagos".
  //
  // asfalto: aspereza/ondulação real do piso (mm) — some pra decisão de
  // altura do carro no treino livre (corrida.js/setupAsphaltMatchFactor).
  const CIRCUIT_POOL = [
    // -------- calendário real 2026 --------
    { name: 'Circuito Beira-Lago', pais: 'Austrália', cidade: 'Melbourne', laps: 58, type: 'misto', curves: 14, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'ondulado', mm: 6 } },
    { name: 'Circuito do Dragão', pais: 'China', cidade: 'Xangai', laps: 56, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito Oito do Oriente', pais: 'Japão', cidade: 'Suzuka', laps: 53, type: 'permanente', curves: 18, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'difícil', asfalto: { tipo: 'ondulado', mm: 6 } },
    { name: 'Circuito das Dunas', pais: 'Bahrein', cidade: 'Sakhir', laps: 57, type: 'permanente', curves: 15, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito da Corniche', pais: 'Arábia Saudita', cidade: 'Jidá', laps: 50, type: 'rua', curves: 27, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'difícil', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito das Palmeiras', pais: 'Estados Unidos', cidade: 'Miami', laps: 57, type: 'misto', curves: 19, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito da Ilha Notre', pais: 'Canadá', cidade: 'Montreal', laps: 70, type: 'misto', curves: 14, sentido: 'horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'ondulado', mm: 5 } },
    { name: 'Circuito das Ruas do Principado', pais: 'Mônaco', cidade: 'Monte Carlo', laps: 78, type: 'rua', curves: 19, sentido: 'horário', clima: 'instável', ultrapassagem: 'difícil', asfalto: { tipo: 'ondulado', mm: 6 } },
    { name: 'Circuito da Vila de Prata', pais: 'Reino Unido', cidade: 'Silverstone', laps: 52, type: 'permanente', curves: 18, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito das Florestas Ardenas', pais: 'Bélgica', cidade: 'Spa', laps: 44, type: 'permanente', curves: 19, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'média', asfalto: { tipo: 'ondulado', mm: 6 } },
    { name: 'Circuito do Anel Húngaro', pais: 'Hungria', cidade: 'Budapeste', laps: 70, type: 'permanente', curves: 14, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'difícil', asfalto: { tipo: 'medio', mm: 2 } },
    { name: 'Circuito Vau de Areia', pais: 'Países Baixos', cidade: 'Zandvoort', laps: 72, type: 'permanente', curves: 14, sentido: 'horário', clima: 'instável', ultrapassagem: 'difícil', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito Templo da Velocidade', pais: 'Itália', cidade: 'Monza', laps: 53, type: 'permanente', curves: 11, sentido: 'horário', clima: 'seco', ultrapassagem: 'fácil', asfalto: { tipo: 'medio', mm: 2 } },
    { name: 'Circuito Urbano da Capital', pais: 'Espanha', cidade: 'Madri', laps: 56, type: 'misto', curves: 20, sentido: 'horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito da Cidade dos Ventos', pais: 'Azerbaijão', cidade: 'Baku', laps: 51, type: 'rua', curves: 20, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito da Baía Noturna', pais: 'Singapura', cidade: 'Marina Bay', laps: 62, type: 'rua', curves: 19, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'difícil', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito das Colinas do Texas', pais: 'Estados Unidos', cidade: 'Austin', laps: 56, type: 'permanente', curves: 20, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 4 } },
    { name: 'Circuito da Grande Altitude', pais: 'México', cidade: 'Cidade do México', laps: 71, type: 'permanente', curves: 17, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito Entre Lagos', pais: 'Brasil', cidade: 'São Paulo', laps: 71, type: 'permanente', curves: 15, sentido: 'anti-horário', clima: 'chuvoso', ultrapassagem: 'média', asfalto: { tipo: 'ondulado', mm: 6 } },
    { name: 'Circuito da Avenida Dourada', pais: 'Estados Unidos', cidade: 'Las Vegas', laps: 50, type: 'rua', curves: 17, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito das Areias do Golfo', pais: 'Catar', cidade: 'Lusail', laps: 57, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'liso', mm: 1 } },
    { name: 'Circuito da Ilha Dourada', pais: 'Emirados Árabes Unidos', cidade: 'Abu Dhabi', laps: 58, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'liso', mm: 1 } },
    // -------- históricos famosos (dão variedade extra na rotação) --------
    { name: 'Circuito das Montanhas Eifel', pais: 'Alemanha', cidade: 'Nürburg', laps: 59, type: 'permanente', curves: 15, sentido: 'horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'ondulado', mm: 5 } },
    { name: 'Circuito do Rio Santerno', pais: 'Itália', cidade: 'Ímola', laps: 62, type: 'permanente', curves: 19, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'difícil', asfalto: { tipo: 'ondulado', mm: 5 } },
    { name: 'Circuito da Floresta Negra', pais: 'Alemanha', cidade: 'Hockenheim', laps: 67, type: 'permanente', curves: 17, sentido: 'horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 4 } },
    { name: 'Circuito do Algarve', pais: 'Portugal', cidade: 'Portimão', laps: 65, type: 'permanente', curves: 15, sentido: 'horário', clima: 'seco', ultrapassagem: 'difícil', asfalto: { tipo: 'ondulado', mm: 6 } },
    { name: 'Circuito do Planalto Africano', pais: 'África do Sul', cidade: 'Joanesburgo', laps: 67, type: 'permanente', curves: 16, sentido: 'anti-horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito do Bósforo', pais: 'Turquia', cidade: 'Istambul', laps: 57, type: 'permanente', curves: 14, sentido: 'anti-horário', clima: 'instável', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 3 } },
    { name: 'Circuito das Monções', pais: 'Malásia', cidade: 'Sepang', laps: 55, type: 'permanente', curves: 15, sentido: 'horário', clima: 'chuvoso', ultrapassagem: 'fácil', asfalto: { tipo: 'medio', mm: 2 } },
    { name: 'Circuito das Montanhas Estírias', pais: 'Áustria', cidade: 'Spielberg', laps: 71, type: 'permanente', curves: 10, sentido: 'horário', clima: 'instável', ultrapassagem: 'fácil', asfalto: { tipo: 'medio', mm: 2 } },
    { name: 'Circuito do Mistral', pais: 'França', cidade: 'Le Castellet', laps: 53, type: 'permanente', curves: 15, sentido: 'horário', clima: 'seco', ultrapassagem: 'média', asfalto: { tipo: 'medio', mm: 2 } },
    { name: 'Circuito das Colinas Toscanas', pais: 'Itália', cidade: 'Mugello', laps: 58, type: 'permanente', curves: 15, sentido: 'horário', clima: 'instável', ultrapassagem: 'difícil', asfalto: { tipo: 'ondulado', mm: 5 } },
  ];

  const CLIMATE_RAIN_CHANCE = { seco: 0.08, instável: 0.28, chuvoso: 0.5 };
  const ASPHALT_LABELS = {
    liso: 'Tapete liso (~1mm de ondulação)',
    medio: 'Poucas ondulações (~2-4mm)',
    ondulado: 'Cheio de ondulações e trepidação (~5-6mm)',
  };

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
        pais: circuit.pais,
        cidade: circuit.cidade,
        laps: circuit.laps,
        type: circuit.type,
        curves: circuit.curves,
        sentido: circuit.sentido,
        clima: circuit.clima,
        ultrapassagem: circuit.ultrapassagem,
        asfalto: circuit.asfalto,
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
      nextWeekendAt: null, // timestamp: quando o próximo GP libera (cooldown de 1 dia)
      nextSeasonAt: null, // timestamp: quando a próxima temporada libera (gap de 4 dias)
      seasonOver: false,
    };
  }

  // temporadas salvas antes da reforma de dados reais de circuito (país,
  // cidade, curvas, sentido, clima, ultrapassagem, asfalto) só tinham nome e
  // voltas — preenche o que falta puxando do CIRCUIT_POOL atual, por nome
  // quando existe, senão por um circuito determinístico do pool
  function backfillWeekendCircuitData(state) {
    if (!state.weekends) return false;
    let changed = false;
    state.weekends.forEach((w, i) => {
      if (w.pais && w.cidade && w.asfalto) return;
      const src = CIRCUIT_POOL.find((c) => c.name === w.circuit) || CIRCUIT_POOL[i % CIRCUIT_POOL.length];
      w.circuit = src.name;
      w.pais = src.pais;
      w.cidade = src.cidade;
      w.laps = w.laps || src.laps;
      w.type = src.type;
      w.curves = src.curves;
      w.sentido = src.sentido;
      w.clima = src.clima;
      w.ultrapassagem = src.ultrapassagem;
      w.asfalto = src.asfalto;
      changed = true;
    });
    return changed;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        let changed = false;
        if (!parsed.motorPerformance) {
          parsed.motorPerformance = window.WSPF1Corrida ? window.WSPF1Corrida.rollMotorPerformances(null) : {};
          changed = true;
        }
        if (parsed.nextWeekendAt === undefined) { parsed.nextWeekendAt = null; changed = true; }
        if (parsed.nextSeasonAt === undefined) { parsed.nextSeasonAt = null; changed = true; }
        if (backfillWeekendCircuitData(parsed)) changed = true;
        if (changed) saveState(parsed);
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

  // botão de teste: libera o próximo GP / a próxima temporada na hora,
  // sem esperar o cooldown de verdade — só zera os timestamps, não mexe
  // em mais nada do progresso da temporada
  function skipCooldown(state) {
    state.nextWeekendAt = null;
    state.nextSeasonAt = null;
    saveState(state);
    return state;
  }

  // botão de teste: apaga a temporada atual e recomeça do zero (temporada
  // 1, calendário novo, sem cooldown) — não mexe no grid de rivais nem no
  // elenco/escuderia do jogador, só no progresso da temporada em si
  function resetSeason() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    const fresh = freshState();
    saveState(fresh);
    return fresh;
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

  function isWeekendAvailable(state) {
    return !state.nextWeekendAt || Date.now() >= state.nextWeekendAt;
  }

  function msUntilNextWeekend(state) {
    if (!state.nextWeekendAt) return 0;
    return Math.max(0, state.nextWeekendAt - Date.now());
  }

  function isNewSeasonAvailable(state) {
    return !state.nextSeasonAt || Date.now() >= state.nextSeasonAt;
  }

  function msUntilNewSeason(state) {
    if (!state.nextSeasonAt) return 0;
    return Math.max(0, state.nextSeasonAt - Date.now());
  }

  function daysRemaining(ms) {
    return Math.max(0, Math.ceil(ms / GAME_DAY_REAL_MS));
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Disponível agora';
    const days = daysRemaining(ms);
    return days === 1 ? '1 dia' : days + ' dias';
  }

  // acerto do carro escolhido no treino livre — vale pro resto do fim de
  // semana (classificatória, sprint e corrida usam o mesmo weekend.carSetup)
  function applyCarSetup(state, setup) {
    const w = currentWeekend(state);
    if (!w) return { ok: false };
    w.carSetup = setup;
    saveState(state);
    return { ok: true };
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
      if (isSeasonOver(state)) {
        state.nextSeasonAt = Date.now() + SEASON_GAP_MS;
      } else {
        state.nextWeekendAt = Date.now() + GP_WEEKEND_COOLDOWN_MS;
      }
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
    if (!isNewSeasonAvailable(state)) return state;
    const previousCircuitNames = (state.weekends || []).map((w) => w.circuit);
    const fresh = freshState(previousCircuitNames, state.motorPerformance);
    fresh.seasonNumber = (state.seasonNumber || 1) + 1;
    saveState(fresh);
    return fresh;
  }

  window.WSPF1Calendario = {
    GAME_DAY_REAL_MS, SEASON_RACE_COUNT, SPRINT_WEEKEND_COUNT, CIRCUIT_POOL, SESSION_TYPES, CLIMATE_RAIN_CHANCE, ASPHALT_LABELS,
    RACE_POINTS, SPRINT_POINTS, GP_WEEKEND_COOLDOWN_DAYS, SEASON_GAP_DAYS,
    loadState, saveState, freshState, selectSeasonCircuits,
    currentWeekend, currentSessionType, isSeasonOver, applyCarSetup,
    isWeekendAvailable, msUntilNextWeekend, isNewSeasonAvailable, msUntilNewSeason, formatCountdown,
    resolveFreePractice, resolveQualifying, recordSessionResult,
    driverStandings, constructorStandings, startNewSeason,
    skipCooldown, resetSeason,
  };
})();
