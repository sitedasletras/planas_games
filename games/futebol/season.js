(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_season_v1';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const TEAMS_PER_TIER = 10;
  const PROMOTE_COUNT = 4;
  const RELEGATE_COUNT = 4;

  // ---------- Tier ladder ----------
  // 10 níveis, agrupados em 4 campeonatos nomeados. Índice 0 = pior (entrada), 9 = melhor (topo atual).
  const TIER_GROUPS = [
    { key: 'bairro', label: 'Campeonato do Bairro', divisions: 3 },
    { key: 'cidade', label: 'Campeonato da Cidade', divisions: 3 },
    { key: 'regional', label: 'Campeonato Regional', divisions: 2 },
    { key: 'estadual', label: 'Campeonato Estadual', divisions: 2 },
  ];

  function ordinal(n) { return n + 'ª'; }

  const TIERS = [];
  TIER_GROUPS.forEach((g) => {
    for (let d = g.divisions; d >= 1; d--) {
      TIERS.push({
        group: g.key,
        groupLabel: g.label,
        division: d,
        label: g.label + ' — ' + ordinal(d) + ' Divisão',
        strengthBase: 0.3 + (TIERS.length * 0.055), // fica mais forte a cada nível
      });
    }
  });

  // ---------- Copa ladder ----------
  const COPA_TIERS = [
    { key: 'bairro', label: 'Copa do Bairro', strengthBase: 0.32 },
    { key: 'cidade', label: 'Copa da Cidade', strengthBase: 0.5 },
    { key: 'regional', label: 'Torneio Classificatório', strengthBase: 0.68 },
    { key: 'estadual', label: 'Jogos por Chave', strengthBase: 0.85 },
  ];

  function seasonLetter(seasonIndex) {
    if (seasonIndex < 26) return LETTERS[seasonIndex];
    const cycle = Math.floor(seasonIndex / 26);
    return LETTERS[seasonIndex % 26].repeat(cycle + 1);
  }

  // ---------- AI club names ----------
  const NAME_PREFIXES = [
    'Vila Nova', 'Jardim América', 'Cruzeiro do Sul', 'União', 'Atlético', 'Operário',
    'Ferroviário', 'Guarani', 'Palestra', 'Independente', 'Real', 'Nacional', 'Estrela',
    'Progresso', 'Popular', 'Vitória', 'Aliança', 'Recreativo', 'Democrata',
    'Sport', 'Comercial', 'Rio Branco', 'Bela Vista', 'Santa Cruz', 'Primavera',
  ];
  const NAME_SUFFIXES = ['FC', 'EC', 'AC', 'SC', 'AA', 'FBC'];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomClubName(usedNames) {
    let name;
    let guard = 0;
    do {
      name = pick(NAME_PREFIXES) + ' ' + pick(NAME_SUFFIXES);
      guard++;
    } while (usedNames.has(name) && guard < 50);
    usedNames.add(name);
    return name;
  }

  function generateOpponents(count, strengthBase) {
    const used = new Set(['Bandeirantes']);
    const list = [];
    for (let i = 0; i < count; i++) {
      const variance = (Math.random() - 0.5) * 0.22;
      list.push({
        id: 'ai_' + i + '_' + Math.random().toString(36).slice(2, 7),
        name: randomClubName(used),
        strength: clamp(strengthBase + variance, 0.15, 0.97),
        lastWindow: null,
      });
    }
    return list;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ---------- Mercado de transferências (rivais) ----------
  // clubes de cada divisão são um "pool" persistente (state.tierClubs) — a
  // cada vez que o usuário volta a jogar naquela divisão, os rivais que ele
  // já enfrentou lá se reforçam ou perdem peças, em vez de sortear um elenco
  // totalmente novo do zero
  function applyTransferWindow(clubs) {
    clubs.forEach((c) => {
      const roll = Math.random();
      if (roll < 0.12) {
        c.strength = clamp(c.strength + 0.05 + Math.random() * 0.07, 0.15, 0.97);
        c.lastWindow = 'reforco';
      } else if (roll < 0.24) {
        c.strength = clamp(c.strength - (0.05 + Math.random() * 0.07), 0.15, 0.97);
        c.lastWindow = 'perda';
      } else {
        c.strength = clamp(c.strength + (Math.random() - 0.5) * 0.03, 0.15, 0.97);
        c.lastWindow = null;
      }
    });
  }

  function ensureTierClubPool(state, tierIndex) {
    if (!state.tierClubs) state.tierClubs = {};
    if (!state.tierClubs[tierIndex]) {
      const tier = TIERS[tierIndex];
      state.tierClubs[tierIndex] = generateOpponents(TEAMS_PER_TIER - 1, tier.strengthBase);
    } else {
      applyTransferWindow(state.tierClubs[tierIndex]);
    }
    return state.tierClubs[tierIndex];
  }

  // ---------- Result simulation ----------
  function poissonSample(lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  function simulateScore(strengthHome, strengthAway) {
    const diff = strengthHome - strengthAway;
    const homeLambda = clamp(1.35 + diff * 1.6, 0.25, 4.2);
    const awayLambda = clamp(1.05 - diff * 1.6, 0.2, 4.0);
    return { golsHome: poissonSample(homeLambda), golsAway: poissonSample(awayLambda) };
  }

  function estimateSquadStrength(squad) {
    if (!squad || !squad.players || !squad.players.length) return 0.5;
    const avgRating = squad.players.reduce((s, p) => s + (p.rating || 60), 0) / squad.players.length;
    // baseline ~60 de nota -> força média (0.5); escala suave
    return clamp(0.5 + (avgRating - 60) / 80, 0.15, 0.97);
  }

  // ---------- Round-robin schedule (turno e returno) ----------
  // Círculo de Berger: N times (par), gera N-1 rodadas de N/2 jogos; depois inverte mandos p/ o returno.
  function circleRounds(teamIds) {
    const ids = teamIds.slice();
    if (ids.length % 2 !== 0) ids.push(null); // bye, não deve acontecer com 10 times
    const n = ids.length;
    const rounds = [];
    const fixed = ids[0];
    let rest = ids.slice(1);
    for (let r = 0; r < n - 1; r++) {
      const roundTeams = [fixed, ...rest];
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = roundTeams[i];
        const b = roundTeams[n - 1 - i];
        if (a != null && b != null) {
          pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
        }
      }
      rounds.push(pairs);
      rest.unshift(rest.pop());
    }
    return rounds;
  }

  function doubleRoundRobin(teamIds) {
    const first = circleRounds(teamIds);
    const second = first.map((round) => round.map((m) => ({ home: m.away, away: m.home })));
    return [...first, ...second];
  }

  // ---------- League ----------
  function freshLeague(tierIndex, clubName, state) {
    const opponents = state
      ? ensureTierClubPool(state, tierIndex).map((c) => ({ ...c }))
      : generateOpponents(TEAMS_PER_TIER - 1, TIERS[tierIndex].strengthBase);
    const teams = [{ id: 'user', name: clubName, strength: null, isUser: true }, ...opponents];
    const fixtures = doubleRoundRobin(teams.map((t) => t.id));
    const standings = {};
    teams.forEach((t) => { standings[t.id] = { id: t.id, name: t.name, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0 }; });
    return {
      tierIndex,
      teams,
      fixtures, // array de rodadas -> array de {home, away, golsHome?, golsAway?, played}
      standings,
      round: 0, // rodadas concluídas
    };
  }

  function teamById(league, id) { return league.teams.find((t) => t.id === id); }

  function applyResult(league, homeId, awayId, golsHome, golsAway) {
    const sh = league.standings[homeId], sa = league.standings[awayId];
    sh.played++; sa.played++;
    sh.gf += golsHome; sh.ga += golsAway;
    sa.gf += golsAway; sa.ga += golsHome;
    if (golsHome > golsAway) { sh.pts += 3; sh.w++; sa.l++; }
    else if (golsHome < golsAway) { sa.pts += 3; sa.w++; sh.l++; }
    else { sh.pts += 1; sa.pts += 1; sh.d++; sa.d++; }
  }

  function playRound(state, userResult) {
    const league = state.league;
    const roundIdx = league.round;
    if (roundIdx >= league.fixtures.length) return { ok: false, reason: 'season-over' };
    const round = league.fixtures[roundIdx];
    round.forEach((m) => {
      if (m.played) return;
      let golsHome, golsAway;
      if (m.home === 'user' || m.away === 'user') {
        if (userResult) {
          golsHome = m.home === 'user' ? userResult.golsUser : userResult.golsRival;
          golsAway = m.home === 'user' ? userResult.golsRival : userResult.golsUser;
        } else {
          const userStrength = estimateSquadStrength(state.userSquadSnapshot);
          const rival = teamById(league, m.home === 'user' ? m.away : m.home);
          const sim = simulateScore(
            m.home === 'user' ? userStrength : rival.strength,
            m.home === 'user' ? rival.strength : userStrength
          );
          golsHome = sim.golsHome; golsAway = sim.golsAway;
        }
      } else {
        const home = teamById(league, m.home), away = teamById(league, m.away);
        const sim = simulateScore(home.strength, away.strength);
        golsHome = sim.golsHome; golsAway = sim.golsAway;
      }
      m.golsHome = golsHome; m.golsAway = golsAway; m.played = true;
      applyResult(league, m.home, m.away, golsHome, golsAway);
      if (m.home === 'user' || m.away === 'user') {
        const isHome = m.home === 'user';
        const golsFor = isHome ? golsHome : golsAway;
        const golsAgainst = isHome ? golsAway : golsHome;
        const opponent = teamById(league, isHome ? m.away : m.home);
        recordUserMatch(state, golsFor, golsAgainst, opponent ? opponent.name : '???', TIERS[state.tierIndex].label);
      }
    });
    league.round++;
    return { ok: true, round };
  }

  function currentUserFixture(league) {
    if (league.round >= league.fixtures.length) return null;
    const round = league.fixtures[league.round];
    return round.find((m) => m.home === 'user' || m.away === 'user') || null;
  }

  function sortedStandings(league) {
    return Object.values(league.standings).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  }

  function isLeagueOver(league) { return league.round >= league.fixtures.length; }

  function leagueOutcome(league) {
    const table = sortedStandings(league);
    const promoted = table.slice(0, PROMOTE_COUNT).map((t) => t.id);
    const relegated = table.slice(-RELEGATE_COUNT).map((t) => t.id);
    const userPos = table.findIndex((t) => t.id === 'user') + 1;
    const userPromoted = promoted.includes('user');
    const userRelegated = relegated.includes('user') && !userPromoted;
    return { table, promoted, relegated, userPos, userPromoted, userRelegated };
  }

  // ---------- Copa (estilo Copa do Mundo, 8 grupos de 4) ----------
  const GROUP_COUNT = 8, GROUP_SIZE = 4, COPA_TEAMS = GROUP_COUNT * GROUP_SIZE;

  function groupRounds() {
    // 4 times (0..3), rodízio padrão de 3 rodadas
    return [
      [[0, 3], [1, 2]],
      [[0, 2], [3, 1]],
      [[0, 1], [2, 3]],
    ];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function freshCopa(copaTierIndex, clubName) {
    const tier = COPA_TIERS[copaTierIndex];
    const opponents = generateOpponents(COPA_TEAMS - 1, tier.strengthBase);
    const allTeams = shuffle([{ id: 'user', name: clubName, strength: null, isUser: true }, ...opponents]);
    const groups = [];
    for (let g = 0; g < GROUP_COUNT; g++) {
      const members = allTeams.slice(g * GROUP_SIZE, g * GROUP_SIZE + GROUP_SIZE);
      const standings = {};
      members.forEach((t) => { standings[t.id] = { id: t.id, name: t.name, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0 }; });
      const fixtures = groupRounds().map((round) => round.map(([a, b]) => ({
        home: members[a].id, away: members[b].id, played: false,
      })));
      groups.push({ index: g, members, standings, fixtures, round: 0 });
    }
    return {
      copaTierIndex,
      stage: 'grupos',
      groups,
      playoff: null,   // { pairs: [...], round: 0 }
      oitavas: null,   // { matches: [...] }
      quartas: null,
      semis: null,
      final: null,
      champion: null,
      relegatedIds: [],
      promotedIds: [],
      userEliminated: false,
    };
  }

  function copaTeamById(copa, id) {
    for (const g of copa.groups) {
      const t = g.members.find((m) => m.id === id);
      if (t) return t;
    }
    for (const pool of [copa.oitavas, copa.quartas, copa.semis, copa.final]) {
      if (pool && pool.pool) {
        const t = pool.pool.find((m) => m.id === id);
        if (t) return t;
      }
    }
    return null;
  }

  function groupIsOver(g) { return g.round >= g.fixtures.length; }

  function playGroupRound(copa, groupIndex, userResult, state) {
    const g = copa.groups[groupIndex];
    if (groupIsOver(g)) return { ok: false };
    const round = g.fixtures[g.round];
    round.forEach((m) => {
      let golsHome, golsAway;
      if (m.home === 'user' || m.away === 'user') {
        if (userResult) {
          golsHome = m.home === 'user' ? userResult.golsUser : userResult.golsRival;
          golsAway = m.home === 'user' ? userResult.golsRival : userResult.golsUser;
        } else {
          const sim = simulateStrengthPair(copa, m.home, m.away);
          golsHome = sim.golsHome; golsAway = sim.golsAway;
        }
      } else {
        const home = copaTeamById(copa, m.home), away = copaTeamById(copa, m.away);
        const sim = simulateScore(home.strength, away.strength);
        golsHome = sim.golsHome; golsAway = sim.golsAway;
      }
      m.golsHome = golsHome; m.golsAway = golsAway; m.played = true;
      applyResult({ standings: g.standings }, m.home, m.away, golsHome, golsAway);
      if ((m.home === 'user' || m.away === 'user') && state) {
        const isHome = m.home === 'user';
        const golsFor = isHome ? golsHome : golsAway;
        const golsAgainst = isHome ? golsAway : golsHome;
        const opponent = copaTeamById(copa, isHome ? m.away : m.home);
        recordUserMatch(state, golsFor, golsAgainst, opponent ? opponent.name : '???', COPA_TIERS[state.copaTierIndex].label);
      }
    });
    g.round++;
    return { ok: true };
  }

  function simulateStrengthPair(copa, homeId, awayId, userStrengthOverride) {
    const userStrength = userStrengthOverride != null ? userStrengthOverride : copa.userStrength || 0.5;
    const homeStrength = homeId === 'user' ? userStrength : copaTeamById(copa, homeId).strength;
    const awayStrength = awayId === 'user' ? userStrength : copaTeamById(copa, awayId).strength;
    return simulateScore(homeStrength, awayStrength);
  }

  function allGroupsOver(copa) { return copa.groups.every(groupIsOver); }

  function playAllGroupsRound(copa, userResult, state) {
    copa.groups.forEach((g, i) => {
      if (groupIsOver(g)) return;
      const isUserGroup = g.members.some((m) => m.id === 'user');
      playGroupRound(copa, i, isUserGroup ? userResult : null, state);
    });
  }

  function groupStandingsSorted(g) {
    return Object.values(g.standings).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  }

  function advanceFromGroups(copa) {
    const firsts = [], seconds = [], thirds = [], fourths = [];
    copa.groups.forEach((g) => {
      const table = groupStandingsSorted(g);
      firsts.push(table[0]); seconds.push(table[1]); thirds.push(table[2]); fourths.push(table[3]);
    });
    copa.relegatedIds = fourths.map((t) => t.id);
    if (copa.relegatedIds.includes('user')) copa.userEliminated = true;

    // playoff: 2os x 3os de grupos diferentes
    const pool2 = shuffle(seconds), pool3 = shuffle(thirds);
    const pairs = [];
    for (let i = 0; i < pool2.length; i++) {
      let j = pool3.findIndex((t, idx) => idx >= 0 && !sameOriginalGroup(copa, t, pool2[i]));
      if (j < 0) j = 0;
      const rival = pool3.splice(j, 1)[0];
      pairs.push({ a: pool2[i].id, b: rival.id, golsA: null, golsB: null, played: false });
    }
    copa.playoffFirsts = firsts.map((t) => t.id);
    copa.playoff = { pairs };
    copa.stage = 'playoff';
  }

  function sameOriginalGroup(copa, teamA, teamB) {
    return copa.groups.some((g) => g.members.some((m) => m.id === teamA.id)
      && g.members.some((m) => m.id === teamB.id));
  }

  function playPlayoff(copa, userResult, state) {
    copa.playoff.pairs.forEach((p) => {
      if (p.played) return;
      let golsA, golsB;
      if (p.a === 'user' || p.b === 'user') {
        if (userResult) {
          golsA = p.a === 'user' ? userResult.golsUser : userResult.golsRival;
          golsB = p.a === 'user' ? userResult.golsRival : userResult.golsUser;
        } else {
          const sim = simulateStrengthPair(copa, p.a, p.b);
          golsA = sim.golsHome; golsB = sim.golsAway;
        }
      } else {
        const teamA = copaTeamById(copa, p.a), teamB = copaTeamById(copa, p.b);
        const sim = simulateScore(teamA.strength, teamB.strength);
        golsA = sim.golsHome; golsB = sim.golsAway;
      }
      if (golsA === golsB) { if (Math.random() < 0.5) golsA++; else golsB++; } // sem empate no mata-mata
      p.golsA = golsA; p.golsB = golsB; p.played = true;
      p.winner = golsA > golsB ? p.a : p.b;
      if ((p.a === 'user' || p.b === 'user') && p.winner !== 'user') copa.userEliminated = true;
      if ((p.a === 'user' || p.b === 'user') && state) {
        const isA = p.a === 'user';
        const golsFor = isA ? golsA : golsB;
        const golsAgainst = isA ? golsB : golsA;
        const opponent = copaTeamById(copa, isA ? p.b : p.a);
        recordUserMatch(state, golsFor, golsAgainst, opponent ? opponent.name : '???', COPA_TIERS[state.copaTierIndex].label);
      }
    });
    if (copa.playoff.pairs.every((p) => p.played)) {
      const winners = copa.playoff.pairs.map((p) => p.winner);
      const combined = shuffle([...copa.playoffFirsts, ...winners]);
      copa.oitavas = { matches: buildKnockoutMatches(combined) };
      copa.stage = 'oitavas';
    }
  }

  function buildKnockoutMatches(idList) {
    const matches = [];
    for (let i = 0; i < idList.length; i += 2) {
      matches.push({ home: idList[i], away: idList[i + 1], golsHome: null, golsAway: null, played: false, winner: null });
    }
    return matches;
  }

  function playKnockoutStage(copa, stageKey, userResult, state) {
    const stage = copa[stageKey];
    stage.matches.forEach((m) => {
      if (m.played) return;
      let golsHome, golsAway;
      if (m.home === 'user' || m.away === 'user') {
        if (userResult) {
          golsHome = m.home === 'user' ? userResult.golsUser : userResult.golsRival;
          golsAway = m.home === 'user' ? userResult.golsRival : userResult.golsUser;
        } else {
          const sim = simulateStrengthPair(copa, m.home, m.away);
          golsHome = sim.golsHome; golsAway = sim.golsAway;
        }
      } else {
        const home = copaTeamById(copa, m.home), away = copaTeamById(copa, m.away);
        const sim = simulateScore(home.strength, away.strength);
        golsHome = sim.golsHome; golsAway = sim.golsAway;
      }
      if (golsHome === golsAway) { if (Math.random() < 0.5) golsHome++; else golsAway++; }
      m.golsHome = golsHome; m.golsAway = golsAway; m.played = true;
      m.winner = golsHome > golsAway ? m.home : m.away;
      if ((m.home === 'user' || m.away === 'user') && m.winner !== 'user') copa.userEliminated = true;
      if ((m.home === 'user' || m.away === 'user') && state) {
        const isHome = m.home === 'user';
        const golsFor = isHome ? golsHome : golsAway;
        const golsAgainst = isHome ? golsAway : golsHome;
        const opponent = copaTeamById(copa, isHome ? m.away : m.home);
        recordUserMatch(state, golsFor, golsAgainst, opponent ? opponent.name : '???', COPA_TIERS[state.copaTierIndex].label);
      }
    });
    if (!stage.matches.every((m) => m.played)) return;

    const winners = stage.matches.map((m) => m.winner);
    if (stageKey === 'oitavas') {
      copa.promotedIds = winners.slice(); // os 8 que chegam às quartas
      copa.quartas = { matches: buildKnockoutMatches(winners) };
      copa.stage = 'quartas';
    } else if (stageKey === 'quartas') {
      copa.semis = { matches: buildKnockoutMatches(winners) };
      copa.stage = 'semis';
    } else if (stageKey === 'semis') {
      copa.final = { matches: buildKnockoutMatches(winners) };
      copa.stage = 'final';
    } else if (stageKey === 'final') {
      copa.champion = winners[0];
      copa.stage = 'concluida';
    }
  }

  function copaUserFixture(copa) {
    if (copa.stage === 'grupos') {
      const myGroup = copa.groups.find((g) => g.members.some((m) => m.id === 'user'));
      if (!myGroup || groupIsOver(myGroup)) return null;
      const round = myGroup.fixtures[myGroup.round];
      return round.find((m) => m.home === 'user' || m.away === 'user') || null;
    }
    if (copa.stage === 'playoff') {
      const p = copa.playoff.pairs.find((p) => (p.a === 'user' || p.b === 'user') && !p.played);
      return p ? { home: p.a, away: p.b, isPlayoff: true } : null;
    }
    const stage = copa[copa.stage];
    if (stage && stage.matches) {
      return stage.matches.find((m) => (m.home === 'user' || m.away === 'user') && !m.played) || null;
    }
    return null;
  }

  function userStillIn(copa) {
    return !copa.userEliminated;
  }

  // ---------- Estatísticas de carreira do clube ----------
  function freshCareerStats() {
    return {
      wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0,
      matchesPlayed: 0,
      biggestWin: null, // { golsFor, golsAgainst, opponent, competition }
      trophiesLiga: 0, trophiesCopa: 0,
    };
  }

  function recordUserMatch(state, golsFor, golsAgainst, opponentName, competitionLabel) {
    if (!state) return;
    if (!state.careerStats) state.careerStats = freshCareerStats();
    const cs = state.careerStats;
    cs.matchesPlayed++;
    cs.goalsFor += golsFor;
    cs.goalsAgainst += golsAgainst;
    if (golsFor > golsAgainst) cs.wins++;
    else if (golsFor < golsAgainst) cs.losses++;
    else cs.draws++;
    if (golsFor > golsAgainst) {
      const diff = golsFor - golsAgainst;
      const prevDiff = cs.biggestWin ? cs.biggestWin.golsFor - cs.biggestWin.golsAgainst : -1;
      if (diff > prevDiff) cs.biggestWin = { golsFor, golsAgainst, opponent: opponentName, competition: competitionLabel };
    }
  }

  // ---------- Persistência ----------
  function freshState() {
    return {
      seasonIndex: 0,
      tierIndex: 0,
      league: null,
      copa: null,
      copaTierIndex: 0,
      history: [],
      careerStats: freshCareerStats(),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.careerStats) parsed.careerStats = freshCareerStats();
        return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    return freshState();
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function ensureLeague(state, clubName, userSquad) {
    if (!state.league) {
      state.league = freshLeague(state.tierIndex, clubName, state);
      state.league.userSquadSnapshot = userSquad;
    }
    return state.league;
  }

  function copaEligible(tierIndex) {
    const tier = TIERS[tierIndex];
    return COPA_TIERS.some((ct) => ct.key === tier.group);
  }

  function ensureCopa(state, clubName, userSquad) {
    if (!copaEligible(state.tierIndex)) return null;
    if (!state.copa) {
      state.copa = freshCopa(state.copaTierIndex, clubName);
      state.copa.userStrength = estimateSquadStrength(userSquad);
    }
    return state.copa;
  }

  function finishLeagueSeason(state) {
    const outcome = leagueOutcome(state.league);
    let newTierIndex = state.tierIndex;
    if (outcome.userPromoted) newTierIndex = Math.min(TIERS.length - 1, state.tierIndex + 1);
    else if (outcome.userRelegated) newTierIndex = Math.max(0, state.tierIndex - 1);

    state.history.unshift({
      seasonLetter: seasonLetter(state.seasonIndex),
      tierLabel: TIERS[state.tierIndex].label,
      userPos: outcome.userPos,
      promoted: outcome.userPromoted,
      relegated: outcome.userRelegated,
      type: 'liga',
    });

    if (outcome.userPos === 1) {
      if (!state.careerStats) state.careerStats = freshCareerStats();
      state.careerStats.trophiesLiga++;
    }

    state.tierIndex = newTierIndex;
    state.seasonIndex++;
    state.league = null;
    saveState(state);
    return outcome;
  }

  function finishCopaSeason(state) {
    const copa = state.copa;
    const userPromoted = copa.promotedIds.includes('user');
    const userRelegated = copa.relegatedIds.includes('user');
    let newCopaTierIndex = state.copaTierIndex;
    if (userPromoted) newCopaTierIndex = Math.min(COPA_TIERS.length - 1, state.copaTierIndex + 1);
    else if (userRelegated) newCopaTierIndex = Math.max(0, state.copaTierIndex - 1);

    state.history.unshift({
      seasonLetter: seasonLetter(state.seasonIndex),
      tierLabel: COPA_TIERS[state.copaTierIndex].label,
      champion: copa.champion === 'user',
      promoted: userPromoted,
      relegated: userRelegated,
      type: 'copa',
    });

    if (copa.champion === 'user') {
      if (!state.careerStats) state.careerStats = freshCareerStats();
      state.careerStats.trophiesCopa++;
    }

    state.copaTierIndex = newCopaTierIndex;
    state.copa = null;
    saveState(state);
    return { userPromoted, userRelegated, champion: copa.champion === 'user' };
  }

  window.WSPSeason = {
    TIERS, COPA_TIERS, TIER_GROUPS,
    seasonLetter,
    loadState, saveState, freshState,
    ensureLeague, ensureCopa, copaEligible,
    playRound, currentUserFixture, sortedStandings, isLeagueOver, leagueOutcome, finishLeagueSeason,
    playGroupRound, playAllGroupsRound, allGroupsOver, groupStandingsSorted, advanceFromGroups,
    playPlayoff, playKnockoutStage, copaUserFixture, userStillIn, finishCopaSeason,
    copaTeamById, estimateSquadStrength,
    freshCareerStats, recordUserMatch,
  };
})();
