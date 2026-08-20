(() => {
  'use strict';

  // Motor de corrida: simulação pura (sem canvas/DOM) de Sprint e Corrida.
  // Treino Livre e Classificatória são resolvidos instantaneamente em
  // calendario.js — só as sessões que valem pontos "de verdade" rodam aqui,
  // volta a volta, com pneu/combustível/pit stop/clima/falha mecânica.

  const C = () => window.WSPF1Corrida;

  function distancePenaltyFromWear(wearPct) {
    return Math.min(0.18, (wearPct / 100) * 0.18);
  }

  function distancePenaltyFromFuel(fuelKg, fullFuelKg) {
    if (!fullFuelKg) return 0;
    return Math.max(0, Math.min(0.08, (fuelKg / fullFuelKg) * 0.08));
  }

  // velocidade "de telemetria" mostrada no velocímetro da tela de corrida —
  // não é a mesma unidade da simulação (que roda em tempo real comprimido),
  // é uma conversão cosmética pra km/h plausível de F1, usando os mesmos
  // fatores multiplicativos (ritmo/aderência/desgaste/combustível) que já
  // decidem quem vence a corrida, só trocando a escala de tempo comprimida
  // por uma referência fixa de pico de F1
  const SPEED_DISPLAY_BASE_KMH = 300;

  // ---------- Safety Car ----------
  const SC_CHANCE_PER_LAP = 0.04;  // 4% chance por volta
  const SC_MIN_LAP = 3;            // não aparece antes da volta 3
  const SC_LAPS_DURATION_MIN = 2;
  const SC_LAPS_DURATION_MAX = 4;
  const SC_MAX_PER_RACE = 2;
  const SC_SPEED_FACTOR = 0.45;    // carros andam a 45% da velocidade
  const SC_WEAR_MULT = 0.15;       // desgaste cai pra 15% do normal
  const SC_FUEL_MULT = 0.40;       // consumo cai pra 40% do normal

  function maybeDeploySafetyCar(state) {
    if (state.isSprint) return; // sem SC em sprint
    if (!state.safetyCar) state.safetyCar = { active: false, lapsRemaining: 0, count: 0 };
    if (state.safetyCar.active) {
      state.safetyCar.lapsRemaining--;
      if (state.safetyCar.lapsRemaining <= 0) {
        state.safetyCar.active = false;
        pushLog(state, '\u{1F7E2} Safety Car recolhido! Corrida relargada.');
      }
      return;
    }
    if (state.safetyCar.count >= SC_MAX_PER_RACE) return;
    var leaderLap = Math.max(0, ...state.cars.filter(function(c){return !c.retired;}).map(function(c){return c.lapsCompleted;}));
    if (leaderLap < SC_MIN_LAP || leaderLap >= state.totalLaps - 2) return;
    if (Math.random() < SC_CHANCE_PER_LAP) {
      state.safetyCar.active = true;
      state.safetyCar.lapsRemaining = SC_LAPS_DURATION_MIN + Math.floor(Math.random() * (SC_LAPS_DURATION_MAX - SC_LAPS_DURATION_MIN + 1));
      state.safetyCar.count++;
      pushLog(state, '\u{1F7E1} SAFETY CAR na pista! Incidente na volta ' + leaderLap + '.');
    }
  }


  function nextStrategyCompound(current) {
    if (current === 'macio') return 'duro';
    if (current === 'duro') return 'medio';
    return 'medio';
  }

  function pitStopMsForCar(car, opts, avgLapMs) {
    if (opts.pitStopMsByTeam && opts.pitStopMsByTeam[car.teamId] != null) return opts.pitStopMsByTeam[car.teamId];
    const lvl = ((car.motorLevel || 0) + (car.chassiLevel || 0)) / 2;
    return C() ? C().pitStopMs(lvl, lvl, avgLapMs) : Math.round((avgLapMs || 5400) * 0.3);
  }

  // entrants já devem vir ordenados pela posição de largada (grid da classificatória)
  function createRaceState(entrants, opts) {
    // Escalonamento de Voltas: sprint sempre fixo (caller já manda o
    // número certo de voltas pras demais sessões via opts.baseLaps —
    // ver gameLapsForRealLaps em corrida.js)
    const totalLaps = opts.isSprint ? (C() ? C().SPRINT_LAPS_FIXED : 4) : opts.baseLaps;
    const raceRealMs = opts.isSprint ? Math.round((opts.raceRealMs || 300000) / 3) : (opts.raceRealMs || 300000);
    const fullFuelKg = C() ? C().calcFuelNeeded(totalLaps) : totalLaps * 2;
    // reabastecimento planejado, sprint (binário, corridas curtas não
    // precisam de granularidade) OU corrida principal com volta-alvo
    // explícita — o jogador escolhe até que volta quer rodar com aquele
    // tanque, o carro sai mais leve/rápido e é OBRIGADO a parar pra
    // reabastecer + trocar pneu nessa volta
    const refuelPlan = opts.isSprint ? (opts.refuelPlan || 'none') : 'none';
    const defaultDrivingStyle = C() ? C().defaultDrivingStyle() : 'equilibrado';
    // teto de segurança: mesmo que o composto escolhido "aguentasse" a
    // corrida toda (folga de acerto/estilo), ninguém corre sem parar —
    // pelo menos 1 parada em 75% da corrida, o mais tardar
    const hardStopCap = Math.max(1, Math.floor(totalLaps * 0.75));

    // cada carro do jogador pode ter composto/volta-alvo/estilo PRÓPRIOS
    // (opts.playerStrategies, chave = id do entrant) — pedido explícito do
    // usuário: os dois pilotos não são obrigados a rodar o mesmo plano.
    // Essa tabela projeta só a 1ª parada; da segunda em diante quem manda
    // é o pedido manual do jogador durante a corrida (requestPit). Rival
    // sem estratégia específica usa composto neutro e plano por desgaste
    // de pneu — não copia a escolha do jogador.
    function strategyForEntrant(e) {
      const custom = (e.isPlayer && opts.playerStrategies) ? opts.playerStrategies[e.id] : null;
      if (custom) {
        return {
          startCompound: custom.startCompound || opts.startCompound || 'medio',
          fuelTargetLap: custom.fuelTargetLap != null
            ? Math.max(1, Math.min(totalLaps - 1, Math.round(custom.fuelTargetLap)))
            : null,
          drivingStyle: (custom.drivingStyle && C() && C().DRIVING_STYLES[custom.drivingStyle]) ? custom.drivingStyle : defaultDrivingStyle,
        };
      }
      // sem plano específico pra este carro: pro jogador ainda respeita
      // opts.startCompound/fuelTargetLap/drivingStyle no nível raiz (chamador
      // simples, sem playerStrategies — ex.: sessões de teste), rival nunca
      // copia a escolha do jogador
      return {
        startCompound: e.isPlayer ? (opts.startCompound || 'medio') : 'medio',
        fuelTargetLap: e.isPlayer && opts.fuelTargetLap != null
          ? Math.max(1, Math.min(totalLaps - 1, Math.round(opts.fuelTargetLap)))
          : null,
        drivingStyle: e.isPlayer && opts.drivingStyle && C() && C().DRIVING_STYLES[opts.drivingStyle]
          ? opts.drivingStyle
          : defaultDrivingStyle,
      };
    }

    // Escalonamento de Voltas: calcStintLaps devolve quantas VOLTAS REAIS
    // o composto aguenta (calibrado pra corridas de 30-70 voltas) — numa
    // corrida comprimida pra 5-9 voltas de jogo, isso precisa ser
    // convertido de volta pra "voltas de jogo" (dividindo pela razão de
    // compressão), senão o teto do pneu nunca bate antes do hardStopCap e
    // o composto escolhido deixa de fazer diferença nenhuma pra decisão
    // de quando parar.
    const lapCompressionRatio = opts.lapCompressionRatio || 1;
    const cars = entrants.map((e, i) => {
      const strategy = strategyForEntrant(e);
      const tireStintCap = C()
        ? Math.max(1, Math.round(C().calcStintLaps(strategy.startCompound, 90) / lapCompressionRatio))
        : Math.floor(totalLaps * 0.6);
      const defaultPlannedPitLap = opts.isSprint ? null : Math.min(hardStopCap, tireStintCap);

      let startFuel = fullFuelKg;
      let plannedPitLap = defaultPlannedPitLap;
      if (refuelPlan === 'planned') {
        startFuel = Math.round(fullFuelKg * 0.5);
        plannedPitLap = Math.max(1, Math.floor(totalLaps / 2));
      } else if (strategy.fuelTargetLap) {
        const fuelForTarget = C() ? C().calcFuelForStint(strategy.fuelTargetLap) : fullFuelKg * (strategy.fuelTargetLap / totalLaps);
        startFuel = Math.min(fullFuelKg, Math.round(fuelForTarget * 1.05)); // pequena margem, não seca na hora
        plannedPitLap = defaultPlannedPitLap != null ? Math.min(defaultPlannedPitLap, strategy.fuelTargetLap) : strategy.fuelTargetLap;
      }
      return {
        id: e.id,
        teamId: e.teamId,
        teamName: e.teamName,
        driverName: e.driverName,
        isPlayer: !!e.isPlayer,
        pace: e.pace,
        motorLevel: e.motorLevel || 0,
        chassiLevel: e.chassiLevel || 0,
        motorSupplier: e.motorSupplier || null,
        tireSupplier: e.tireSupplier || null,
        cambioReliability: e.cambioSupplier && C() ? C().cambioReliabilityPct(e.cambioSupplier) : null,
        // acerto de carro é POR PILOTO — cada entrant já vem com o SEU
        // próprio carSetup (ver grid.js), não é mais um valor de equipe
        // compartilhado entre os dois titulares
        wearFactor: e.isPlayer && C() ? C().setupWearFactor(e.carSetup, opts.carSetupIdeal) : 1,
        grid: i,
        lapsCompleted: 0,
        distance: 0,
        tireCompound: strategy.startCompound,
        tireWear: 0,
        fuelKg: startFuel,
        pitting: false,
        pitMsRemaining: 0,
        pitTotalMs: 0,
        lastPitDurationSec: null,
        pitStopsDone: 0,
        plannedPitLap,
        fuelPlanned: e.isPlayer && (refuelPlan === 'planned' || !!strategy.fuelTargetLap),
        pendingPitCompound: null,
        pendingRefuel: false,
        retired: false,
        retiredReason: null,
        finishedAt: null,
        displaySpeedKmh: 0,
        // estilo de pilotagem É POR CARRO agora — ajustável ao vivo (ver
        // setDrivingStyle) individualmente pra cada piloto do jogador
        drivingStyle: strategy.drivingStyle,
        // especialidade de clima do piloto (1 dos 4 níveis, ou nenhuma) e a
        // potência dela (0-20) — vem do cadastro do piloto (pilotos.js) via
        // entrant, carro sem nenhum dos dois não ganha nem perde ritmo
        weatherSpecialty: e.weatherSpecialty || null,
        weatherPotencia: e.weatherPotencia != null ? e.weatherPotencia : 0,
        _moralValue: e.moral != null ? e.moral : 50,
        // POT: potência do motor ajustável AO VIVO (0-20, 10 = neutro) —
        // igual ao estilo de pilotagem, é por carro e o jogador troca
        // durante a corrida (ver setMotorPower)
        motorPower: C() ? C().MOTOR_POWER_REF : 10,
      };
    });

    let scheduledFailure = null;
    if (opts.hasFailureEvent && !opts.isSprint && C()) {
      const picked = C().pickAffectedEntrant(cars.map((c) => ({ id: c.id, motorLevel: c.motorLevel, chassiLevel: c.chassiLevel, cambioReliability: c.cambioReliability })));
      if (picked) {
        scheduledFailure = {
          carId: picked.id,
          lap: 2 + Math.floor(Math.random() * Math.max(1, totalLaps - 4)),
          info: C().rollFailureType(picked.motorLevel, picked.chassiLevel),
          triggered: false,
        };
      }
    }

    // clima: sequência determinística pra sessão INTEIRA (mesma semente que
    // a tabela de previsão pré-sessão usou, em corrida.html) — nunca é mais
    // um sorteio solto de "vai chover ou não" isolado do que foi mostrado
    // pro jogador. Vale pras 4 sessões (treino/classificatória/sprint/
    // corrida), não só corrida principal como era antes.
    const weatherSeed = opts.weatherSeed || ((opts.circuit || 'circuito') + '|' + (opts.isSprint ? 'sprint' : 'corrida'));
    const weatherTimeline = C()
      ? C().buildWeatherTimeline(weatherSeed, totalLaps, opts.clima || 'seco')
      : { tiers: new Array(totalLaps).fill('seco'), temps: new Array(totalLaps).fill(24) };

    return {
      cars,
      totalLaps,
      lapCompressionRatio,
      raceRealMs,
      elapsedMs: 0,
      weather: weatherTimeline.tiers[0],
      weatherTimeline,
      scheduledFailure,
      baseSpeedPerMs: (totalLaps * 100) / raceRealMs,
      fullFuelKg,
      isSprint: !!opts.isSprint,
      circuit: opts.circuit || '',
      finished: false,
      safetyCar: { active: false, lapsRemaining: 0, count: 0 },
      log: [],
      pitStopMsByTeam: opts.pitStopMsByTeam || null,
    };
  }

  // chamada externa: muda o estilo de pilotagem de UM carro específico em
  // tempo real, no meio da corrida — o próximo tick de stepRace já aplica
  // o novo ritmo/desgaste/consumo, sem precisar recriar o raceState. Cada
  // carro do jogador tem seu próprio estilo (car.drivingStyle), não é mais
  // um valor único pros dois pilotos.
  function setDrivingStyle(state, carId, style) {
    if (!C() || !C().DRIVING_STYLES[style]) return;
    const car = state.cars.find((c) => c.id === carId);
    if (car) car.drivingStyle = style;
  }

  // POT: chamada externa que muda a potência do motor de UM carro em tempo
  // real (0-20, 10 = neutro) — mesmo padrão do setDrivingStyle, o próximo
  // tick de stepRace já aplica o novo ritmo/consumo/desgaste
  function setMotorPower(state, carId, power) {
    const car = state.cars.find((c) => c.id === carId);
    if (!car) return;
    const max = C() ? C().MOTOR_POWER_MAX : 20;
    car.motorPower = Math.max(0, Math.min(max, Math.round(power)));
  }

  function pushLog(state, text) {
    state.log.unshift({ t: Math.round(state.elapsedMs / 1000), text });
    if (state.log.length > 40) state.log.length = 40;
  }

  // Rádio da equipe — pedido do usuário (ideia trazida de outra ferramenta,
  // "Migoo"): mensagens do engenheiro avisando clima, pneu, combustível e
  // posição durante a corrida, só pros carros do jogador. Roda no mesmo
  // loop de stepRace, mas com cooldown por carro pra não virar spam — no
  // máximo 1 aviso a cada RADIO_COOLDOWN_MS reais, escolhendo o alerta
  // mais urgente entre os que estiverem valendo no momento.
  const RADIO_COOLDOWN_MS = 25000;
  const RADIO_TIRE_WEAR_THRESHOLD = 75;
  const RADIO_FUEL_LOW_FRACTION = 0.15;

  function checkTeamRadio(state, car, dtMs) {
    if (!car.isPlayer || car.retired || car.finishedAt != null || car.pitting) return;
    car._radioCooldown = (car._radioCooldown || 0) - dtMs;
    if (car._radioCooldown > 0) return;

    const alerts = [];
    if (car.tireWear > RADIO_TIRE_WEAR_THRESHOLD) {
      alerts.push({ priority: 2, text: '📻 ' + car.driverName + ', pneu com ' + Math.round(car.tireWear) + '% de desgaste — considere os boxes.' });
    }
    if (car.fuelKg < state.fullFuelKg * RADIO_FUEL_LOW_FRACTION) {
      alerts.push({ priority: 3, text: '📻 ' + car.driverName + ', combustível baixo — fique de olho.' });
    }
    // clima prestes a mudar (mesma timeline da previsão pré-corrida) — dá
    // um aviso ANTES da mudança acontecer, como um engenheiro de verdade faria
    if (state.weatherTimeline && C()) {
      const leaderLap = Math.max(0, ...state.cars.filter((c) => !c.retired).map((c) => c.lapsCompleted));
      const nextIdx = Math.min(state.weatherTimeline.tiers.length - 1, leaderLap + 1);
      const nextTier = state.weatherTimeline.tiers[nextIdx];
      if (nextTier !== state.weather) {
        const cond = C().WEATHER_CONDITIONS[nextTier];
        alerts.push({ priority: 1, text: '📻 Fica de olho, o tempo deve mudar em breve: ' + (cond ? cond.icon + ' ' + cond.label : nextTier) + '.' });
      }
    }
    // distância pro carro na frente (gap de posição, só quando não é líder)
    const order = standings(state);
    const idx = order.findIndex((c) => c.id === car.id);
    if (idx > 0) {
      const ahead = order[idx - 1];
      if (!ahead.retired && ahead.finishedAt == null) {
        const lapDiff = ahead.lapsCompleted - car.lapsCompleted;
        const distDiff = lapDiff * 100 + (ahead.distance - car.distance);
        const gapLaps = Math.max(0, distDiff / 100);
        if (gapLaps < 0.15) {
          alerts.push({ priority: 1, text: '📻 ' + car.driverName + ', ' + ahead.driverName + ' está bem perto na frente.' });
        }
      }
    }

    if (!alerts.length) return;
    alerts.sort((a, b) => b.priority - a.priority);
    pushLog(state, alerts[0].text);
    car._radioCooldown = RADIO_COOLDOWN_MS;
  }

  // lê a mesma timeline que a tabela de previsão pré-sessão mostrou — nunca
  // sorteia nada aqui, só segue a sequência já decidida na criação do
  // raceState (buildWeatherTimeline), volta a volta, na volta do LÍDER
  function applyWeatherTick(state) {
    if (!state.weatherTimeline || !C()) return;
    const leaderLap = Math.max(0, ...state.cars.filter((c) => !c.retired).map((c) => c.lapsCompleted));
    const idx = Math.min(state.weatherTimeline.tiers.length - 1, leaderLap);
    const nextTier = state.weatherTimeline.tiers[idx];
    if (nextTier === state.weather) return;
    const prevMm = (C().WEATHER_CONDITIONS[state.weather] || {}).mm || 0;
    const nextMm = (C().WEATHER_CONDITIONS[nextTier] || {}).mm || 0;
    state.weather = nextTier;
    const cond = C().WEATHER_CONDITIONS[nextTier];
    if (nextMm > prevMm) pushLog(state, (cond ? cond.icon : '🌧️') + ' O tempo piora em ' + state.circuit + ': ' + (cond ? cond.label : nextTier) + '!');
    else pushLog(state, (cond ? cond.icon : '☀️') + ' O tempo melhora em ' + state.circuit + ': ' + (cond ? cond.label : nextTier) + '.');
  }

  function maybePlanPit(car, state, opts) {
    if (car.retired || car.pitting || car.pendingPitCompound) return;
    // A estratégia de pit do jogador é 100% manual (pedido explícito: "eu
    // que faço a estratégia... não é você que define"). A troca automática
    // por clima e a "1ª parada planejada" abaixo continuam valendo só pros
    // rivais, que não têm o painel de controle ao vivo (#driver-controls) —
    // pro jogador, `plannedPitLap`/clima ficam só como referência na
    // planilha pré-largada, sem executar pit sozinhos.
    if (car.isPlayer) return;
    const cond = C() ? C().WEATHER_CONDITIONS[state.weather] : null;
    const isWetWeather = state.weather !== 'seco';
    if (isWetWeather && cond && !cond.idealTires.includes(car.tireCompound)) {
      car.pendingPitCompound = cond.idealTires[0];
      return;
    }
    if (!isWetWeather && ['intermediario', 'chuva'].includes(car.tireCompound)) {
      car.pendingPitCompound = 'medio';
      return;
    }
    if (car.plannedPitLap != null && car.lapsCompleted >= car.plannedPitLap && car.pitStopsDone === 0) {
      car.pendingPitCompound = nextStrategyCompound(car.tireCompound);
      // parada planejada de combustível (o jogador escolheu a volta-alvo)
      // sempre reabastece de verdade — não é só um palpite por nível de tanque
      car.pendingRefuel = car.fuelPlanned || car.fuelKg < state.fullFuelKg * 0.4;
    }
  }

  function startPit(car, state, opts) {
    car.pitting = true;
    const avgLapMs = state.raceRealMs / state.totalLaps;
    // reabastecer custa um tempinho a mais parado, mas também numa fração
    // plausível da volta (não um valor fixo desalinhado do relógio
    // comprimido) — ~6% de uma volta média
    const refuelMs = car.pendingRefuel ? Math.round(avgLapMs * 0.06) : 0;
    car.pitMsRemaining = pitStopMsForCar(car, opts, avgLapMs) + refuelMs;
    car.pitTotalMs = car.pitMsRemaining; // usado pela tela pra desenhar o carro andando no pit lane
    if (car.isPlayer) pushLog(state, '🔧 ' + car.driverName + ' entra nos boxes.');
  }

  function finishPit(car, state) {
    car.pitting = false;
    car.tireCompound = car.pendingPitCompound || car.tireCompound;
    car.tireWear = 0;
    car.pendingPitCompound = null;
    car.plannedPitLap = null;
    car.pitStopsDone++;
    car.lastPitDurationSec = Math.round((car.pitTotalMs / 1000) * 10) / 10;
    if (car.pendingRefuel) {
      car.fuelKg = state.fullFuelKg * 0.5;
      car.pendingRefuel = false;
    }
    if (car.isPlayer) pushLog(state, '🔧 ' + car.driverName + ' sai dos boxes (' + car.lastPitDurationSec.toFixed(1) + 's parado).');
  }

  // chamada externa (jogador manda o carro pro pit num pneu específico) —
  // vale pro próximo instante em que o carro não estiver já parado
  function requestPit(state, carId, compound) {
    const car = state.cars.find((c) => c.id === carId);
    if (!car || car.retired || car.pitting) return { ok: false };
    car.pendingPitCompound = compound || nextStrategyCompound(car.tireCompound);
    return { ok: true };
  }

  function stepRace(state, dtMs, opts) {
    if (state.finished) return;
    opts = opts || {};
    state.elapsedMs += dtMs;
    applyWeatherTick(state);
    maybeDeploySafetyCar(state);

    state.cars.forEach((car) => {
      checkTeamRadio(state, car, dtMs);
      if (car.retired) { car.displaySpeedKmh = 0; return; }
      if (car.finishedAt != null) return;

      if (car.pitting) {
        car.displaySpeedKmh = 60;
        car.pitMsRemaining -= dtMs;
        if (car.pitMsRemaining <= 0) finishPit(car, state);
        return;
      }

      if (car.pendingPitCompound && Math.random() < 0.55) {
        startPit(car, state, { pitStopMsByTeam: state.pitStopMsByTeam });
        return;
      }

      // fatores do estilo de pilotagem só valem pro jogador, e são lidos do
      // PRÓPRIO CARRO a cada tick (não fixados na largada, e não mais um
      // valor único pros dois pilotos) — mudar de estilo ao vivo já
      // reflete no próximo tick, só pro carro em questão
      const style = car.isPlayer && C() ? car.drivingStyle : null;
      const stylePaceFactor = style ? C().drivingStylePaceFactor(style) : 1;
      const styleWearMult = style ? C().drivingStyleWearMult(style) : 1;
      const styleFuelMult = style ? C().drivingStyleFuelMult(style) : 1;

      const grip = C() ? C().tireEffectiveGrip(car.tireCompound, state.weather, car.tireSupplier) : 1;
      const wearPenalty = distancePenaltyFromWear(car.tireWear);
      const fuelPenalty = distancePenaltyFromFuel(car.fuelKg, state.fullFuelKg);
      // especialidade de clima do piloto: ganha ritmo no clima que domina,
      // perde no oposto — vale pra jogador E rival, todo mundo tem a chance
      // de ter (ou não) uma especialidade
      const weatherSpecialtyFactor = C() ? C().weatherSpecialtyPaceFactor(car.weatherSpecialty, state.weather, car.weatherPotencia) : 1;
      // moral do piloto: afeta ritmo entre 0.90x (moral 0) e 1.10x (moral 100)
      // — a função em si (moralPaceMult) se perdeu num upload manual quebrado
      // no pilotos.js (commit "Refactor pilotos.js..." truncou o arquivo);
      // guarda defensiva pra não quebrar a corrida enquanto isso não existe
      var moralMult = (window.WSPF1Pilotos && typeof window.WSPF1Pilotos.moralPaceMult === 'function' && car._moralValue != null)
        ? window.WSPF1Pilotos.moralPaceMult(car._moralValue) : 1;
      // Safety Car: todos andam devagar
      var scFactor = (state.safetyCar && state.safetyCar.active) ? SC_SPEED_FACTOR : 1;
      // POT: potência do motor ajustável ao vivo (0-20, 10=neutro) — mais
      // potência ganha ritmo mas custa mais combustível/desgaste (ver
      // motorPowerFuelMult/motorPowerWearMult logo abaixo)
      const motorPowerFactor = C() ? C().motorPowerPaceFactor(car.motorPower) : 1;
      const variance = 1 + (Math.random() - 0.5) * 0.06;
      const speedFactor = (car.pace / 75) * stylePaceFactor * weatherSpecialtyFactor * moralMult * motorPowerFactor * grip * (1 - wearPenalty) * (1 - fuelPenalty) * variance * scFactor;
      const speed = state.baseSpeedPerMs * speedFactor;
      car.displaySpeedKmh = Math.max(0, SPEED_DISPLAY_BASE_KMH * speedFactor);

      car.distance += speed * dtMs;
      // clima mais severo (mais mm de chuva) acelera o desgaste do pneu e o
      // consumo de combustível — além do grip que já mudava com pneu errado
      var scWearMult = (state.safetyCar && state.safetyCar.active) ? SC_WEAR_MULT : 1;
      var scFuelMult = (state.safetyCar && state.safetyCar.active) ? SC_FUEL_MULT : 1;
      const weatherWearMult = C() ? C().weatherWearMult(state.weather) : 1;
      const weatherFuelMult = C() ? C().weatherFuelMult(state.weather) : 1;
      const motorPowerWear = C() ? C().motorPowerWearMult(car.motorPower) : 1;
      // Escalonamento de Voltas: wearRate dos compostos é calibrado em
      // "% por volta REAL" (corridas de 30-70 voltas) — sem multiplicar
      // pela razão de compressão aqui, uma corrida de 5-9 voltas de jogo
      // mal desgastaria o pneu (mesmo tempo real, dividido em poucas
      // voltas "grandes"). Isso devolve o desgaste pra escala real.
      const wearAdd = C() ? C().calcTireWear(car.tireCompound, (dtMs / (state.raceRealMs / state.totalLaps)) * (state.lapCompressionRatio || 1), 1) : 0;
      car.tireWear = Math.min(100, car.tireWear + wearAdd * (car.wearFactor || 1) * styleWearMult * weatherWearMult * scWearMult * motorPowerWear);
      // combustível: motor mais potente (nível) bebe mais, E cada fabricante
      // de motor tem uma característica fixa de consumo própria — vale pra
      // todo mundo no grid, não só o jogador
      const motorFuelMult = C() ? C().motorFuelMult(car.motorLevel) : 1;
      const motorSupplierFuel = C() ? C().motorSupplierFuelFactor(car.motorSupplier) : 1;
      const motorPowerFuel = C() ? C().motorPowerFuelMult(car.motorPower) : 1;
      car.fuelKg = Math.max(0, car.fuelKg - (state.fullFuelKg / state.totalLaps) * (dtMs / (state.raceRealMs / state.totalLaps)) * styleFuelMult * motorFuelMult * motorSupplierFuel * weatherFuelMult * scFuelMult * motorPowerFuel);

      // sem combustível = carro para (bug fix: antes rodava com 0kg)
      if (car.fuelKg <= 0 && !car.retired) {
        car.retired = true;
        car.retiredReason = { label: 'Sem combustível', icon: '⛽' };
        pushLog(state, '⛽ ' + car.driverName + ' para na pista: sem combustível!');
        return;
      }

      while (car.distance >= 100 && car.finishedAt == null) {
        car.distance -= 100;
        car.lapsCompleted++;

        if (state.scheduledFailure && !state.scheduledFailure.triggered
          && state.scheduledFailure.carId === car.id && car.lapsCompleted >= state.scheduledFailure.lap) {
          state.scheduledFailure.triggered = true;
          car.retired = true;
          car.retiredReason = state.scheduledFailure.info;
          pushLog(state, (state.scheduledFailure.info.icon || '💥') + ' ' + car.driverName + ' abandona: ' + state.scheduledFailure.info.label + '!');
          return;
        }

        maybePlanPit(car, state, { pitStopMsByTeam: state.pitStopMsByTeam });

        if (car.lapsCompleted >= state.totalLaps) {
          car.finishedAt = state.elapsedMs;
          if (car.isPlayer) pushLog(state, '🏁 ' + car.driverName + ' cruza a linha de chegada!');
          break;
        }
      }
    });

    // teto duro de tempo: mesmo se chuva/pits atrasarem o pelotão inteiro,
    // a corrida não pode estourar o tempo real alvo indefinidamente — quem
    // não terminou até lá é classificado pela posição corrente (bandeirada)
    const stillRunning = state.cars.filter((c) => !c.retired && c.finishedAt == null);
    if (stillRunning.length === 0 || state.elapsedMs > state.raceRealMs * 1.6) {
      state.finished = true;
    }
  }

  function isFinished(state) { return state.finished; }

  // classificação atual: quem já terminou primeiro (por ordem de chegada),
  // depois quem ainda corre (por volta+distância), retirados por último
  function standings(state) {
    const finished = state.cars.filter((c) => c.finishedAt != null).sort((a, b) => a.finishedAt - b.finishedAt);
    const running = state.cars.filter((c) => c.finishedAt == null && !c.retired)
      .sort((a, b) => (b.lapsCompleted - a.lapsCompleted) || (b.distance - a.distance));
    const retired = state.cars.filter((c) => c.retired).sort((a, b) => (b.lapsCompleted - a.lapsCompleted) || (b.distance - a.distance));
    return [...finished, ...running, ...retired];
  }

  window.WSPF1Motor = {
    createRaceState, stepRace, isFinished, standings, requestPit, setDrivingStyle, setMotorPower,
    isSafetyCarActive: function(state) { return state.safetyCar && state.safetyCar.active; },
  };
})();
