(() => {
  'use strict';

  // Tabela de dados de corrida: pneus, combustível, tempo de box e falhas
  // mecânicas/batidas. Formulas puras (sem DOM) pra serem consumidas pelo
  // motor de corrida (canvas) e pela tela de estratégia mais adiante.

  const TIRE_COMPOUNDS = {
    macio: { label: 'Macio', icon: '🔴', color: '#e63946', gripFactor: 1.08, wearRate: 2.6 },
    medio: { label: 'Médio', icon: '🟡', color: '#f4a300', gripFactor: 1.00, wearRate: 1.6 },
    duro: { label: 'Duro', icon: '⚪', color: '#e8e8e8', gripFactor: 0.94, wearRate: 1.0 },
    intermediario: { label: 'Intermediário', icon: '🟢', color: '#2a9d5c', gripFactor: 0.85, wearRate: 1.8 },
    chuva: { label: 'Chuva Intensa', icon: '🔵', color: '#1d4ed8', gripFactor: 0.72, wearRate: 1.4 },
  };

  const WEATHER_CONDITIONS = {
    seco: { label: 'Seco', icon: '☀️', idealTires: ['macio', 'medio', 'duro'] },
    chuva_leve: { label: 'Chuva Leve', icon: '🌦️', idealTires: ['intermediario'] },
    chuva_forte: { label: 'Chuva Forte', icon: '⛈️', idealTires: ['chuva'] },
  };

  // pneu fora da condição ideal perde grip — reflete o carro escorregando
  // no seco com pneu de chuva, ou "cozinhando" o intermediário no seco
  const TIRE_MISMATCH_PENALTY = 0.22;

  function tireEffectiveGrip(compoundKey, weatherKey) {
    const compound = TIRE_COMPOUNDS[compoundKey];
    const weather = WEATHER_CONDITIONS[weatherKey];
    if (!compound || !weather) return compound ? compound.gripFactor : 1;
    const ideal = weather.idealTires.includes(compoundKey);
    return ideal ? compound.gripFactor : compound.gripFactor * (1 - TIRE_MISMATCH_PENALTY);
  }

  // desgaste acumulado (%) depois de N voltas com o composto — 100% = precisa trocar
  function calcTireWear(compoundKey, laps, aggressiveness) {
    const compound = TIRE_COMPOUNDS[compoundKey];
    if (!compound) return 0;
    const mult = aggressiveness == null ? 1 : aggressiveness;
    return Math.min(100, compound.wearRate * laps * mult);
  }

  // quantas voltas o composto aguenta antes de bater na margem de segurança
  function calcStintLaps(compoundKey, safetyMarginPct) {
    const compound = TIRE_COMPOUNDS[compoundKey];
    if (!compound) return 0;
    const margin = safetyMarginPct == null ? 92 : safetyMarginPct;
    return Math.max(1, Math.floor(margin / compound.wearRate));
  }

  const FUEL_BASE_CONSUMPTION_PER_LAP = 1.8; // kg por volta, carro cheio de tanque
  const FUEL_SAFETY_MARGIN_PCT = 8; // reserva pra não parar sem combustível

  function calcFuelNeeded(totalLaps, consumptionPerLap) {
    const perLap = consumptionPerLap == null ? FUEL_BASE_CONSUMPTION_PER_LAP : consumptionPerLap;
    return Math.ceil(totalLaps * perLap * (1 + FUEL_SAFETY_MARGIN_PCT / 100));
  }

  function calcFuelForStint(stintLaps, consumptionPerLap) {
    const perLap = consumptionPerLap == null ? FUEL_BASE_CONSUMPTION_PER_LAP : consumptionPerLap;
    return Math.round(stintLaps * perLap * 10) / 10;
  }

  // ---------- Tempo de parada no box ----------
  // melhorar a estrutura de boxes (mecânicos + telemetria) e a engenharia
  // (motor/chassi/aerodinâmica) reduz o tempo parado — é o retorno concreto
  // de investir em "peças do carro" que o usuário pediu
  const PIT_STOP_BASE_MS = 25000; // nível 0 nos dois grupos
  const PIT_STOP_MIN_MS = 9000; // nível 20 nos dois grupos

  function pitStopMs(boxesLevel, engenhariaLevel) {
    const boxes = Math.max(0, Math.min(20, boxesLevel || 0));
    const engenharia = Math.max(0, Math.min(20, engenhariaLevel || 0));
    const weightedLevel = boxes * 0.7 + engenharia * 0.3;
    const t = PIT_STOP_BASE_MS - (PIT_STOP_BASE_MS - PIT_STOP_MIN_MS) * (weightedLevel / 20);
    return Math.round(t);
  }

  function pitStopMsForClub(club) {
    if (!club || !window.WSPF1Equipe) return PIT_STOP_BASE_MS;
    const boxesLevel = window.WSPF1Equipe.facilityGroupLevel(club, 'boxes');
    const engenhariaLevel = window.WSPF1Equipe.facilityGroupLevel(club, 'engenharia');
    return pitStopMs(boxesLevel, engenhariaLevel);
  }

  // ---------- Falhas mecânicas e batidas ----------
  // raro por design: o usuário pediu "não em todas as corridas, mas uma,
  // duas ou até três na temporada" — scheduleFailureEvents garante essa
  // contagem por temporada; failureChanceForRace/pickAffectedEntrant
  // decidem quem sofre o problema quando a corrida sorteada acontece
  const FAILURE_TYPES = {
    motor: { label: 'Falha de motor', icon: '💥', desc: 'O motor perdeu potência e o carro não termina a corrida.', reliabilityDept: 'motor' },
    cambio: { label: 'Falha de câmbio', icon: '⚙️', desc: 'Problema na caixa de câmbio tira o carro de pista.', reliabilityDept: 'chassi' },
    suspensao: { label: 'Falha de suspensão', icon: '🔩', desc: 'A suspensão cedeu e o carro precisou abandonar.', reliabilityDept: 'chassi' },
    colisao: { label: 'Batida', icon: '💢', desc: 'Colisão na pista encerra a corrida do piloto.', reliabilityDept: null },
  };

  const SEASON_FAILURE_EVENTS_MIN = 1;
  const SEASON_FAILURE_EVENTS_MAX = 3;

  // sorteia quais corridas da temporada (por índice) vão ter um evento dramático
  function scheduleFailureEvents(totalRaces) {
    if (!totalRaces || totalRaces <= 0) return [];
    const span = SEASON_FAILURE_EVENTS_MAX - SEASON_FAILURE_EVENTS_MIN + 1;
    const count = Math.min(totalRaces, SEASON_FAILURE_EVENTS_MIN + Math.floor(Math.random() * span));
    const indices = new Set();
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * totalRaces));
    }
    return Array.from(indices).sort((a, b) => a - b);
  }

  // risco de falha de uma equipe na corrida sorteada — cai conforme os
  // departamentos de motor/chassi sobem de nível (estrutura nível 20 quase não quebra)
  function failureChanceForRace(motorLevel, chassiLevel) {
    const base = 0.12;
    const min = 0.01;
    const avg = ((motorLevel || 0) + (chassiLevel || 0)) / 2;
    return base - (base - min) * (Math.max(0, Math.min(20, avg)) / 20);
  }

  function rollFailureType(motorLevel, chassiLevel) {
    const isMechanical = Math.random() < 0.7;
    const keys = Object.keys(FAILURE_TYPES).filter((k) => isMechanical ? FAILURE_TYPES[k].reliabilityDept : !FAILURE_TYPES[k].reliabilityDept);
    const pool = keys.length ? keys : Object.keys(FAILURE_TYPES);
    const key = pool[Math.floor(Math.random() * pool.length)];
    return Object.assign({ key }, FAILURE_TYPES[key]);
  }

  // entrants: [{ id, motorLevel, chassiLevel }] — sorteia quem é afetado
  // numa corrida marcada, com peso maior pra quem tem estrutura mais fraca
  function pickAffectedEntrant(entrants) {
    if (!entrants || !entrants.length) return null;
    const weights = entrants.map((e) => Math.max(0.001, failureChanceForRace(e.motorLevel, e.chassiLevel)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < entrants.length; i++) {
      r -= weights[i];
      if (r <= 0) return entrants[i];
    }
    return entrants[entrants.length - 1];
  }

  window.WSPF1Corrida = {
    TIRE_COMPOUNDS, WEATHER_CONDITIONS, TIRE_MISMATCH_PENALTY,
    tireEffectiveGrip, calcTireWear, calcStintLaps,
    FUEL_BASE_CONSUMPTION_PER_LAP, FUEL_SAFETY_MARGIN_PCT, calcFuelNeeded, calcFuelForStint,
    PIT_STOP_BASE_MS, PIT_STOP_MIN_MS, pitStopMs, pitStopMsForClub,
    FAILURE_TYPES, SEASON_FAILURE_EVENTS_MIN, SEASON_FAILURE_EVENTS_MAX,
    scheduleFailureEvents, failureChanceForRace, rollFailureType, pickAffectedEntrant,
  };
})();
