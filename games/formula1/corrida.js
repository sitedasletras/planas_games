(() => {
  'use strict';

  // Tabela de dados de corrida: pneus, combustível, tempo de box e falhas
  // mecânicas/batidas. Formulas puras (sem DOM) pra serem consumidas pelo
  // motor de corrida (canvas) e pela tela de estratégia mais adiante.

  // wearRate calibrado pra que NENHUM composto seco aguente uma corrida
  // inteira sem trocar — o circuito mais curto da temporada tem 44 voltas,
  // então até o duro (o mais durável) precisa ficar bem abaixo disso
  // (stint(90%) = 90/wearRate voltas): macio 25, médio 35, duro 43 — sempre
  // exige pelo menos 1 parada, em qualquer circuito, com qualquer composto
  const TIRE_COMPOUNDS = {
    macio: { label: 'Macio', icon: '🔴', color: '#e63946', gripFactor: 1.08, wearRate: 3.6 },
    medio: { label: 'Médio', icon: '🟡', color: '#f4a300', gripFactor: 1.00, wearRate: 2.6 },
    duro: { label: 'Duro', icon: '⚪', color: '#e8e8e8', gripFactor: 0.94, wearRate: 2.1 },
    intermediario: { label: 'Intermediário', icon: '🟢', color: '#2a9d5c', gripFactor: 0.85, wearRate: 1.8 },
    chuva: { label: 'Chuva Intensa', icon: '🔵', color: '#1d4ed8', gripFactor: 0.72, wearRate: 1.4 },
  };

  // Clima em 4 níveis (pedido explícito do usuário, com valores de mm de
  // referência): Seco -> Ventos Fortes -> Chuva Grossa -> Chuva Intensa.
  // A ordem do array é o que permite a regra "nunca pula de nível" nas
  // funções de previsão/transição mais abaixo — nunca usar os objetos
  // fora dessa ordem.
  const WEATHER_TIER_KEYS = ['seco', 'ventos_fortes', 'chuva_grossa', 'chuva_intensa'];
  const WEATHER_CONDITIONS = {
    seco: { label: 'Clima Seco', icon: '☀️', mm: 0, idealTires: ['macio', 'medio', 'duro'] },
    ventos_fortes: { label: 'Ventos Fortes', icon: '🌬️', mm: 2, idealTires: ['intermediario'] },
    chuva_grossa: { label: 'Chuva Grossa', icon: '🌧️', mm: 4, idealTires: ['intermediario'] },
    chuva_intensa: { label: 'Chuva Intensa', icon: '⛈️', mm: 6, idealTires: ['chuva'] },
  };

  // RNG determinístico a partir de uma string (mesma semente = mesma
  // sequência sempre) — corrida.js não tinha isso ainda; corrida.html já
  // tinha uma cópia local pro traçado do circuito, esta é a versão que
  // qualquer módulo (inclusive o motor de corrida) pode reusar.
  function seededRng(seedStr) {
    let h = 1779033703 ^ (seedStr || '').length;
    for (let i = 0; i < (seedStr || '').length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  // temperatura de referência por clima predominante do circuito (mesmas
  // faixas que corrida.html já usava antes de largar)
  const CLIMA_TEMP_RANGE = { seco: [24, 34], instável: [16, 26], chuvoso: [14, 22] };
  const WEATHER_TIER_COOL_PER_STEP = 3; // cada nível de clima mais chuvoso esfria ~3°C

  // gera a sequência de clima (E temperatura) da sessão INTEIRA, volta a
  // volta, de forma determinística (mesma semente = mesma sequência) — é
  // o que permite a tabela de previsão (início/meio/fim) mostrar
  // exatamente o que vai acontecer, e não um palpite solto: tanto a
  // prévia quanto a corrida ao vivo chamam esta mesma função com a mesma
  // semente. climaKey é o clima PREDOMINANTE do circuito (seco/instável/
  // chuvoso) — define a chance de mudança a cada volta e o clima inicial
  // mais provável. Nunca pula de nível (no máximo ±1 por volta), e pode
  // perfeitamente ficar parado no mesmo nível a sessão inteira.
  function buildWeatherTimeline(seedStr, totalLaps, climaKey) {
    const rng = seededRng(seedStr);
    const laps = Math.max(1, Math.round(totalLaps || 1));
    const changeChance = { seco: 0.05, instável: 0.14, chuvoso: 0.22 }[climaKey] || 0.1;
    let tierIdx = 0;
    if (climaKey === 'chuvoso' && rng() < 0.35) tierIdx = 1 + Math.floor(rng() * 2);
    else if (climaKey === 'instável' && rng() < 0.2) tierIdx = 1;
    const range = CLIMA_TEMP_RANGE[climaKey] || [18, 28];
    const tiers = new Array(laps);
    const temps = new Array(laps);
    for (let lap = 0; lap < laps; lap++) {
      tiers[lap] = WEATHER_TIER_KEYS[tierIdx];
      const base = range[0] + rng() * (range[1] - range[0]);
      temps[lap] = Math.round(base - tierIdx * WEATHER_TIER_COOL_PER_STEP);
      if (rng() < changeChance) {
        const dir = rng() < 0.5 ? -1 : 1;
        tierIdx = Math.max(0, Math.min(WEATHER_TIER_KEYS.length - 1, tierIdx + dir));
      }
    }
    return { tiers, temps };
  }

  // amostra 3 pontos (início/meio/fim) de uma timeline pra tabela de
  // previsão pré-sessão — sempre a MESMA timeline que a sessão ao vivo
  // vai seguir, então a previsão nunca "mente"
  function weatherForecastCheckpoints(timeline, totalLaps) {
    const laps = Math.max(1, Math.round(totalLaps || 1));
    const idxStart = 0;
    const idxMid = Math.floor((laps - 1) / 2);
    const idxEnd = laps - 1;
    return [idxStart, idxMid, idxEnd].map((idx) => ({
      lap: idx + 1,
      tier: timeline.tiers[idx],
      tempC: timeline.temps[idx],
    }));
  }

  // clima mais severo (mais mm) aumenta o desgaste do pneu e o consumo de
  // combustível — pedido explícito do usuário, além do grip que já mudava
  // com pneu errado pra condição
  const WEATHER_WEAR_MM_SPREAD = 0.03; // +3% de desgaste por mm de chuva
  const WEATHER_FUEL_MM_SPREAD = 0.015; // +1.5% de consumo por mm de chuva

  function weatherWearMult(weatherKey) {
    const w = WEATHER_CONDITIONS[weatherKey];
    if (!w) return 1;
    return 1 + w.mm * WEATHER_WEAR_MM_SPREAD;
  }

  function weatherFuelMult(weatherKey) {
    const w = WEATHER_CONDITIONS[weatherKey];
    if (!w) return 1;
    return 1 + w.mm * WEATHER_FUEL_MM_SPREAD;
  }

  // ---------- Especialidade de clima por piloto ----------
  // pedido explícito do usuário: cada piloto pode ser especialista em UM
  // dos 4 climas (ou nenhum). A matriz é fixa (não uma fórmula de
  // distância simples) — os climas formam 2 grupos, seco (Seco + Ventos
  // Fortes) e molhado (Chuva Grossa + Chuva Intensa): 100% na própria
  // especialidade, 50% no "parceiro" do mesmo grupo, 0% no clima mais
  // próximo do grupo oposto, -25% no mais distante. Os valores abaixo são
  // a referência pra potência 10 (potência 0-20, escala linearmente —
  // potência 5 = metade do valor, potência 20 = dobro, potência 0 = nulo).
  const WEATHER_SPECIALTY_FACTOR = {
    seco: { seco: 1, ventos_fortes: 0.5, chuva_grossa: 0, chuva_intensa: -0.25 },
    ventos_fortes: { seco: 0.5, ventos_fortes: 1, chuva_grossa: 0, chuva_intensa: -0.25 },
    chuva_grossa: { seco: -0.25, ventos_fortes: 0, chuva_grossa: 1, chuva_intensa: 0.5 },
    chuva_intensa: { seco: -0.25, ventos_fortes: 0, chuva_grossa: 0.5, chuva_intensa: 1 },
  };
  const WEATHER_SPECIALTY_POTENCIA_REF = 10;
  const WEATHER_SPECIALTY_MAX_PACE_SWING = 0.06; // ±6% de ritmo no pico (potência 10, na própria especialidade)

  function weatherSpecialtyPaceFactor(specialtyKey, actualWeatherKey, potencia) {
    if (!specialtyKey || !WEATHER_SPECIALTY_FACTOR[specialtyKey] || potencia == null) return 1;
    const row = WEATHER_SPECIALTY_FACTOR[specialtyKey];
    const basePercent = row[actualWeatherKey];
    if (basePercent == null) return 1;
    const scale = Math.max(0, potencia) / WEATHER_SPECIALTY_POTENCIA_REF;
    return 1 + basePercent * scale * WEATHER_SPECIALTY_MAX_PACE_SWING;
  }

  // pneu fora da condição ideal perde grip — reflete o carro escorregando
  // no seco com pneu de chuva, ou "cozinhando" o intermediário no seco
  const TIRE_MISMATCH_PENALTY = 0.22;

  // Até 5 fornecedoras de pneu no grid — cada uma com um perfil próprio de
  // rendimento no seco (macio/médio/duro) x na chuva (intermediário/chuva),
  // de propósito desbalanceado entre os dois eixos: quem manda no seco não é
  // necessariamente quem manda na chuva, como o usuário pediu.
  // banda apertada de propósito (pedido explícito do usuário): a diferença
  // entre fornecedoras tem que ser pequena — no seco e na chuva, a mesma
  // magnitude de diferença — não pode ser o fator decisivo da corrida.
  // regra global (pedido explícito 15/08): toda porcentagem de fornecedor
  // fica travada entre 86% (piso) e 98% (teto), nunca passa disso pra cima
  // nem fica abaixo disso — vale pra pneu, motor e câmbio
  const TIRE_SUPPLIERS = {
    aurora: { label: 'Borrachas Aurora', profile: { seco: 0.96, chuva: 0.88 } },
    titan: { label: 'Pneus Titã', profile: { seco: 0.88, chuva: 0.96 } },
    cristal: { label: 'Rodagem Cristal', profile: { seco: 0.92, chuva: 0.92 } },
    vulcano: { label: 'Compostos Vulcano', profile: { seco: 0.98, chuva: 0.86 } },
    zenite: { label: 'Pneus Zênite', profile: { seco: 0.86, chuva: 0.98 } },
  };

  function tireSupplierFactor(supplierKey, compoundKey) {
    const supplier = TIRE_SUPPLIERS[supplierKey];
    if (!supplier) return 1;
    const axis = (compoundKey === 'intermediario' || compoundKey === 'chuva') ? 'chuva' : 'seco';
    return supplier.profile[axis] != null ? supplier.profile[axis] : 1;
  }

  // CORREÇÃO (pedido explícito do usuário — "não pode ser o fator
  // decisivo"): TIRE_SUPPLIERS guarda a porcentagem EXIBIDA (banda
  // 86%-98%, regra global de fornecedores), mas usar esse número cru
  // como multiplicador direto de grip dava até 12% de diferença só pelo
  // fornecedor de pneu — grande demais pra um "tempero", já que o pneu
  // sozinho já teria mais peso que motor+chassi juntos. Comprime a mesma
  // banda 86-98% num multiplicador estreito (~0.97 a ~1.03), mesma escala
  // usada pro rendimento de motor e pro efeito de chassi.
  function tireSupplierEffectFactor(supplierKey, compoundKey) {
    const raw = tireSupplierFactor(supplierKey, compoundKey);
    const pct = Math.round(raw * 100);
    const clamped = Math.max(86, Math.min(98, pct));
    return 0.97 + ((clamped - 86) / (98 - 86)) * 0.06;
  }

  function tireEffectiveGrip(compoundKey, weatherKey, supplierKey) {
    const compound = TIRE_COMPOUNDS[compoundKey];
    const weather = WEATHER_CONDITIONS[weatherKey];
    if (!compound || !weather) return compound ? compound.gripFactor : 1;
    const ideal = weather.idealTires.includes(compoundKey);
    const base = ideal ? compound.gripFactor : compound.gripFactor * (1 - TIRE_MISMATCH_PENALTY);
    return supplierKey ? base * tireSupplierEffectFactor(supplierKey, compoundKey) : base;
  }

  // desgaste acumulado (%) depois de N voltas com o composto — 100% = precisa trocar
  function calcTireWear(compoundKey, laps, aggressiveness) {
    const compound = TIRE_COMPOUNDS[compoundKey];
    if (!compound) return 0;
    const mult = aggressiveness == null ? 1 : aggressiveness;
    return Math.min(100, compound.wearRate * laps * mult);
  }

  // quantas voltas o composto aguenta antes de bater na margem de segurança
  function calcStintLaps(compoundKey, safetyMarginPct, aggressiveness) {
    const compound = TIRE_COMPOUNDS[compoundKey];
    if (!compound) return 0;
    const margin = safetyMarginPct == null ? 92 : safetyMarginPct;
    const mult = aggressiveness == null ? 1 : aggressiveness;
    return Math.max(1, Math.floor(margin / (compound.wearRate * mult)));
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

  // motor mais potente bebe mais combustível — mais uma variável de
  // trade-off (pedido explícito do usuário 15/08): nível 0 de motor não
  // penaliza nada, nível máximo (20) bebe 10% a mais por volta
  const MOTOR_MAX_LEVEL = 20;
  const MOTOR_FUEL_SPREAD = 0.10;
  function motorFuelMult(motorLevel) {
    return 1 + (Math.max(0, Math.min(MOTOR_MAX_LEVEL, motorLevel || 0)) / MOTOR_MAX_LEVEL) * MOTOR_FUEL_SPREAD;
  }

  // ---------- Tempo de parada no box ----------
  // melhorar a estrutura de boxes (mecânicos + telemetria) e a engenharia
  // (motor/chassi/aerodinâmica) reduz o tempo parado — é o retorno concreto
  // de investir em "peças do carro" que o usuário pediu.
  // CORREÇÃO (bug real reportado pelo usuário): a corrida roda num relógio
  // COMPRIMIDO — a corrida inteira (44 a 78 voltas) cabe em raceRealMs
  // (5min por padrão), então 1 volta "comprimida" dura só uns 5-6s. Um
  // valor fixo de 25000ms (25s reais de pit real) nesse relógio custava
  // 4-5 VOLTAS inteiras de chão, não uma fração de volta como na F1 de
  // verdade (pit real ~20-25s contra volta de ~80-100s = 20-30% de uma
  // volta). Agora o tempo de pit é uma FRAÇÃO da volta média da própria
  // corrida (avgLapMs = raceRealMs/totalLaps), então sempre custa uma
  // fatia de volta plausível, não múltiplas voltas inteiras.
  const PIT_STOP_LAP_FRACTION_MAX = 0.40; // nível 0 nos dois grupos
  const PIT_STOP_LAP_FRACTION_MIN = 0.12; // nível 20 nos dois grupos
  const DEFAULT_AVG_LAP_MS = 5400; // fallback quando avgLapMs não é informado

  function pitStopMs(boxesLevel, engenhariaLevel, avgLapMs) {
    const boxes = Math.max(0, Math.min(20, boxesLevel || 0));
    const engenharia = Math.max(0, Math.min(20, engenhariaLevel || 0));
    const weightedLevel = boxes * 0.7 + engenharia * 0.3;
    const frac = PIT_STOP_LAP_FRACTION_MAX - (PIT_STOP_LAP_FRACTION_MAX - PIT_STOP_LAP_FRACTION_MIN) * (weightedLevel / 20);
    const lapMs = avgLapMs != null ? avgLapMs : DEFAULT_AVG_LAP_MS;
    return Math.round(lapMs * frac);
  }

  function pitStopMsForClub(club, avgLapMs) {
    const lapMs = avgLapMs != null ? avgLapMs : DEFAULT_AVG_LAP_MS;
    if (!club || !window.WSPF1Equipe) return Math.round(lapMs * PIT_STOP_LAP_FRACTION_MAX);
    const boxesLevel = window.WSPF1Equipe.facilityGroupLevel(club, 'boxes');
    const engenhariaLevel = window.WSPF1Equipe.facilityGroupLevel(club, 'engenharia');
    return pitStopMs(boxesLevel, engenhariaLevel, lapMs);
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

  // ---------- Confiabilidade do câmbio (fornecedor, não departamento) ----------
  // câmbio já existia como TIPO de pane (ligado ao departamento de chassi);
  // agora também existe como FORNECEDOR de verdade (marca escolhida pelo
  // jogador, contrato por temporada, igual motor/chassi/pneu) — em vez de
  // repetir o mesmo multiplicador de ritmo que chassi já usa, o câmbio
  // mexe na confiabilidade: quanto melhor a marca, menor a chance de o
  // carro ter QUALQUER pane mecânica na corrida (não decide, só inclina)
  const CAMBIO_RELIABILITY_MIN = 86;
  const CAMBIO_RELIABILITY_MAX = 98;

  function cambioReliabilityMult(pct) {
    if (pct == null) return 1;
    const clamped = Math.max(CAMBIO_RELIABILITY_MIN, Math.min(CAMBIO_RELIABILITY_MAX, pct));
    const span = CAMBIO_RELIABILITY_MAX - CAMBIO_RELIABILITY_MIN;
    // melhor câmbio (98%) reduz a chance de pane em até 25%; o pior (86%) não reduz nada
    return 1 - ((clamped - CAMBIO_RELIABILITY_MIN) / span) * 0.25;
  }

  // confiabilidade é característica FIXA de cada marca de câmbio (mesmo
  // espírito do consumo de combustível do motor) — banda global 86%-98%
  const CAMBIO_RELIABILITY_PROFILES = {
    'Câmbios Constelação': 0.94,
    'Transmissões Faísca': 0.88,
    'Câmbios Rocha': 0.98,
    'Transmissões Meridiano': 0.90,
    'Câmbios Ventania': 0.86,
    'Transmissões Cadência': 0.96,
    'Câmbios Bússola': 0.92,
    'Transmissões Alforje': 0.92,
  };

  function cambioReliabilityPct(name) {
    const factor = CAMBIO_RELIABILITY_PROFILES[name] != null ? CAMBIO_RELIABILITY_PROFILES[name] : 0.92;
    return Math.round(factor * 100);
  }

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
  function failureChanceForRace(motorLevel, chassiLevel, cambioReliabilityPct) {
    const base = 0.12;
    const min = 0.01;
    const avg = ((motorLevel || 0) + (chassiLevel || 0)) / 2;
    const deptChance = base - (base - min) * (Math.max(0, Math.min(20, avg)) / 20);
    return deptChance * cambioReliabilityMult(cambioReliabilityPct);
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
    const weights = entrants.map((e) => Math.max(0.001, failureChanceForRace(e.motorLevel, e.chassiLevel, e.cambioReliability)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < entrants.length; i++) {
      r -= weights[i];
      if (r <= 0) return entrants[i];
    }
    return entrants[entrants.length - 1];
  }

  // ---------- Rendimento dos motores por temporada ----------
  // cada motor oscila de uma temporada pra outra (podendo subir ou cair),
  // em vez de ter um rendimento fixo pra sempre — reflete desenvolvimento e
  // regressão real de fabricantes de motor ao longo dos anos
  const MOTOR_PERFORMANCE_MIN = 86;
  const MOTOR_PERFORMANCE_MAX = 98;
  const MOTOR_PERFORMANCE_STEP = 4; // variação máxima (pra cima ou pra baixo) de uma temporada pra outra

  function motorNames() {
    return (window.WSPF1Equipe && window.WSPF1Equipe.MOTORES) || [];
  }

  // primeira temporada: sorteio livre dentro da faixa. temporadas seguintes:
  // parte do valor anterior e varia até MOTOR_PERFORMANCE_STEP pontos, então
  // "motor X tinha 93%, pode virar 97%" e "motor Y tinha 99%, pode cair pra 95%"
  function rollMotorPerformances(previousTable) {
    const names = motorNames().length ? motorNames() : Object.keys(previousTable || {});
    const table = {};
    names.forEach((name) => {
      const prev = previousTable && previousTable[name] != null ? previousTable[name] : null;
      if (prev == null) {
        table[name] = Math.round(MOTOR_PERFORMANCE_MIN + Math.random() * (MOTOR_PERFORMANCE_MAX - MOTOR_PERFORMANCE_MIN));
      } else {
        const delta = Math.round((Math.random() * 2 - 1) * MOTOR_PERFORMANCE_STEP);
        table[name] = Math.max(MOTOR_PERFORMANCE_MIN, Math.min(MOTOR_PERFORMANCE_MAX, prev + delta));
      }
    });
    return table;
  }

  // converte o % de rendimento do motor num multiplicador suave de ritmo —
  // não deixamos o motor sozinho decidir a corrida, só inclina a balança
  function motorPerformanceFactor(pct) {
    if (pct == null) return 1;
    const clamped = Math.max(MOTOR_PERFORMANCE_MIN, Math.min(MOTOR_PERFORMANCE_MAX, pct));
    const span = MOTOR_PERFORMANCE_MAX - MOTOR_PERFORMANCE_MIN;
    return 0.97 + ((clamped - MOTOR_PERFORMANCE_MIN) / span) * 0.06; // ~0.97 a ~1.03
  }

  // consumo de combustível é característica FIXA de cada fabricante de
  // motor (diferente da potência, que oscila por temporada) — motor mais
  // sedento não é necessariamente o mais potente nesta temporada, mais
  // uma variável independente pro jogador pesar na escolha
  // banda global 86%-98% (mesma regra de qualquer porcentagem de
  // fornecedor) — a ordem entre as marcas continua a mesma de antes
  // (Coventry é o mais sedento, Modernos o mais econômico), só a escala
  // que foi comprimida pra caber no teto/piso instituído
  const MOTOR_FUEL_PROFILES = {
    'Motores Auge de Coventry': 0.98,
    'Motores de Corrida Britânicos': 0.88,
    'Motores Modernos': 0.86,
    'Motores Vida': 0.96,
    'Peças de Reposição Racing': 0.92,
    'Motores Cervo': 0.90,
    'Motores Sombra': 0.94,
    'Motores Pégaso': 0.92,
  };

  function motorSupplierFuelFactor(name) {
    return MOTOR_FUEL_PROFILES[name] != null ? MOTOR_FUEL_PROFILES[name] : 1;
  }

  // ---------- Acerto do carro (treino livre) ----------
  // 3 ajustes com trade-off real: ganhar ritmo custa desgaste de pneu (ou
  // ---------- Estilo de pilotagem ----------
  // decisão de corrida (escolhida na estratégia pré-largada, não no
  // treino): mais agressivo ganha ritmo mas gasta o pneu mais rápido —
  // é o eixo que fecha a "planilha" de combustível/pneu com um número que
  // a pessoa realmente controla e vê recalcular na hora.
  // ajustável ao vivo durante a corrida (não só antes de largar) — por
  // isso também carrega fuelMult: mudar de estilo no meio da corrida deve
  // mexer no consumo de combustível de verdade, não só no ritmo/desgaste
  const DRIVING_STYLES = {
    conservador: { label: 'Conservador', desc: 'Poupa pneu e combustível, perde um pouco de ritmo.', paceMod: -0.012, wearMult: 0.82, fuelMult: 0.93 },
    equilibrado: { label: 'Equilibrado', desc: 'Ritmo, desgaste e consumo padrão.', paceMod: 0, wearMult: 1, fuelMult: 1 },
    agressivo: { label: 'Agressivo', desc: 'Mais rápido, gasta pneu e combustível bem mais rápido.', paceMod: 0.018, wearMult: 1.28, fuelMult: 1.09 },
  };

  function defaultDrivingStyle() { return 'equilibrado'; }

  function drivingStylePaceFactor(style) {
    const s = DRIVING_STYLES[style];
    return s ? 1 + s.paceMod : 1;
  }

  function drivingStyleWearMult(style) {
    const s = DRIVING_STYLES[style];
    return s ? s.wearMult : 1;
  }

  function drivingStyleFuelMult(style) {
    const s = DRIVING_STYLES[style];
    return s ? s.fuelMult : 1;
  }

  // vice-versa) — escolhido no treino livre e vale pro resto do fim de
  // semana (classificatória, sprint e corrida), não só pro treino em si
  const CAR_SETUP_OPTIONS = {
    aero: {
      baixa: { label: 'Baixa carga aerodinâmica', desc: 'Mais veloz nas retas, escorrega mais nas curvas.', paceMod: 0.02, wearMod: -0.04 },
      media: { label: 'Carga média', desc: 'Equilíbrio entre reta e curva.', paceMod: 0, wearMod: 0 },
      alta: { label: 'Alta carga aerodinâmica', desc: 'Mais estável nas curvas, perde um pouco nas retas.', paceMod: -0.015, wearMod: 0.03 },
    },
    altura: {
      baixa: { label: 'Carro baixo', desc: 'Mais rápido, mais risco em pista irregular.', paceMod: 0.012, wearMod: 0.02 },
      media: { label: 'Altura média', desc: 'Ajuste neutro.', paceMod: 0, wearMod: 0 },
      alta: { label: 'Carro alto', desc: 'Mais seguro, um pouco mais lento.', paceMod: -0.01, wearMod: -0.02 },
    },
    pressao: {
      baixa: { label: 'Pressão baixa', desc: 'Mais aderência, desgasta o pneu mais rápido.', paceMod: 0.008, wearMod: 0.08 },
      media: { label: 'Pressão média', desc: 'Equilíbrio.', paceMod: 0, wearMod: 0 },
      alta: { label: 'Pressão alta', desc: 'Pneu dura mais, um pouco menos de aderência.', paceMod: -0.008, wearMod: -0.07 },
    },
  };

  function defaultCarSetup() {
    return { aero: 'media', altura: 'media', pressao: 'media' };
  }

  function setupPaceFactor(setup) {
    if (!setup) return 1;
    const sum = (CAR_SETUP_OPTIONS.aero[setup.aero] || { paceMod: 0 }).paceMod
      + (CAR_SETUP_OPTIONS.altura[setup.altura] || { paceMod: 0 }).paceMod
      + (CAR_SETUP_OPTIONS.pressao[setup.pressao] || { paceMod: 0 }).paceMod;
    return 1 + sum;
  }

  function setupWearFactor(setup) {
    if (!setup) return 1;
    const sum = (CAR_SETUP_OPTIONS.aero[setup.aero] || { wearMod: 0 }).wearMod
      + (CAR_SETUP_OPTIONS.altura[setup.altura] || { wearMod: 0 }).wearMod
      + (CAR_SETUP_OPTIONS.pressao[setup.pressao] || { wearMod: 0 }).wearMod;
    return Math.max(0.7, 1 + sum);
  }

  // altura ideal depende do asfalto do circuito — carro baixo é rápido no
  // tapete liso mas sofre num piso ondulado, carro alto é mais seguro no
  // ondulado mas perde ritmo num circuito liso. O jogador decide sozinho;
  // isso só recompensa quem acertou o palpite, não escolhe por ele.
  const ASPHALT_IDEAL_ALTURA = { liso: 'baixa', medio: 'media', ondulado: 'alta' };
  const ALTURA_ORDER = ['baixa', 'media', 'alta'];

  function setupAsphaltMatchFactor(altura, asphaltTipo) {
    if (!altura || !asphaltTipo || !ASPHALT_IDEAL_ALTURA[asphaltTipo]) return 1;
    const ideal = ASPHALT_IDEAL_ALTURA[asphaltTipo];
    const distance = Math.abs(ALTURA_ORDER.indexOf(altura) - ALTURA_ORDER.indexOf(ideal));
    if (distance === 0) return 1.012; // acertou o palpite, pequeno ganho
    return 1 - distance * 0.018; // errou feio (baixo no ondulado, ou alto no liso) custa mais
  }

  // ---------- POT: potência do motor ajustável AO VIVO durante a corrida ----------
  // pedido do usuário (ideia trazida de outra ferramenta, "Migoo"): um
  // controle de potência que o jogador ajusta durante a corrida — mais
  // potência ganha ritmo mas gasta mais combustível e desgasta mais o
  // pneu; menos potência poupa os dois, perdendo ritmo. Escala 0-20 (igual
  // a outras "potências" do projeto, ex.: weatherPotencia), 10 = neutro.
  // Mesmo espírito "não decide sozinho" dos outros sistemas: teto de ±5%
  // de ritmo no extremo, mas o custo em combustível/desgaste é maior
  // (~±12%/±10%), pra ser uma escolha real de risco x benefício.
  const MOTOR_POWER_REF = 10;
  const MOTOR_POWER_MAX = 20;
  const MOTOR_POWER_PACE_SWING = 0.05;
  const MOTOR_POWER_FUEL_SWING = 0.12;
  const MOTOR_POWER_WEAR_SWING = 0.10;

  function motorPowerTilt(potencia) {
    const p = potencia == null ? MOTOR_POWER_REF : Math.max(0, Math.min(MOTOR_POWER_MAX, potencia));
    return (p - MOTOR_POWER_REF) / MOTOR_POWER_REF; // -1 (mínimo) .. 0 (neutro) .. 1 (máximo)
  }
  function motorPowerPaceFactor(potencia) { return 1 + motorPowerTilt(potencia) * MOTOR_POWER_PACE_SWING; }
  function motorPowerFuelMult(potencia) { return 1 + motorPowerTilt(potencia) * MOTOR_POWER_FUEL_SWING; }
  function motorPowerWearMult(potencia) { return 1 + motorPowerTilt(potencia) * MOTOR_POWER_WEAR_SWING; }

  window.WSPF1Corrida = {
    TIRE_COMPOUNDS, WEATHER_CONDITIONS, WEATHER_TIER_KEYS, TIRE_MISMATCH_PENALTY, TIRE_SUPPLIERS,
    seededRng, CLIMA_TEMP_RANGE, buildWeatherTimeline, weatherForecastCheckpoints,
    weatherWearMult, weatherFuelMult,
    WEATHER_SPECIALTY_FACTOR, WEATHER_SPECIALTY_POTENCIA_REF, WEATHER_SPECIALTY_MAX_PACE_SWING,
    weatherSpecialtyPaceFactor,
    tireEffectiveGrip, tireSupplierFactor, tireSupplierEffectFactor, calcTireWear, calcStintLaps,
    FUEL_BASE_CONSUMPTION_PER_LAP, FUEL_SAFETY_MARGIN_PCT, calcFuelNeeded, calcFuelForStint, motorFuelMult,
    PIT_STOP_LAP_FRACTION_MAX, PIT_STOP_LAP_FRACTION_MIN, DEFAULT_AVG_LAP_MS, pitStopMs, pitStopMsForClub,
    FAILURE_TYPES, SEASON_FAILURE_EVENTS_MIN, SEASON_FAILURE_EVENTS_MAX,
    scheduleFailureEvents, failureChanceForRace, rollFailureType, pickAffectedEntrant,
    CAMBIO_RELIABILITY_MIN, CAMBIO_RELIABILITY_MAX, cambioReliabilityMult,
    CAMBIO_RELIABILITY_PROFILES, cambioReliabilityPct,
    MOTOR_PERFORMANCE_MIN, MOTOR_PERFORMANCE_MAX, MOTOR_PERFORMANCE_STEP,
    rollMotorPerformances, motorPerformanceFactor, MOTOR_FUEL_PROFILES, motorSupplierFuelFactor,
    MOTOR_POWER_REF, MOTOR_POWER_MAX, motorPowerPaceFactor, motorPowerFuelMult, motorPowerWearMult,
    CAR_SETUP_OPTIONS, defaultCarSetup, setupPaceFactor, setupWearFactor,
    ASPHALT_IDEAL_ALTURA, setupAsphaltMatchFactor,
    DRIVING_STYLES, defaultDrivingStyle, drivingStylePaceFactor, drivingStyleWearMult, drivingStyleFuelMult,
  };
})();
