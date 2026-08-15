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
    const refuelPlan = opts.isSprint ? (opts.refuelPlan || 'none') : 'none';

    const cars = entrants.map((e, i) => {
      const startFuel = refuelPlan === 'planned' ? Math.round(fullFuelKg * 0.5) : fullFuelKg;
      return {
        id: e.id,
        teamId: e.teamId,
        teamName: e.teamName,
        driverName: e.driverName,
        isPlayer: !!e.isPlayer,
        pace: e.pace,
        motorLevel: e.motorLevel || 0,
        chassiLevel: e.chassiLevel || 0,
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
        pitStopsDone: 0,
        plannedPitLap: refuelPlan === 'planned'
          ? Math.max(1, Math.floor(totalLaps / 2))
          : (opts.isSprint ? null : (C() ? Math.min(totalLaps - 2, C().calcStintLaps(opts.startCompound || 'medio', 90)) : Math.floor(totalLaps * 0.55))),
        pendingPitCompound: null,
        pendingRefuel: false,
        retired: false,
        retiredReason: null,
        finishedAt: null,
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
    };
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
      car.pendingRefuel = car.fuelKg < state.fullFuelKg * 0.4;
    }
  }

  function startPit(car, state, opts) {
    car.pitting = true;
    car.pitMsRemaining = pitStopMsForCar(car, opts) + (car.pendingRefuel ? 3000 : 0);
    if (car.isPlayer) pushLog(state, '🔧 ' + car.driverName + ' entra nos boxes.');
  }

  function finishPit(car, state) {
    car.pitting = false;
    car.tireCompound = car.pendingPitCompound || car.tireCompound;
    car.tireWear = 0;
    car.pendingPitCompound = null;
    car.plannedPitLap = null;
    car.pitStopsDone++;
    if (car.pendingRefuel) {
      car.fuelKg = state.fullFuelKg * 0.5;
      car.pendingRefuel = false;
    }
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
      if (car.retired || car.finishedAt != null) return;

      if (car.pitting) {
        car.pitMsRemaining -= dtMs;
        if (car.pitMsRemaining <= 0) finishPit(car, state);
        return;
      }

      if (car.pendingPitCompound && Math.random() < 0.55) {
        startPit(car, state, { pitStopMsByTeam: state.pitStopMsByTeam });
        return;
      }

      const grip = C() ? C().tireEffectiveGrip(car.tireCompound, state.weather, car.tireSupplier) : 1;
      const wearPenalty = distancePenaltyFromWear(car.tireWear);
      const fuelPenalty = distancePenaltyFromFuel(car.fuelKg, state.fullFuelKg);
      const variance = 1 + (Math.random() - 0.5) * 0.06;
      const speed = state.baseSpeedPerMs * (car.pace / 75) * grip * (1 - wearPenalty) * (1 - fuelPenalty) * variance;

      car.distance += speed * dtMs;
      const wearAdd = C() ? C().calcTireWear(car.tireCompound, dtMs / (state.raceRealMs / state.totalLaps), 1) : 0;
      car.tireWear = Math.min(100, car.tireWear + wearAdd * (car.wearFactor || 1));
      car.fuelKg = Math.max(0, car.fuelKg - (state.fullFuelKg / state.totalLaps) * (dtMs / (state.raceRealMs / state.totalLaps)));

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
    createRaceState, stepRace, isFinished, standings, requestPit,
  };
})();
