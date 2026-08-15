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

  function nextStrategyCompound(current) {
    if (current === 'macio') return 'duro';
    if (current === 'duro') return 'medio';
    return 'medio';
  }

  function idealCompoundFor(weather) {
    if (weather === 'chuva_forte') return 'chuva';
    if (weather === 'chuva_leve') return 'intermediario';
    return null; // seco: qualquer composto "seco" serve, IA não força nada
  }

  function pitStopMsForCar(car, opts) {
    if (opts.pitStopMsByTeam && opts.pitStopMsByTeam[car.teamId] != null) return opts.pitStopMsByTeam[car.teamId];
    const lvl = ((car.motorLevel || 0) + (car.chassiLevel || 0)) / 2;
    return C() ? C().pitStopMs(lvl, lvl) : 20000;
  }

  // entrants já devem vir ordenados pela posição de largada (grid da classificatória)
  function createRaceState(entrants, opts) {
    const totalLaps = opts.isSprint ? Math.max(6, Math.round(opts.baseLaps / 3)) : opts.baseLaps;
    const raceRealMs = opts.isSprint ? Math.round((opts.raceRealMs || 300000) / 3) : (opts.raceRealMs || 300000);
    const fullFuelKg = C() ? C().calcFuelNeeded(totalLaps) : totalLaps * 2;
    // reabastecimento planejado, sprint (binário, corridas curtas não
    // precisam de granularidade) OU corrida principal com volta-alvo
    // explícita (opts.fuelTargetLap) — o jogador escolhe até que volta
    // quer rodar com aquele tanque, o carro sai mais leve/rápido e é
    // OBRIGADO a parar pra reabastecer + trocar pneu nessa volta
    const refuelPlan = opts.isSprint ? (opts.refuelPlan || 'none') : 'none';
    const fuelTargetLap = opts.fuelTargetLap != null
      ? Math.max(1, Math.min(totalLaps - 1, Math.round(opts.fuelTargetLap)))
      : null;
    // teto de segurança: mesmo que o composto escolhido "aguentasse" a
    // corrida toda (folga de acerto/estilo), ninguém corre sem parar —
    // pelo menos 1 parada em 75% da corrida, o mais tardar
    const tireStintCap = C() ? C().calcStintLaps(opts.startCompound || 'medio', 90) : Math.floor(totalLaps * 0.6);
    const hardStopCap = Math.max(1, Math.floor(totalLaps * 0.75));
    const defaultPlannedPitLap = opts.isSprint
      ? null
      : Math.min(hardStopCap, tireStintCap);

    const cars = entrants.map((e, i) => {
      let startFuel = fullFuelKg;
      let plannedPitLap = defaultPlannedPitLap;
      if (refuelPlan === 'planned') {
        startFuel = Math.round(fullFuelKg * 0.5);
        plannedPitLap = Math.max(1, Math.floor(totalLaps / 2));
      } else if (fuelTargetLap) {
        const fuelForTarget = C() ? C().calcFuelForStint(fuelTargetLap) : fullFuelKg * (fuelTargetLap / totalLaps);
        startFuel = Math.min(fullFuelKg, Math.round(fuelForTarget * 1.05)); // pequena margem, não seca na hora
        plannedPitLap = defaultPlannedPitLap != null ? Math.min(defaultPlannedPitLap, fuelTargetLap) : fuelTargetLap;
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
        wearFactor: e.isPlayer && C() ? C().setupWearFactor(opts.carSetup) : 1,
        grid: i,
        lapsCompleted: 0,
        distance: 0,
        tireCompound: opts.startCompound || 'medio',
        tireWear: 0,
        fuelKg: startFuel,
        pitting: false,
        pitMsRemaining: 0,
        pitTotalMs: 0,
        lastPitDurationSec: null,
        pitStopsDone: 0,
        plannedPitLap,
        fuelPlanned: e.isPlayer && (refuelPlan === 'planned' || !!fuelTargetLap),
        pendingPitCompound: null,
        pendingRefuel: false,
        retired: false,
        retiredReason: null,
        finishedAt: null,
        displaySpeedKmh: 0,
      };
    });

    let scheduledFailure = null;
    if (opts.hasFailureEvent && !opts.isSprint && C()) {
      const picked = C().pickAffectedEntrant(cars.map((c) => ({ id: c.id, motorLevel: c.motorLevel, chassiLevel: c.chassiLevel })));
      if (picked) {
        scheduledFailure = {
          carId: picked.id,
          lap: 2 + Math.floor(Math.random() * Math.max(1, totalLaps - 4)),
          info: C().rollFailureType(picked.motorLevel, picked.chassiLevel),
          triggered: false,
        };
      }
    }

    let weatherEvent = null;
    const rainChance = opts.rainChance != null ? opts.rainChance : 0.2;
    if (!opts.isSprint && Math.random() < rainChance) {
      weatherEvent = {
        startLap: Math.floor(totalLaps * 0.3 + Math.random() * totalLaps * 0.3),
        stage: 'chuva_leve',
        escalateLap: null,
        triggered: false,
        escalated: false,
      };
      if (Math.random() < 0.4) weatherEvent.escalateLap = weatherEvent.startLap + Math.max(3, Math.floor(totalLaps * 0.15));
    }

    return {
      cars,
      totalLaps,
      raceRealMs,
      elapsedMs: 0,
      weather: 'seco',
      scheduledFailure,
      weatherEvent,
      baseSpeedPerMs: (totalLaps * 100) / raceRealMs,
      fullFuelKg,
      isSprint: !!opts.isSprint,
      circuit: opts.circuit || '',
      finished: false,
      log: [],
      pitStopMsByTeam: opts.pitStopMsByTeam || null,
      // estilo de pilotagem do jogador — ajustável AO VIVO durante a
      // corrida (setDrivingStyle), não só fixado na largada
      playerDrivingStyle: (opts.drivingStyle && C() && C().DRIVING_STYLES[opts.drivingStyle])
        ? opts.drivingStyle
        : (C() ? C().defaultDrivingStyle() : 'equilibrado'),
    };
  }

  // chamada externa: muda o estilo de pilotagem do jogador em tempo real,
  // no meio da corrida — o próximo tick de stepRace já aplica o novo ritmo/
  // desgaste/consumo, sem precisar recriar o raceState
  function setDrivingStyle(state, style) {
    if (C() && C().DRIVING_STYLES[style]) state.playerDrivingStyle = style;
  }

  function pushLog(state, text) {
    state.log.unshift({ t: Math.round(state.elapsedMs / 1000), text });
    if (state.log.length > 40) state.log.length = 40;
  }

  function applyWeatherTick(state) {
    const we = state.weatherEvent;
    if (!we) return;
    const leaderLap = Math.max(...state.cars.filter((c) => !c.retired).map((c) => c.lapsCompleted), 0);
    if (!we.triggered && leaderLap >= we.startLap) {
      we.triggered = true;
      state.weather = we.stage;
      pushLog(state, '🌧️ Começa a chover em ' + state.circuit + '!');
    }
    if (we.triggered && !we.escalated && we.escalateLap != null && leaderLap >= we.escalateLap) {
      we.escalated = true;
      state.weather = 'chuva_forte';
      pushLog(state, '⛈️ A chuva piora — pista muito escorregadia!');
    }
  }

  function maybePlanPit(car, state, opts) {
    if (car.retired || car.pitting || car.pendingPitCompound) return;
    const ideal = idealCompoundFor(state.weather);
    if (ideal && car.tireCompound !== ideal) {
      car.pendingPitCompound = ideal;
      return;
    }
    if (!ideal && ['intermediario', 'chuva'].includes(car.tireCompound)) {
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
    car.pitMsRemaining = pitStopMsForCar(car, opts) + (car.pendingRefuel ? 3000 : 0);
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

    state.cars.forEach((car) => {
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
      // state a cada tick (não fixados na largada) — mudar de estilo ao
      // vivo já reflete no próximo tick
      const style = car.isPlayer && C() ? state.playerDrivingStyle : null;
      const stylePaceFactor = style ? C().drivingStylePaceFactor(style) : 1;
      const styleWearMult = style ? C().drivingStyleWearMult(style) : 1;
      const styleFuelMult = style ? C().drivingStyleFuelMult(style) : 1;

      const grip = C() ? C().tireEffectiveGrip(car.tireCompound, state.weather, car.tireSupplier) : 1;
      const wearPenalty = distancePenaltyFromWear(car.tireWear);
      const fuelPenalty = distancePenaltyFromFuel(car.fuelKg, state.fullFuelKg);
      const variance = 1 + (Math.random() - 0.5) * 0.06;
      const speedFactor = (car.pace / 75) * stylePaceFactor * grip * (1 - wearPenalty) * (1 - fuelPenalty) * variance;
      const speed = state.baseSpeedPerMs * speedFactor;
      car.displaySpeedKmh = Math.max(0, SPEED_DISPLAY_BASE_KMH * speedFactor);

      car.distance += speed * dtMs;
      const wearAdd = C() ? C().calcTireWear(car.tireCompound, dtMs / (state.raceRealMs / state.totalLaps), 1) : 0;
      car.tireWear = Math.min(100, car.tireWear + wearAdd * (car.wearFactor || 1) * styleWearMult);
      // combustível: motor mais potente (nível) bebe mais, E cada fabricante
      // de motor tem uma característica fixa de consumo própria — vale pra
      // todo mundo no grid, não só o jogador
      const motorFuelMult = C() ? C().motorFuelMult(car.motorLevel) : 1;
      const motorSupplierFuel = C() ? C().motorSupplierFuelFactor(car.motorSupplier) : 1;
      car.fuelKg = Math.max(0, car.fuelKg - (state.fullFuelKg / state.totalLaps) * (dtMs / (state.raceRealMs / state.totalLaps)) * styleFuelMult * motorFuelMult * motorSupplierFuel);

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
    createRaceState, stepRace, isFinished, standings, requestPit, setDrivingStyle,
  };
})();
