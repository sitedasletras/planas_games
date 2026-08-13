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
    ...rep('goleiro', 3),
    ...rep('zagueiro', 3), ...rep('lateral', 2), ...rep('lateral_ala', 1), ...rep('libero_adiantado', 1), ...rep('quarto_zagueiro', 1),
    ...rep('volante', 2), ...rep('meia_ofensivo', 2), ...rep('meia_defensivo', 1), ...rep('segundo_volante', 1), ...rep('motorzinho', 1),
    ...rep('centro_avante', 2), ...rep('atacante_pontas', 2), ...rep('segundo_atacante', 1),
  ];
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
  const BUCKET_BASE_SALARY = { GK: 300, DEF: 280, MID: 320, ATT: 380 };

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
    return player.marketValue || MARKET_VALUE_MIN;
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
      marketValue: randomMarketValue(bucket, age, rating),
      careerGoals: 0,
      careerAssists: 0,
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

  function generateCandidates(count) {
    const used = new Set();
    const keys = Object.keys(POSITIONS);
    const list = [];
    for (let i = 0; i < count; i++) {
      const posKey = pick(keys);
      const candidate = makeRandomPlayer(posKey, used);
      candidate.fee = transferFee(candidate);
      list.push(candidate);
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

      if ((oldStage === 'promessa' || oldStage === 'ascensao') && bonus > 0 && Math.random() < bonus) {
        const bump = 1 + Math.floor(Math.random() * 3);
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

  window.WSPSquad = {
    POSITIONS, TRAITS, FEET, NATIONALITIES, CAREER_STAGES,
    MARKET_VALUE_MIN, MARKET_VALUE_MAX,
    careerStageFor, generateSquad, loadSquad, saveSquad,
    releaseCost, transferFee, generateCandidates, signPlayer, releasePlayer,
    renamePlayer, renumberPlayer, renameClub, advanceSeason, applyValorizacao,
  };
})();
