(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_squad_v2'; // bumped: v2 adds age/height/nationality/avatar

  const POSITIONS = {
    goleiro: { label: 'Goleiro', bucket: 'GK' },
    zagueiro: { label: 'Zagueiro', bucket: 'DEF' },
    beque_central: { label: 'Beque Central', bucket: 'DEF' },
    quarto_zagueiro: { label: '4º Zagueiro', bucket: 'DEF' },
    libero_adiantado: { label: 'Líbero Adiantado', bucket: 'DEF' },
    libero_retaguarda: { label: 'Líbero de Retaguarda', bucket: 'DEF' },
    lateral: { label: 'Lateral', bucket: 'DEF' },
    lateral_ala: { label: 'Lateral/Ala', bucket: 'DEF' },
    lateral_zagueiro: { label: 'Lateral/Zagueiro', bucket: 'DEF' },
    volante: { label: 'Volante', bucket: 'MID' },
    segundo_volante: { label: '2º Volante', bucket: 'MID' },
    meia_defensivo: { label: 'Meia Defensivo', bucket: 'MID' },
    meia_ofensivo: { label: 'Meia Ofensivo', bucket: 'MID' },
    motorzinho: { label: 'Motorzinho', bucket: 'MID' },
    atacante_pontas: { label: 'Atacante (Pontas)', bucket: 'ATT' },
    segundo_atacante: { label: '2º Atacante', bucket: 'ATT' },
    centro_avante: { label: 'Centroavante', bucket: 'ATT' },
  };

  const TRAITS = {
    tabelar: { label: 'Entra Tabelando', gkOnly: false },
    chuveirinho: { label: 'Chuveirinho', gkOnly: false },
    sai_tocando: { label: 'Sai Tocando', gkOnly: false },
    batedor_perto: { label: 'Batedor de Falta (perto)', gkOnly: false },
    batedor_longe: { label: 'Batedor de Falta (longe)', gkOnly: false },
    gk_acrobata: { label: 'Goleiro Acrobata', gkOnly: true },
    gk_simples: { label: 'Defesa Simples', gkOnly: true },
    gk_organiza: { label: 'Coordena a Zaga', gkOnly: true },
  };

  const FEET = [
    { key: 'destro', label: 'Destro', weight: 60 },
    { key: 'canhoto', label: 'Canhoto', weight: 25 },
    { key: 'ambidestro', label: 'Ambidestro', weight: 10 },
    { key: 'pe_invertido', label: 'Pé Invertido', weight: 5 },
  ];

  const NATIONALITIES = [
    { key: 'BR', label: 'Brasil', flag: '🇧🇷', weight: 75 },
    { key: 'AR', label: 'Argentina', flag: '🇦🇷', weight: 6 },
    { key: 'UY', label: 'Uruguai', flag: '🇺🇾', weight: 4 },
    { key: 'PY', label: 'Paraguai', flag: '🇵🇾', weight: 3 },
    { key: 'CO', label: 'Colômbia', flag: '🇨🇴', weight: 3 },
    { key: 'PT', label: 'Portugal', flag: '🇵🇹', weight: 3 },
    { key: 'ES', label: 'Espanha', flag: '🇪🇸', weight: 2 },
    { key: 'NG', label: 'Nigéria', flag: '🇳🇬', weight: 2 },
    { key: 'FR', label: 'França', flag: '🇫🇷', weight: 2 },
  ];

  const AGE_BUCKETS = [
    { range: [17, 20], weight: 15 },
    { range: [21, 23], weight: 25 },
    { range: [24, 29], weight: 35 },
    { range: [30, 33], weight: 18 },
    { range: [34, 38], weight: 7 },
  ];

  const HEIGHT_RANGE = { GK: [183, 198], DEF: [178, 194], MID: [168, 186], ATT: [168, 188] };

  const CAREER_STAGES = {
    promessa: { label: 'Promessa' },
    ascensao: { label: 'Em Ascensão' },
    auge: { label: 'Auge' },
    experiente: { label: 'Experiente' },
    declinio: { label: 'Declínio' },
  };

  function careerStageFor(age) {
    if (age <= 20) return 'promessa';
    if (age <= 23) return 'ascensao';
    if (age <= 30) return 'auge';
    if (age <= 33) return 'experiente';
    return 'declinio';
  }

  const SKIN_TONES = ['#f2c9a1', '#e0ac69', '#c68642', '#8d5524', '#5a3825'];
  const HAIR_COLORS = ['#1a1a1a', '#3b2314', '#7a4a1e', '#b5651d', '#e8c15a'];
  const HAIR_STYLES = ['curto', 'moicano', 'cacheado'];

  function generateAvatar(age) {
    const older = age > 32;
    const bald = Math.random() < (older ? 0.3 : 0.06);
    const grey = !bald && Math.random() < (older ? 0.4 : 0.03);
    return {
      skin: pick(SKIN_TONES),
      hairColor: grey ? '#c9c9c9' : pick(HAIR_COLORS),
      hairStyle: pick(HAIR_STYLES),
      bald,
    };
  }

  function randomAge() {
    const bucket = weightedPickObj(AGE_BUCKETS);
    const [min, max] = bucket.range;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function randomHeight(bucket) {
    const [min, max] = HEIGHT_RANGE[bucket];
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function weightedPickObj(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of list) {
      if (r < x.weight) return x;
      r -= x.weight;
    }
    return list[0];
  }

  const FIRST_NAMES = [
    'Léo', 'Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Bruno', 'Diego', 'Thiago',
    'Vitor', 'Felipe', 'Igor', 'André', 'Caio', 'Danilo', 'Everton', 'Wesley',
    'Jonas', 'Kaique', 'Renan', 'Otávio', 'Fábio', 'Gustavo', 'Marcelo',
    'Alisson', 'Douglas', 'Elias', 'Fernando', 'Hugo', 'Ivan', 'Josué',
  ];
  const LAST_NAMES = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Almeida', 'Ferreira',
    'Costa', 'Pereira', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Barbosa',
    'Cardoso', 'Ribeiro', 'Teixeira', 'Moreira', 'Correia', 'Nascimento',
  ];

  const SQUAD_PLAN = [
    ...rep('goleiro', 2),
    ...rep('zagueiro', 2), ...rep('lateral', 2), ...rep('lateral_ala', 1), ...rep('quarto_zagueiro', 1),
    ...rep('volante', 2), ...rep('meia_ofensivo', 1), ...rep('meia_defensivo', 1),
    ...rep('centro_avante', 2), ...rep('atacante_pontas', 1), ...rep('segundo_atacante', 1),
  ];
  const FULL_SQUAD_SIZE = 23; // tamanho recomendado de um elenco completo
  function rep(key, n) { return Array(n).fill(key); }

  function weightedPick(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of list) {
      if (r < x.weight) return x.key;
      r -= x.weight;
    }
    return list[0].key;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const STAGE_SALARY_MULT = { promessa: 0.6, ascensao: 0.85, auge: 1.3, experiente: 1.0, declinio: 0.7 };
  const BUCKET_BASE_SALARY = { GK: 60, DEF: 56, MID: 64, ATT: 76 };

  function randomSalary(bucket, age) {
    const stage = careerStageFor(age);
    const base = BUCKET_BASE_SALARY[bucket] * STAGE_SALARY_MULT[stage];
    const variance = 0.8 + Math.random() * 0.5;
    return Math.round((base * variance) / 10) * 10;
  }

  const STAGE_RATING_MULT = { promessa: 0.82, ascensao: 0.93, auge: 1.08, experiente: 1.0, declinio: 0.88 };
  const BUCKET_BASE_RATING = { GK: 58, DEF: 56, MID: 58, ATT: 60 };

  function randomRating(bucket, age) {
    const stage = careerStageFor(age);
    const base = BUCKET_BASE_RATING[bucket] * STAGE_RATING_MULT[stage];
    const variance = (Math.random() - 0.5) * 16;
    return Math.round(Math.max(35, Math.min(99, base + variance)));
  }

  // Potencial: teto de crescimento do jogador, numa escala 0-200 (separado da nota
  // atual). No primeiro torneio (bairro), o elenco/mercado normal fica entre 2 e 10;
  // raramente aparece uma "joia" jovem com potencial até 15, bem mais cara de contratar.
  // Escala reservada até 200 para ligas mais avançadas no futuro (estilo Elifoot).
  const POTENTIAL_GEM_CHANCE = 0.08;
  function randomPotential(age) {
    const stage = careerStageFor(age);
    const isYoung = stage === 'promessa' || stage === 'ascensao';
    if (isYoung && Math.random() < POTENTIAL_GEM_CHANCE) {
      return 11 + Math.floor(Math.random() * 5); // joia: 11-15
    }
    return 2 + Math.floor(Math.random() * 9); // normal: 2-10
  }

  // O passe (valor de mercado) é independente do salário: fica sempre entre MARKET_VALUE_MIN
  // e MARKET_VALUE_MAX — um clube do bairro só encontra jogadores nessa faixa modesta.
  const MARKET_VALUE_MIN = 500, MARKET_VALUE_MAX = 3000;
  const BUCKET_BASE_VALUE = { GK: 1000, DEF: 900, MID: 1100, ATT: 1300 };

  function randomMarketValue(bucket, age, rating) {
    const stage = careerStageFor(age);
    const base = BUCKET_BASE_VALUE[bucket] * STAGE_RATING_MULT[stage];
    const ratingFactor = 0.5 + ((rating || 60) / 99) * 0.9;
    const variance = 0.85 + Math.random() * 0.3;
    const raw = base * ratingFactor * variance;
    return Math.max(MARKET_VALUE_MIN, Math.min(MARKET_VALUE_MAX, Math.round(raw / 50) * 50));
  }

  function releaseCost(player) {
    const value = player.marketValue || MARKET_VALUE_MIN;
    return Math.max(50, Math.round(value * 0.3 / 10) * 10);
  }

  function transferFee(player) {
    const base = player.marketValue || MARKET_VALUE_MIN;
    const potential = player.potential || 5;
    // acima do teto "normal" (10), cada ponto de potencial encarece bastante a contratação —
    // pagar por uma joia é uma aposta cara para o orçamento de um clube iniciante
    const premium = potential > 10 ? 1 + (potential - 10) * 0.35 : 1;
    return Math.max(MARKET_VALUE_MIN, Math.round((base * premium) / 50) * 50);
  }

  // Aplicada quando o clube conquista um título: o elenco atual "recebe valorização" —
  // não fica preso ao teto normal de passe, refletindo o prestígio do time campeão.
  function applyValorizacao(squad, boostPct, ratingBoost) {
    squad.players.forEach((p) => {
      const base = p.marketValue || MARKET_VALUE_MIN;
      p.marketValue = Math.round(base * (1 + boostPct) / 50) * 50;
      p.rating = Math.min(99, (p.rating || 60) + ratingBoost);
    });
    saveSquad(squad);
  }

  function makeRandomPlayer(posKey, usedNames) {
    let name;
    do {
      name = pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
    } while (usedNames.has(name));
    usedNames.add(name);

    const bucket = POSITIONS[posKey].bucket;
    const foot = weightedPick(FEET);
    const traits = [];

    if (bucket === 'GK') {
      traits.push(pick(['gk_acrobata', 'gk_simples', 'gk_organiza']));
    } else {
      const roll = Math.random();
      const pool = ['tabelar', 'chuveirinho', 'sai_tocando', 'batedor_perto', 'batedor_longe'];
      if (roll < 0.35) traits.push(pick(pool));
      if (roll < 0.1) {
        const t2 = pick(pool);
        if (!traits.includes(t2)) traits.push(t2);
      }
    }

    const age = randomAge();
    const rating = randomRating(bucket, age);

    return {
      id: 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      number: null,
      name,
      position: posKey,
      bucket,
      foot,
      traits,
      age,
      height: randomHeight(bucket),
      nationality: weightedPickObj(NATIONALITIES).key,
      avatar: generateAvatar(age),
      salary: randomSalary(bucket, age),
      rating,
      potential: randomPotential(age),
      marketValue: randomMarketValue(bucket, age, rating),
      careerGoals: 0,
      careerAssists: 0,
      injuredUntil: null,
      injuryLabel: null,
      condition: 100,
    };
  }

  function generateSquad() {
    const used = new Set();
    let num = 1;
    const players = SQUAD_PLAN.map((posKey) => {
      const p = makeRandomPlayer(posKey, used);
      p.number = num++;
      return p;
    });
    return { clubName: 'Bandeirantes', players };
  }

  function nextFreeNumber(squad) {
    const usedNumbers = new Set(squad.players.map((p) => p.number));
    let n = 1;
    while (usedNumbers.has(n)) n++;
    return n;
  }

  const BUCKET_POSITION_KEYS = { GK: [], DEF: [], MID: [], ATT: [] };
  Object.keys(POSITIONS).forEach((k) => { BUCKET_POSITION_KEYS[POSITIONS[k].bucket].push(k); });

  // distribui os candidatos entre as 4 posições (goleiro/zaga/meio/ataque),
  // em vez de sortear entre todas as 17 posições específicas — o que
  // enviesava a lista para defesa (tem mais variações de posição na zaga)
  function candidateBucketPlan(count) {
    const order = ['GK', 'DEF', 'MID', 'ATT'];
    const weights = { GK: 1, DEF: 3, MID: 3, ATT: 3 };
    const totalWeight = order.reduce((s, b) => s + weights[b], 0);
    const plan = [];
    order.forEach((b) => {
      const n = Math.max(1, Math.round((count * weights[b]) / totalWeight));
      for (let i = 0; i < n; i++) plan.push(b);
    });
    while (plan.length > count) plan.pop();
    while (plan.length < count) plan.push(order[plan.length % order.length]);
    return plan;
  }

  function generateCandidates(count) {
    const used = new Set();
    const plan = candidateBucketPlan(count);
    const list = plan.map((bucket) => {
      const posKey = pick(BUCKET_POSITION_KEYS[bucket]);
      const candidate = makeRandomPlayer(posKey, used);
      candidate.fee = transferFee(candidate);
      return candidate;
    });
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  }

  function signPlayer(squad, candidate) {
    const newPlayer = Object.assign({}, candidate, { number: nextFreeNumber(squad) });
    delete newPlayer.fee;
    squad.players.push(newPlayer);
    saveSquad(squad);
    return newPlayer;
  }

  function releasePlayer(squad, playerId) {
    const idx = squad.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return null;
    const [removed] = squad.players.splice(idx, 1);
    saveSquad(squad);
    return removed;
  }

  function renamePlayer(squad, playerId, newName) {
    const name = (newName || '').trim();
    if (!name) return { ok: false, reason: 'empty' };
    const player = squad.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, reason: 'notfound' };
    player.name = name.slice(0, 40);
    saveSquad(squad);
    return { ok: true };
  }

  function renumberPlayer(squad, playerId, newNumber) {
    const n = parseInt(newNumber, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) return { ok: false, reason: 'invalid' };
    const player = squad.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, reason: 'notfound' };
    const taken = squad.players.some((p) => p.id !== playerId && p.number === n);
    if (taken) return { ok: false, reason: 'taken' };
    player.number = n;
    saveSquad(squad);
    return { ok: true };
  }

  // aplica nome+número de vários jogadores de uma vez só, validando o conjunto
  // final inteiro (evita falso "número repetido" ao trocar números entre dois
  // jogadores, já que a checagem não é mais uma-a-uma contra o estado antigo)
  function applyPlayerEdits(squad, edits) {
    const finalNumbers = new Map();
    squad.players.forEach((p) => finalNumbers.set(p.id, p.number));

    for (const edit of edits) {
      const n = parseInt(edit.number, 10);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        return { ok: false, reason: 'invalid', playerId: edit.id };
      }
      finalNumbers.set(edit.id, n);
    }

    const seen = new Map();
    for (const [id, n] of finalNumbers) {
      if (seen.has(n)) {
        const other = squad.players.find((p) => p.id === seen.get(n));
        const mine = squad.players.find((p) => p.id === id);
        return { ok: false, reason: 'duplicate', number: n, players: [mine && mine.name, other && other.name] };
      }
      seen.set(n, id);
    }

    edits.forEach((edit) => {
      const player = squad.players.find((p) => p.id === edit.id);
      if (!player) return;
      if (edit.name != null) {
        const name = String(edit.name).trim();
        if (name) player.name = name.slice(0, 40);
      }
      player.number = finalNumbers.get(edit.id);
    });
    saveSquad(squad);
    return { ok: true };
  }

  function renameClub(squad, newName) {
    const name = (newName || '').trim();
    if (!name) return { ok: false, reason: 'empty' };
    squad.clubName = name.slice(0, 40);
    saveSquad(squad);
    return { ok: true };
  }

  function loadSquad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        let changed = false;
        parsed.players.forEach((p) => {
          if (p.salary == null) { p.salary = randomSalary(p.bucket, p.age); changed = true; }
          if (!p.id) { p.id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); changed = true; }
          if (p.rating == null) { p.rating = randomRating(p.bucket, p.age); changed = true; }
          if (p.marketValue == null) { p.marketValue = randomMarketValue(p.bucket, p.age, p.rating); changed = true; }
          if (p.careerGoals == null) { p.careerGoals = 0; changed = true; }
          if (p.careerAssists == null) { p.careerAssists = 0; changed = true; }
          if (p.potential == null) { p.potential = randomPotential(p.age); changed = true; }
          if (p.injuredUntil === undefined) { p.injuredUntil = null; changed = true; }
          if (p.injuryLabel === undefined) { p.injuryLabel = null; changed = true; }
          if (p.condition == null) { p.condition = 100; changed = true; }
        });
        if (changed) saveSquad(parsed);
        return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = generateSquad();
    saveSquad(fresh);
    return fresh;
  }

  function saveSquad(squad) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(squad)); } catch (e) { /* storage unavailable */ }
  }

  function advanceSeason(squad, trainingBonus) {
    const bonus = trainingBonus || 0;
    const changes = [];
    squad.players.forEach((p) => {
      const oldStage = careerStageFor(p.age);
      p.age += 1;
      const newStage = careerStageFor(p.age);

      const potential = p.potential || 5;
      const evolveChance = bonus > 0 ? bonus * (0.5 + potential / 20) : 0;
      if ((oldStage === 'promessa' || oldStage === 'ascensao') && Math.random() < evolveChance) {
        const bump = 1 + Math.floor(Math.random() * (1 + Math.floor(potential / 4)));
        p.rating = Math.min(99, (p.rating || 60) + bump);
        changes.push({ id: p.id, name: p.name, type: 'evolucao', rating: p.rating, bump });
      } else if (newStage === 'declinio' && Math.random() < 0.35) {
        const drop = 1 + Math.floor(Math.random() * 3);
        p.rating = Math.max(35, (p.rating || 60) - drop);
        changes.push({ id: p.id, name: p.name, type: 'declinio', rating: p.rating, drop });
      }

      if (oldStage !== newStage) {
        changes.push({ id: p.id, name: p.name, type: 'fase', from: oldStage, to: newStage });
      }
    });
    saveSquad(squad);
    return changes;
  }

  // ---------- Lesões ----------
  // untilMs é um timestamp absoluto (Date.now() + N dias do jogo em ms) —
  // squad.js não sabe nada sobre calendário/dias, só guarda o timestamp.
  function isInjured(player) {
    return !!(player && player.injuredUntil && player.injuredUntil > Date.now());
  }

  function setInjury(player, untilMs, label) {
    player.injuredUntil = untilMs;
    player.injuryLabel = label;
  }

  function clearInjury(player) {
    player.injuredUntil = null;
    player.injuryLabel = null;
  }

  // usado pelo tratamento intensivo do Médico: adianta a recuperação em ms
  function reduceInjuryBy(player, ms) {
    if (!isInjured(player)) return;
    player.injuredUntil = Math.max(Date.now(), player.injuredUntil - ms);
  }

  // ---------- Condicionamento físico ----------
  // recupera sozinho com o tempo (mais rápido com Preparação Física melhor) —
  // chamado sempre que o elenco é carregado numa tela que também tem o clube
  function applyConditionRecovery(squad, fisicaLevel) {
    const now = Date.now();
    const last = squad.conditionUpdatedAt || now;
    const dayMs = (window.WSPCalendar && window.WSPCalendar.GAME_DAY_REAL_MS) || (2 * 60 * 60 * 1000);
    const daysElapsed = (now - last) / dayMs;
    squad.conditionUpdatedAt = now;
    if (daysElapsed <= 0) return false;
    const recoveryPerDay = 8 + Math.min(10, (fisicaLevel || 0) * 0.5);
    const recovery = daysElapsed * recoveryPerDay;
    let changed = false;
    squad.players.forEach((p) => {
      if (p.condition == null) p.condition = 100;
      if (p.condition < 100) {
        p.condition = Math.min(100, p.condition + recovery);
        changed = true;
      }
    });
    return changed;
  }

  // desgaste ao final de uma partida, pra quem entrou em campo — reduzido pelo
  // nível de Preparador Físico/Massagista/Musculação (mesmo grupo da fadiga)
  function applyMatchConditionDrop(squad, playerIds, fisicaReduction) {
    const drop = 12 * (1 - Math.min(0.6, fisicaReduction || 0));
    const byId = {};
    squad.players.forEach((p) => { byId[p.id] = p; });
    playerIds.forEach((id) => {
      const p = byId[id];
      if (p) p.condition = Math.max(20, (p.condition == null ? 100 : p.condition) - drop);
    });
  }

  // ---------- Vaga específica por posição na escalação ----------
  // pedido explícito do usuário (referência: Hattrick) — em vez de "4
  // zagueiros a torta e a direita", cada vaga da linha tem um papel
  // específico (lateral/zagueiro na defesa, volante/meia no meio,
  // ponta/centroavante no ataque). Escalar um jogador fora do papel da
  // vaga custa -20% de nota efetiva na partida, exceto quando a posição
  // do próprio jogador já é um híbrido que cobre aquele papel (ex:
  // "Lateral/Zagueiro" joga em qualquer uma das duas vagas sem perda).
  const OUT_OF_POSITION_PENALTY = 0.2;

  const SLOT_COMPATIBLE = {
    zagueiro: ['zagueiro', 'beque_central', 'quarto_zagueiro', 'libero_adiantado', 'libero_retaguarda', 'lateral_zagueiro'],
    lateral: ['lateral', 'lateral_ala', 'lateral_zagueiro'],
    volante: ['volante', 'segundo_volante', 'meia_defensivo'],
    meia_ofensivo: ['meia_ofensivo', 'motorzinho', 'segundo_volante'],
    centro_avante: ['centro_avante', 'segundo_atacante'],
    segundo_atacante: ['segundo_atacante', 'centro_avante', 'atacante_pontas'],
    atacante_pontas: ['atacante_pontas', 'segundo_atacante'],
    goleiro: ['goleiro'],
  };

  // papel esperado de cada vaga dentro da linha, pra qualquer quantidade —
  // laterais nas pontas da defesa, volante(s) na frente da zaga, pontas nas
  // bordas do ataque com o centroavante no meio
  function slotPositionsFor(line, count) {
    if (!count || count <= 0) return [];
    if (line === 'gk') return ['goleiro'];
    if (line === 'def') {
      if (count === 1) return ['zagueiro'];
      const arr = new Array(count).fill('zagueiro');
      arr[0] = 'lateral';
      arr[count - 1] = 'lateral';
      return arr;
    }
    if (line === 'mid') {
      if (count === 1) return ['volante'];
      if (count === 2) return ['volante', 'volante'];
      const arr = new Array(count).fill('meia_ofensivo');
      arr[0] = 'volante';
      if (count >= 4) arr[1] = 'volante';
      return arr;
    }
    if (line === 'att') {
      if (count === 1) return ['centro_avante'];
      if (count === 2) return ['centro_avante', 'segundo_atacante'];
      const arr = new Array(count).fill('segundo_atacante');
      arr[0] = 'atacante_pontas';
      arr[count - 1] = 'atacante_pontas';
      arr[Math.floor(count / 2)] = 'centro_avante';
      return arr;
    }
    return [];
  }

  function slotPenalty(playerPositionKey, slotPositionKey) {
    if (!slotPositionKey) return 0;
    const compat = SLOT_COMPATIBLE[slotPositionKey];
    if (!compat) return 0;
    return compat.indexOf(playerPositionKey) === -1 ? OUT_OF_POSITION_PENALTY : 0;
  }

  function effectiveRatingForSlot(player, slotPositionKey) {
    const base = (player && player.rating) || 60;
    const penalty = slotPenalty(player && player.position, slotPositionKey);
    return penalty > 0 ? Math.round(base * (1 - penalty)) : base;
  }

  window.WSPSquad = {
    POSITIONS, TRAITS, FEET, NATIONALITIES, CAREER_STAGES,
    MARKET_VALUE_MIN, MARKET_VALUE_MAX, FULL_SQUAD_SIZE,
    careerStageFor, generateSquad, loadSquad, saveSquad,
    releaseCost, transferFee, generateCandidates, signPlayer, releasePlayer,
    renamePlayer, renumberPlayer, applyPlayerEdits, renameClub, advanceSeason, applyValorizacao,
    isInjured, setInjury, clearInjury, reduceInjuryBy,
    applyConditionRecovery, applyMatchConditionDrop,
    OUT_OF_POSITION_PENALTY, slotPositionsFor, slotPenalty, effectiveRatingForSlot,
  };
})();
