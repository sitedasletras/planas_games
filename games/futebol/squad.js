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

  function generateSquad() {
    const used = new Set();
    let batedorPertoCount = 0, batedorLongeCount = 0;
    let num = 1;

    const players = SQUAD_PLAN.map((posKey) => {
      let name;
      do {
        name = pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
      } while (used.has(name));
      used.add(name);

      const bucket = POSITIONS[posKey].bucket;
      const foot = weightedPick(FEET);
      const traits = [];

      if (bucket === 'GK') {
        traits.push(pick(['gk_acrobata', 'gk_simples', 'gk_organiza']));
      } else {
        const roll = Math.random();
        const pool = ['tabelar', 'chuveirinho', 'sai_tocando'];
        if (batedorPertoCount < 2) pool.push('batedor_perto');
        if (batedorLongeCount < 2) pool.push('batedor_longe');
        if (roll < 0.35) {
          const t = pick(pool);
          traits.push(t);
          if (t === 'batedor_perto') batedorPertoCount++;
          if (t === 'batedor_longe') batedorLongeCount++;
        }
        if (roll < 0.1) {
          let t2 = pick(pool);
          if (!traits.includes(t2)) {
            traits.push(t2);
            if (t2 === 'batedor_perto') batedorPertoCount++;
            if (t2 === 'batedor_longe') batedorLongeCount++;
          }
        }
      }

      const age = randomAge();

      return {
        id: 'p' + num + '_' + Date.now().toString(36),
        number: num++,
        name,
        position: posKey,
        bucket,
        foot,
        traits,
        age,
        height: randomHeight(bucket),
        nationality: weightedPickObj(NATIONALITIES).key,
        avatar: generateAvatar(age),
      };
    });

    return { clubName: 'Bandeirantes', players };
  }

  function loadSquad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = generateSquad();
    saveSquad(fresh);
    return fresh;
  }

  function saveSquad(squad) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(squad)); } catch (e) { /* storage unavailable */ }
  }

  window.WSPSquad = {
    POSITIONS, TRAITS, FEET, NATIONALITIES, CAREER_STAGES,
    careerStageFor, generateSquad, loadSquad, saveSquad,
  };
})();
