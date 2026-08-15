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

  function generateRivalTeam(used, index) {
    const teamName = RIVAL_TEAM_NAMES[index] || ('Equipe Rival ' + (index + 1));
    const basePace = 60 + Math.random() * 35; // 60-95
    const drivers = [0, 1].map(() => ({
      name: uniqueName(used),
      rating: Math.round(Math.max(50, Math.min(99, basePace + (Math.random() - 0.5) * 10))),
    }));
    return {
      id: 'rival_' + index,
      name: teamName,
      pace: Math.round(basePace),
      motorLevel: randLevel(),
      chassiLevel: randLevel(),
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
      if (raw) return JSON.parse(raw);
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
  function playerTeamPace(club) {
    const dep = (club && club.departments) || {};
    const motor = dep.motor || 0, chassi = dep.chassi || 0, aero = dep.aerodinamica || 0;
    return Math.min(99, 58 + (motor + chassi + aero) * 0.75);
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
      equipe.drivers.filter((d) => d.role !== 'reserva').forEach((d) => {
        entrants.push({
          id: 'player_' + d.id,
          teamId: 'player',
          teamName: equipe.teamName,
          driverName: d.name,
          isPlayer: true,
          pace: Math.max(40, Math.min(99, teamPace + ((d.rating || 65) - 65) * 0.5)),
          motorLevel, chassiLevel,
          traits: d.traits || [],
        });
      });
    }
    grid.rivals.forEach((r) => {
      r.drivers.forEach((d, i) => {
        entrants.push({
          id: r.id + '_' + i,
          teamId: r.id,
          teamName: r.name,
          driverName: d.name,
          isPlayer: false,
          pace: d.rating,
          motorLevel: r.motorLevel,
          chassiLevel: r.chassiLevel,
          traits: [],
        });
      });
    });
    return entrants;
  }

  window.WSPF1Grid = {
    RIVAL_TEAM_COUNT, loadGrid, saveGrid, freshGrid, fullGrid, playerTeamPace,
  };
})();
