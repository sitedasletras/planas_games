(() => {
  'use strict';

  // Grid de disputa: o time do jogador (lido ao vivo de pilotos.js/equipe.js,
  // então upgrades feitos na escuderia valem já na próxima sessão) + 9 equipes
  // rivais geradas uma vez e mantidas estáveis durante a temporada.

  const STORAGE_KEY = 'wsp_f1_grid_v1';
  const RIVAL_TEAM_COUNT = 9;

  const RIVAL_TEAM_NAMES = [
    'Serra Motorsport', 'Vento Sul Racing', 'Cruzeiro Grand Prix', 'Fênix Racing Team',
    'Aurora Velocidade', 'Litoral Corrida', 'Pampa Racing', 'Cerrado Motorsport', 'Ipanema Grand Prix',
  ];

  const RIVAL_FIRST_NAMES = [
    'Bruno', 'Rafael', 'Diego', 'Thiago', 'Vitor', 'Felipe', 'André', 'Caio',
    'Marcelo', 'Fábio', 'Hugo', 'Ivan', 'Alex', 'Nico', 'Pierre', 'Esteban',
    'Yuki', 'Oscar', 'Lance', 'Carlos', 'Sergio', 'Valtteri', 'Kimi', 'Jenson',
  ];
  const RIVAL_LAST_NAMES = [
    'Amaral', 'Barros', 'Cavalcante', 'Duarte', 'Esteves', 'Freitas', 'Guedes',
    'Henriques', 'Ibrahim', 'Junqueira', 'Kowalski', 'Lacerda', 'Mendonça',
    'Novaes', 'Ozorio', 'Pacheco', 'Quiroga', 'Rezende', 'Salgado', 'Tavares',
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function uniqueName(used) {
    let name;
    let guard = 0;
    do {
      name = pick(RIVAL_FIRST_NAMES) + ' ' + pick(RIVAL_LAST_NAMES);
      guard++;
    } while (used.has(name) && guard < 60);
    used.add(name);
    return name;
  }

  function randLevel() { return Math.floor(Math.random() * 21); } // 0-20, escala de departamento

  function randMotorSupplier() {
    const names = window.WSPF1Equipe ? window.WSPF1Equipe.MOTORES : [];
    return names.length ? names[Math.floor(Math.random() * names.length)] : null;
  }

  function randTireSupplier() {
    const keys = window.WSPF1Corrida ? Object.keys(window.WSPF1Corrida.TIRE_SUPPLIERS) : [];
    return keys.length ? keys[Math.floor(Math.random() * keys.length)] : null;
  }

  // rivais também podem ter especialidade de clima (ou nenhuma), igual aos
  // pilotos do jogador (pilotos.js) — pra manter justo, quem enfrenta o
  // jogador na chuva também pode ganhar ou perder ritmo por causa disso
  function randWeatherSpecialty() {
    const pool = (window.WSPF1Corrida && window.WSPF1Corrida.WEATHER_TIER_KEYS) || ['seco', 'ventos_fortes', 'chuva_grossa', 'chuva_intensa'];
    if (Math.random() >= 0.7) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function randWeatherPotencia(specialty) {
    return specialty ? Math.round(Math.random() * 20) : 0;
  }

  function generateRivalTeam(used, index) {
    const teamName = RIVAL_TEAM_NAMES[index] || ('Equipe Rival ' + (index + 1));
    // banda apertada de propósito (pedido explícito do usuário): a diferença
    // de ritmo entre equipes rivais tem que ser pequena o bastante pra
    // piloto/estratégia decidirem a corrida, não o sorteio da equipe
    const basePace = 88 + Math.random() * 9; // 88-97
    const drivers = [0, 1].map(() => {
      const weatherSpecialty = randWeatherSpecialty();
      return {
        name: uniqueName(used),
        rating: Math.round(Math.max(50, Math.min(99, basePace + (Math.random() - 0.5) * 6))),
        weatherSpecialty,
        weatherPotencia: randWeatherPotencia(weatherSpecialty),
      };
    });
    return {
      id: 'rival_' + index,
      name: teamName,
      pace: Math.round(basePace),
      motorLevel: randLevel(),
      chassiLevel: randLevel(),
      motorSupplier: randMotorSupplier(),
      tireSupplier: randTireSupplier(),
      drivers,
    };
  }

  function freshGrid() {
    const used = new Set();
    const rivals = [];
    for (let i = 0; i < RIVAL_TEAM_COUNT; i++) rivals.push(generateRivalTeam(used, i));
    return { rivals, createdAt: Date.now() };
  }

  function loadGrid() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        let changed = false;
        (parsed.rivals || []).forEach((r) => {
          if (!r.motorSupplier) { r.motorSupplier = randMotorSupplier(); changed = true; }
          if (!r.tireSupplier) { r.tireSupplier = randTireSupplier(); changed = true; }
          (r.drivers || []).forEach((d) => {
            if (d.weatherSpecialty === undefined) { d.weatherSpecialty = randWeatherSpecialty(); changed = true; }
            if (d.weatherPotencia == null) { d.weatherPotencia = randWeatherPotencia(d.weatherSpecialty); changed = true; }
          });
        });
        if (changed) saveGrid(parsed);
        return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = freshGrid();
    saveGrid(fresh);
    return fresh;
  }

  function saveGrid(grid) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(grid)); } catch (e) { /* storage unavailable */ }
  }

  // Ritmo do time do jogador: sobe com os níveis de motor/chassi/aerodinâmica —
  // é o retorno de investir na escuderia refletido direto na pista.
  // CORREÇÃO (pedido explícito do usuário): a fórmula antiga partia de 58 e
  // só chegava perto do grid com departamentos bem avançados — só que os
  // times rivais SEMPRE vivem na banda 88-97 (generateRivalTeam em grid.js),
  // não importa o nível deles (o nível deles NÃO afeta o próprio ritmo, só
  // confiabilidade). Um jogador em início de temporada (motor baixo) ficava
  // muito pra trás, virando "3 voltas de diferença em 13". Agora o
  // jogador nível 0 já entra perto do MEIO da banda dos rivais (não no
  // piso) — uma equipe nova não é necessariamente pior que a média do
  // grid — e o desenvolvimento leva até o topo da banda (97), o mesmo
  // teto que o rival mais rápido pode ter.
  function playerTeamPace(club) {
    const dep = (club && club.departments) || {};
    const motor = dep.motor || 0, chassi = dep.chassi || 0, aero = dep.aerodinamica || 0;
    const sum = Math.min(60, motor + chassi + aero); // 3 departamentos, 0-20 cada, teto 60
    return 91 + (sum / 60) * 6;
  }

  // fator de rendimento do motor nesta temporada — motores oscilam de uma
  // temporada pra outra (corrida.js/calendario.js), então o mesmo fornecedor
  // pode valer mais ou menos ritmo dependendo da temporada em curso
  function motorFactorFor(motorSupplier) {
    if (!window.WSPF1Corrida || !window.WSPF1Calendario) return 1;
    const state = window.WSPF1Calendario.loadState();
    const pct = state.motorPerformance ? state.motorPerformance[motorSupplier] : null;
    return window.WSPF1Corrida.motorPerformanceFactor(pct);
  }

  // acerto de carro escolhido no treino livre — só o jogador tem esse painel,
  // então só o ritmo do jogador reflete a escolha
  function setupFactorForPlayer() {
    if (!window.WSPF1Corrida || !window.WSPF1Calendario) return 1;
    const state = window.WSPF1Calendario.loadState();
    const weekend = window.WSPF1Calendario.currentWeekend(state);
    const setup = weekend && weekend.carSetup;
    const paceFactor = window.WSPF1Corrida.setupPaceFactor(setup);
    const asphaltFactor = (weekend && weekend.asfalto && setup)
      ? window.WSPF1Corrida.setupAsphaltMatchFactor(setup.altura, weekend.asfalto.tipo)
      : 1;
    return paceFactor * asphaltFactor;
  }

  // Monta o grid completo pra uma sessão: 2 pilotos titulares do jogador +
  // os pilotos das 9 equipes rivais, cada um com pace/motorLevel/chassiLevel
  // prontos pro motor de corrida e pro sorteio de falhas do corrida.js
  function fullGrid() {
    const grid = loadGrid();
    const entrants = [];
    if (window.WSPF1Pilotos && window.WSPF1Equipe) {
      const equipe = window.WSPF1Pilotos.loadSquad();
      const club = window.WSPF1Equipe.loadClub();
      const teamPace = playerTeamPace(club);
      const motorLevel = club.departments.motor || 0;
      const chassiLevel = club.departments.chassi || 0;
      const motorFactor = motorFactorFor(club.motorSupplier);
      const chassiFactor = window.WSPF1Equipe.chassiPaceEffectFactor(club.chassiSupplier);
      const setupFactor = setupFactorForPlayer();
      equipe.drivers.filter((d) => d.role !== 'reserva').forEach((d) => {
        // rivais variam só ±3 de rating em torno do próprio ritmo de
        // equipe (generateRivalTeam) — usar 0.5 aqui deixava o piloto
        // sozinho abrir uma diferença bem maior que isso; 0.15 deixa o
        // piloto pesar sem virar sozinho o fator decisivo da corrida.
        // TRAVA FINAL (bug real corrigido): motor/chassi/setup multiplicando
        // em cima do teamPace já ajustado podiam empilhar até ~9% de fuga
        // (3 fatores de ~3% cada) — mais que a banda 88-97 devia permitir.
        // Trava o resultado final a no máximo ±3 do teamPace da própria
        // equipe, pra nenhuma combinação de fatores virar sozinha decisiva.
        const rawPace = (teamPace + ((d.rating || 65) - 65) * 0.15) * motorFactor * chassiFactor * setupFactor;
        const cappedPace = Math.max(teamPace - 3, Math.min(teamPace + 3, rawPace));
        entrants.push({
          id: 'player_' + d.id,
          teamId: 'player',
          teamName: equipe.teamName,
          driverName: d.name,
          isPlayer: true,
          pace: Math.max(40, Math.min(99, cappedPace)),
          motorLevel, chassiLevel,
          motorSupplier: club.motorSupplier, tireSupplier: club.tireSupplier, cambioSupplier: club.cambioSupplier,
          traits: d.traits || [],
          weatherSpecialty: d.weatherSpecialty || null,
          weatherPotencia: d.weatherPotencia || 0,
          moral: d.moral,
        });
      });
    }
    grid.rivals.forEach((r) => {
      const motorFactor = motorFactorFor(r.motorSupplier);
      r.drivers.forEach((d, i) => {
        // mesma trava do jogador: fica perto do basePace nominal da
        // própria equipe (r.pace), motor não empilha até virar fuga
        const rawPace = d.rating * motorFactor;
        const cappedPace = Math.max(r.pace - 3, Math.min(r.pace + 3, rawPace));
        entrants.push({
          id: r.id + '_' + i,
          teamId: r.id,
          teamName: r.name,
          driverName: d.name,
          isPlayer: false,
          pace: Math.max(40, Math.min(99, cappedPace)),
          motorLevel: r.motorLevel,
          chassiLevel: r.chassiLevel,
          motorSupplier: r.motorSupplier, tireSupplier: r.tireSupplier,
          traits: [],
          weatherSpecialty: d.weatherSpecialty || null,
          weatherPotencia: d.weatherPotencia || 0,
        });
      });
    });
    return entrants;
  }

  window.WSPF1Grid = {
    RIVAL_TEAM_COUNT, loadGrid, saveGrid, freshGrid, fullGrid, playerTeamPace,
  };
})();
