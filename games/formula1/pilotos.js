(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_f1_pilotos_v1';

  const ROLES = {
    titular_1: { label: '1º Piloto' },
    titular_2: { label: '2º Piloto' },
    reserva: { label: 'Piloto Reserva' },
  };

  const TRAITS = {
    largador: { label: 'Ótimo na Largada' },
    chuva: { label: 'Especialista em Chuva' },
    consistente: { label: 'Muito Consistente' },
    agressivo: { label: 'Agressivo nas Ultrapassagens' },
    gestor_pneu: { label: 'Cuida bem dos Pneus' },
    qualy: { label: 'Forte no Classificatório' },
  };

  const NATIONALITIES = [
    { key: 'BR', label: 'Brasil', flag: '🇧🇷', weight: 28 },
    { key: 'GB', label: 'Reino Unido', flag: '🇬🇧', weight: 14 },
    { key: 'DE', label: 'Alemanha', flag: '🇩🇪', weight: 8 },
    { key: 'IT', label: 'Itália', flag: '🇮🇹', weight: 7 },
    { key: 'NL', label: 'Holanda', flag: '🇳🇱', weight: 6 },
    { key: 'ES', label: 'Espanha', flag: '🇪🇸', weight: 6 },
    { key: 'FR', label: 'França', flag: '🇫🇷', weight: 6 },
    { key: 'MC', label: 'Mônaco', flag: '🇲🇨', weight: 3 },
    { key: 'AU', label: 'Austrália', flag: '🇦🇺', weight: 5 },
    { key: 'MX', label: 'México', flag: '🇲🇽', weight: 5 },
    { key: 'CA', label: 'Canadá', flag: '🇨🇦', weight: 4 },
    { key: 'JP', label: 'Japão', flag: '🇯🇵', weight: 4 },
    { key: 'FI', label: 'Finlândia', flag: '🇫🇮', weight: 2 },
  ];

  const AGE_BUCKETS = [
    { range: [18, 21], weight: 12 },
    { range: [22, 25], weight: 28 },
    { range: [26, 30], weight: 32 },
    { range: [31, 34], weight: 20 },
    { range: [35, 40], weight: 8 },
  ];

  const CAREER_STAGES = {
    promessa: { label: 'Promessa' },
    ascensao: { label: 'Em Ascensão' },
    auge: { label: 'Auge' },
    experiente: { label: 'Experiente' },
    declinio: { label: 'Declínio' },
  };

  function careerStageFor(age) {
    if (age <= 21) return 'promessa';
    if (age <= 25) return 'ascensao';
    if (age <= 32) return 'auge';
    if (age <= 36) return 'experiente';
    return 'declinio';
  }

  // idade de aposentadoria automática (pedido explícito do usuário)
  const RETIREMENT_AGE = 40;

  // duração padrão de um novo contrato, em temporadas (pedido explícito do
  // usuário: "terão contratos de 2 anos")
  const CONTRACT_LENGTH_SEASONS = 2;

  // ---------- Especialidade de clima ----------
  // pedido explícito do usuário: cada piloto pode ser especialista em UM dos
  // 4 níveis de clima (corrida.js/WEATHER_TIER_KEYS), ou em nenhum — quem
  // não tem especialidade não ganha nem perde ritmo (ver
  // weatherSpecialtyPaceFactor em corrida.js). Rótulos duplicados aqui (não
  // referenciam corrida.js direto) porque pilotos.html carrega só
  // pilotos.js, sem corrida.js.
  const WEATHER_SPECIALTY_KEYS = ['seco', 'ventos_fortes', 'chuva_grossa', 'chuva_intensa'];
  const WEATHER_SPECIALTY_LABELS = {
    seco: { label: 'Clima Seco', icon: '☀️' },
    ventos_fortes: { label: 'Ventos Fortes', icon: '🌬️' },
    chuva_grossa: { label: 'Chuva Grossa', icon: '🌧️' },
    chuva_intensa: { label: 'Chuva Intensa', icon: '⛈️' },
  };
  const WEATHER_SPECIALTY_CHANCE = 0.7; // 70% dos pilotos nascem com alguma especialidade

  function randomWeatherSpecialty() {
    if (Math.random() >= WEATHER_SPECIALTY_CHANCE) return null;
    return pick(WEATHER_SPECIALTY_KEYS);
  }

  // potência da especialidade (0-20, pedido explícito do usuário) — segue a
  // mesma curva de carreira do rating (promessa fraca, auge no pico,
  // declínio caindo)
  const STAGE_POTENCIA_MULT = { promessa: 0.55, ascensao: 0.75, auge: 1.0, experiente: 0.85, declinio: 0.6 };
  function randomWeatherPotencia(age) {
    const stage = careerStageFor(age);
    const base = 20 * (STAGE_POTENCIA_MULT[stage] || 0.7);
    const variance = (Math.random() - 0.5) * 8;
    return Math.max(0, Math.min(20, Math.round(base + variance)));
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function weightedPickObj(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of list) {
      if (r < x.weight) return x;
      r -= x.weight;
    }
    return list[0];
  }

  function randomAge() {
    const bucket = weightedPickObj(AGE_BUCKETS);
    const [min, max] = bucket.range;
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  const FIRST_NAMES = [
    'Léo', 'Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Bruno', 'Diego', 'Thiago',
    'Vitor', 'Felipe', 'Igor', 'André', 'Caio', 'Danilo', 'Everton', 'Wesley',
    'Jonas', 'Kaique', 'Renan', 'Otávio', 'Fábio', 'Gustavo', 'Marcelo',
    'Alisson', 'Douglas', 'Elias', 'Fernando', 'Hugo', 'Ivan', 'Josué',
    'Max', 'Lewis', 'Charles', 'Carlos', 'Lando', 'Oscar', 'Fernando', 'Yuki',
    'Pierre', 'Esteban', 'Nico', 'Valtteri', 'Sergio', 'Lance', 'Alex',
  ];
  const LAST_NAMES = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Almeida', 'Ferreira',
    'Costa', 'Pereira', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Barbosa',
    'Cardoso', 'Ribeiro', 'Teixeira', 'Moreira', 'Correia', 'Nascimento',
    'Verstoppen', 'Hamiltone', 'Leclerque', 'Sainzo', 'Norrisen', 'Piastro',
    'Alonzo', 'Tsunodo', 'Gasly', 'Oconne', 'Rossberg', 'Bottaso', 'Perezo',
  ];

  const STAGE_RATING_MULT = { promessa: 0.8, ascensao: 0.92, auge: 1.1, experiente: 1.0, declinio: 0.85 };
  const BASE_RATING = 62;

  function randomRating(age) {
    const stage = careerStageFor(age);
    const base = BASE_RATING * STAGE_RATING_MULT[stage];
    const variance = (Math.random() - 0.5) * 18;
    return Math.round(Math.max(35, Math.min(99, base + variance)));
  }

  // Potencial: teto de crescimento do piloto (0-200, mesma escala do futebol).
  // Ligas iniciais ficam entre 2 e 10; raramente aparece uma "joia" jovem
  // com potencial até 15, bem mais cara de contratar.
  const POTENTIAL_GEM_CHANCE = 0.08;
  function randomPotential(age) {
    const stage = careerStageFor(age);
    const isYoung = stage === 'promessa' || stage === 'ascensao';
    if (isYoung && Math.random() < POTENTIAL_GEM_CHANCE) {
      return 11 + Math.floor(Math.random() * 5); // joia: 11-15
    }
    return 2 + Math.floor(Math.random() * 9); // normal: 2-10
  }

  const STAGE_SALARY_MULT = { promessa: 0.6, ascensao: 0.85, auge: 1.3, experiente: 1.0, declinio: 0.7 };
  const BASE_SALARY = 90;

  function randomSalary(age) {
    const stage = careerStageFor(age);
    const base = BASE_SALARY * STAGE_SALARY_MULT[stage];
    const variance = 0.8 + Math.random() * 0.5;
    return Math.round((base * variance) / 10) * 10;
  }

  // Valor de mercado independente do salário, sempre entre MARKET_VALUE_MIN e
  // MARKET_VALUE_MAX — uma equipe iniciante só encontra pilotos nessa faixa.
  const MARKET_VALUE_MIN = 600, MARKET_VALUE_MAX = 3600;
  const BASE_VALUE = 1200;

  function randomMarketValue(age, rating) {
    const stage = careerStageFor(age);
    const base = BASE_VALUE * STAGE_RATING_MULT[stage];
    const ratingFactor = 0.5 + ((rating || 60) / 99) * 0.9;
    const variance = 0.85 + Math.random() * 0.3;
    const raw = base * ratingFactor * variance;
    return Math.max(MARKET_VALUE_MIN, Math.min(MARKET_VALUE_MAX, Math.round(raw / 50) * 50));
  }

  function releaseCost(driver) {
    const value = driver.marketValue || MARKET_VALUE_MIN;
    return Math.max(60, Math.round(value * 0.3 / 10) * 10);
  }

  function transferFee(driver) {
    const base = driver.marketValue || MARKET_VALUE_MIN;
    const potential = driver.potential || 5;
    const premium = potential > 10 ? 1 + (potential - 10) * 0.35 : 1;
    return Math.max(MARKET_VALUE_MIN, Math.round((base * premium) / 50) * 50);
  }

  // Aplicada quando a equipe conquista um título: o elenco de pilotos
  // "recebe valorização" — reflete o prestígio da equipe campeã.
  function applyValorizacao(equipe, boostPct, ratingBoost) {
    equipe.drivers.forEach((d) => {
      const base = d.marketValue || MARKET_VALUE_MIN;
      d.marketValue = Math.round(base * (1 + boostPct) / 50) * 50;
      d.rating = Math.min(99, (d.rating || 60) + ratingBoost);
    });
    saveEquipe(equipe);
  }

  // ---------- Moral do piloto ----------
  // pedido do usuário (ideia trazida de outra ferramenta, "Migoo"): moral
  // individual 0-100 (50=neutro) que sobe/desce com o resultado da corrida
  // e afeta o ritmo em corrida (até ±10%) — mesmo campo (_moralValue) que
  // corridamotor.js já lia defensivamente antes dessa função existir.
  const MORAL_DEFAULT = 50;
  const MORAL_TIERS = [
    { min: 80, label: '🔥 Excelente' },
    { min: 60, label: '😄 Motivado' },
    { min: 40, label: '😐 Neutro' },
    { min: 20, label: '😟 Desmotivado' },
    { min: 0, label: '😰 Em Crise' },
  ];

  function moralLabel(moral) {
    const m = moral == null ? MORAL_DEFAULT : moral;
    for (const tier of MORAL_TIERS) if (m >= tier.min) return tier.label;
    return MORAL_TIERS[MORAL_TIERS.length - 1].label;
  }

  // 0 -> -10% de ritmo, 50 -> neutro, 100 -> +10%
  function moralPaceMult(moral) {
    const m = moral == null ? MORAL_DEFAULT : Math.max(0, Math.min(100, moral));
    return 1 + ((m - MORAL_DEFAULT) / MORAL_DEFAULT) * 0.10;
  }

  // ajuste pelo resultado da corrida — pts já vem calculado (RACE_POINTS/
  // SPRINT_POINTS), então funciona igual pra corrida (top 10) e sprint
  // (top 8) sem precisar saber qual tabela foi usada
  function adjustMoralForResult(driver, position, pts, totalEntrants) {
    let delta;
    if (position === 1) delta = 12;
    else if (position <= 3) delta = 7;
    else if (position <= 5) delta = 3;
    else if (pts > 0) delta = 1;
    else if (position === totalEntrants) delta = -5;
    else delta = -2;
    driver.moral = Math.max(0, Math.min(100, (driver.moral == null ? MORAL_DEFAULT : driver.moral) + delta));
    return delta;
  }

  function adjustMoralForRetirement(driver) {
    driver.moral = Math.max(0, Math.min(100, (driver.moral == null ? MORAL_DEFAULT : driver.moral) - 4));
  }

  function adjustMoralForSetupMatch(driver) {
    driver.moral = Math.max(0, Math.min(100, (driver.moral == null ? MORAL_DEFAULT : driver.moral) + 3));
  }

  // recuperação natural entre corridas — mesmo padrão de
  // applyConditionRecovery (tempo real decorrido desde a última checagem),
  // a moral tende de volta ao neutro (50) com o tempo, não fica presa no
  // extremo pra sempre
  function applyMoralRecovery(equipe) {
    const now = Date.now();
    const last = equipe.moralUpdatedAt || now;
    const dayMs = (window.WSPF1Calendario && window.WSPF1Calendario.GAME_DAY_REAL_MS) || (2 * 60 * 60 * 1000);
    const daysElapsed = (now - last) / dayMs;
    equipe.moralUpdatedAt = now;
    if (daysElapsed <= 0) return false;
    const recoveryFraction = Math.min(1, daysElapsed * 0.12);
    let changed = false;
    equipe.drivers.forEach((d) => {
      if (d.moral == null) { d.moral = MORAL_DEFAULT; changed = true; return; }
      if (d.moral !== MORAL_DEFAULT) {
        d.moral = d.moral + (MORAL_DEFAULT - d.moral) * recoveryFraction;
        changed = true;
      }
    });
    return changed;
  }

  function makeRandomDriver(role, usedNames) {
    let name;
    do {
      name = pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
    } while (usedNames.has(name));
    usedNames.add(name);

    const traitsPool = Object.keys(TRAITS);
    const traits = [];
    const roll = Math.random();
    if (roll < 0.4) traits.push(pick(traitsPool));
    if (roll < 0.12) {
      const t2 = pick(traitsPool);
      if (!traits.includes(t2)) traits.push(t2);
    }

    const age = randomAge();
    const rating = randomRating(age);
    const weatherSpecialty = randomWeatherSpecialty();

    return {
      id: 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      number: null,
      name,
      role,
      traits,
      age,
      nationality: weightedPickObj(NATIONALITIES).key,
      salary: randomSalary(age),
      rating,
      potential: randomPotential(age),
      marketValue: randomMarketValue(age, rating),
      careerPoints: 0,
      careerVitorias: 0,
      injuredUntil: null,
      injuryLabel: null,
      condition: 100,
      weatherSpecialty,
      weatherPotencia: weatherSpecialty ? randomWeatherPotencia(age) : 0,
      contractYearsLeft: CONTRACT_LENGTH_SEASONS,
      moral: MORAL_DEFAULT,
    };
  }

  function generateEquipeDrivers() {
    const used = new Set();
    const roles = ['titular_1', 'titular_2', 'reserva'];
    return roles.map((role, i) => {
      const d = makeRandomDriver(role, used);
      d.number = i + 1;
      return d;
    });
  }

  function generateSquad() {
    return { teamName: 'Bandeirantes Racing', drivers: generateEquipeDrivers() };
  }

  function nextFreeNumber(equipe) {
    const usedNumbers = new Set(equipe.drivers.map((d) => d.number));
    let n = 1;
    while (usedNumbers.has(n)) n++;
    return n;
  }

  function generateCandidates(count) {
    const used = new Set();
    const list = [];
    for (let i = 0; i < count; i++) {
      const candidate = makeRandomDriver('reserva', used);
      candidate.fee = transferFee(candidate);
      list.push(candidate);
    }
    return list;
  }

  function signPlayer(equipe, candidate) {
    const newDriver = Object.assign({}, candidate, { number: nextFreeNumber(equipe) });
    delete newDriver.fee;
    equipe.drivers.push(newDriver);
    saveEquipe(equipe);
    return newDriver;
  }

  // garante que titular_1/titular_2 nunca fiquem vagos depois de uma saída
  // (aposentadoria ou dispensa) — promove reserva(s) disponível(is), mesma
  // garantia que setDriverRole já dava pra troca manual de função
  function promoteReserveIfVacant(equipe) {
    if (!equipe.drivers.some((d) => d.role === 'titular_1')) {
      const promoted = equipe.drivers.find((d) => d.role === 'reserva');
      if (promoted) promoted.role = 'titular_1';
    }
    if (!equipe.drivers.some((d) => d.role === 'titular_2')) {
      const promoted = equipe.drivers.find((d) => d.role === 'reserva');
      if (promoted) promoted.role = 'titular_2';
    }
  }

  function releasePlayer(equipe, driverId) {
    const idx = equipe.drivers.findIndex((d) => d.id === driverId);
    if (idx < 0) return null;
    const [removed] = equipe.drivers.splice(idx, 1);
    promoteReserveIfVacant(equipe);
    saveEquipe(equipe);
    return removed;
  }

  function renamePlayer(equipe, driverId, newName) {
    const name = (newName || '').trim();
    if (!name) return { ok: false, reason: 'empty' };
    const driver = equipe.drivers.find((d) => d.id === driverId);
    if (!driver) return { ok: false, reason: 'notfound' };
    driver.name = name.slice(0, 40);
    saveEquipe(equipe);
    return { ok: true };
  }

  function renumberPlayer(equipe, driverId, newNumber) {
    const n = parseInt(newNumber, 10);
    if (!Number.isInteger(n) || n < 1 || n > 99) return { ok: false, reason: 'invalid' };
    const driver = equipe.drivers.find((d) => d.id === driverId);
    if (!driver) return { ok: false, reason: 'notfound' };
    const taken = equipe.drivers.some((d) => d.id !== driverId && d.number === n);
    if (taken) return { ok: false, reason: 'taken' };
    driver.number = n;
    saveEquipe(equipe);
    return { ok: true };
  }

  // troca de função entre pilotos — o jogador escolhe quem é 1º piloto,
  // 2º piloto e reserva. Faz um swap de verdade: quem já tinha a função
  // pedida herda a função antiga do piloto que está mudando, então nunca
  // fica com dois pilotos na mesma função nem uma função vaga
  function setDriverRole(equipe, driverId, newRole) {
    if (!ROLES[newRole]) return { ok: false, reason: 'invalid' };
    const driver = equipe.drivers.find((d) => d.id === driverId);
    if (!driver) return { ok: false, reason: 'notfound' };
    if (driver.role === newRole) return { ok: true };
    const other = equipe.drivers.find((d) => d.id !== driverId && d.role === newRole);
    if (other) other.role = driver.role;
    driver.role = newRole;
    saveEquipe(equipe);
    return { ok: true };
  }

  function renameClub(equipe, newName) {
    const name = (newName || '').trim();
    if (!name) return { ok: false, reason: 'empty' };
    equipe.teamName = name.slice(0, 40);
    saveEquipe(equipe);
    return { ok: true };
  }

  function loadSquad() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        let changed = false;
        parsed.drivers.forEach((d) => {
          if (d.salary == null) { d.salary = randomSalary(d.age); changed = true; }
          if (!d.id) { d.id = 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); changed = true; }
          if (d.rating == null) { d.rating = randomRating(d.age); changed = true; }
          if (d.marketValue == null) { d.marketValue = randomMarketValue(d.age, d.rating); changed = true; }
          if (d.careerPoints == null) { d.careerPoints = 0; changed = true; }
          if (d.careerVitorias == null) { d.careerVitorias = 0; changed = true; }
          if (d.potential == null) { d.potential = randomPotential(d.age); changed = true; }
          if (d.injuredUntil === undefined) { d.injuredUntil = null; changed = true; }
          if (d.injuryLabel === undefined) { d.injuryLabel = null; changed = true; }
          if (d.condition == null) { d.condition = 100; changed = true; }
          if (d.weatherSpecialty === undefined) { d.weatherSpecialty = randomWeatherSpecialty(); changed = true; }
          if (d.weatherPotencia == null) { d.weatherPotencia = d.weatherSpecialty ? randomWeatherPotencia(d.age) : 0; changed = true; }
          if (d.contractYearsLeft == null) { d.contractYearsLeft = CONTRACT_LENGTH_SEASONS; changed = true; }
          if (d.moral == null) { d.moral = MORAL_DEFAULT; changed = true; }
        });
        if (applyMoralRecovery(parsed)) changed = true;
        if (changed) saveEquipe(parsed);
        return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = generateSquad();
    saveEquipe(fresh);
    return fresh;
  }

  function saveEquipe(equipe) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(equipe)); } catch (e) { /* storage unavailable */ }
  }

  function advanceSeason(equipe, trainingBonus) {
    const bonus = trainingBonus || 0;
    const changes = [];
    const retiredIds = [];
    equipe.drivers.forEach((d) => {
      const oldStage = careerStageFor(d.age);
      d.age += 1;
      const newStage = careerStageFor(d.age);

      const potential = d.potential || 5;
      const evolveChance = bonus > 0 ? bonus * (0.5 + potential / 20) : 0;
      if ((oldStage === 'promessa' || oldStage === 'ascensao') && Math.random() < evolveChance) {
        const bump = 1 + Math.floor(Math.random() * (1 + Math.floor(potential / 4)));
        d.rating = Math.min(99, (d.rating || 60) + bump);
        changes.push({ id: d.id, name: d.name, type: 'evolucao', rating: d.rating, bump });
      } else if (newStage === 'declinio' && Math.random() < 0.35) {
        const drop = 1 + Math.floor(Math.random() * 3);
        d.rating = Math.max(35, (d.rating || 60) - drop);
        changes.push({ id: d.id, name: d.name, type: 'declinio', rating: d.rating, drop });
      }

      // potência da especialidade de clima segue o mesmo arco de carreira
      // do rating (auge/caída) — pedido explícito do usuário
      if (d.weatherSpecialty) {
        const wp = d.weatherPotencia || 0;
        if ((oldStage === 'promessa' || oldStage === 'ascensao') && Math.random() < evolveChance) {
          d.weatherPotencia = Math.min(20, wp + 1 + Math.floor(Math.random() * 2));
        } else if (newStage === 'declinio' && Math.random() < 0.35) {
          d.weatherPotencia = Math.max(0, wp - (1 + Math.floor(Math.random() * 2)));
        }
      }

      if (oldStage !== newStage) {
        changes.push({ id: d.id, name: d.name, type: 'fase', from: oldStage, to: newStage });
      }

      // contrato de 2 temporadas — ao vencer, fica "agente livre": o
      // jogador decide (renovar ou dispensar) na tela de temporada, o
      // contador não desce abaixo de 0 enquanto a decisão não é tomada
      const yearsLeft = (d.contractYearsLeft == null ? CONTRACT_LENGTH_SEASONS : d.contractYearsLeft) - 1;
      d.contractYearsLeft = Math.max(0, yearsLeft);
      if (d.contractYearsLeft <= 0) {
        changes.push({ id: d.id, name: d.name, type: 'contrato_vencido' });
      }

      // aposentadoria automática aos 40 (pedido explícito do usuário)
      if (d.age >= RETIREMENT_AGE) {
        retiredIds.push(d.id);
        changes.push({ id: d.id, name: d.name, type: 'aposentadoria', age: d.age });
      }
    });

    if (retiredIds.length) {
      equipe.drivers = equipe.drivers.filter((d) => !retiredIds.includes(d.id));
      promoteReserveIfVacant(equipe);
    }

    saveEquipe(equipe);
    return changes;
  }

  // pilotos com contrato vencido (contractYearsLeft <= 0) — a tela de
  // temporada usa isso pra pedir a decisão do jogador (renovar/dispensar)
  // antes de liberar a próxima temporada
  function expiredContracts(equipe) {
    return equipe.drivers.filter((d) => (d.contractYearsLeft || 0) <= 0);
  }

  function renewContract(equipe, driverId) {
    const driver = equipe.drivers.find((d) => d.id === driverId);
    if (!driver) return { ok: false, reason: 'notfound' };
    driver.contractYearsLeft = CONTRACT_LENGTH_SEASONS;
    saveEquipe(equipe);
    return { ok: true };
  }

  // ---------- Lesões / desgaste físico ----------
  function isInjured(driver) {
    return !!(driver && driver.injuredUntil && driver.injuredUntil > Date.now());
  }

  function setInjury(driver, untilMs, label) {
    driver.injuredUntil = untilMs;
    driver.injuryLabel = label;
  }

  function clearInjury(driver) {
    driver.injuredUntil = null;
    driver.injuryLabel = null;
  }

  function reduceInjuryBy(driver, ms) {
    if (!isInjured(driver)) return;
    driver.injuredUntil = Math.max(Date.now(), driver.injuredUntil - ms);
  }

  // ---------- Condicionamento físico ----------
  function applyConditionRecovery(equipe, fisicaLevel) {
    const now = Date.now();
    const last = equipe.conditionUpdatedAt || now;
    const dayMs = (window.WSPF1Calendario && window.WSPF1Calendario.GAME_DAY_REAL_MS) || (2 * 60 * 60 * 1000);
    const daysElapsed = (now - last) / dayMs;
    equipe.conditionUpdatedAt = now;
    if (daysElapsed <= 0) return false;
    const recoveryPerDay = 8 + Math.min(10, (fisicaLevel || 0) * 0.5);
    const recovery = daysElapsed * recoveryPerDay;
    let changed = false;
    equipe.drivers.forEach((d) => {
      if (d.condition == null) d.condition = 100;
      if (d.condition < 100) {
        d.condition = Math.min(100, d.condition + recovery);
        changed = true;
      }
    });
    return changed;
  }

  function applyMatchConditionDrop(equipe, driverIds, fisicaReduction) {
    const drop = 10 * (1 - Math.min(0.6, fisicaReduction || 0));
    const byId = {};
    equipe.drivers.forEach((d) => { byId[d.id] = d; });
    driverIds.forEach((id) => {
      const d = byId[id];
      if (d) d.condition = Math.max(20, (d.condition == null ? 100 : d.condition) - drop);
    });
  }

  window.WSPF1Pilotos = {
    ROLES, TRAITS, NATIONALITIES, CAREER_STAGES,
    MARKET_VALUE_MIN, MARKET_VALUE_MAX,
    WEATHER_SPECIALTY_KEYS, WEATHER_SPECIALTY_LABELS, RETIREMENT_AGE, CONTRACT_LENGTH_SEASONS,
    careerStageFor, generateSquad, loadSquad, saveSquad: saveEquipe,
    releaseCost, transferFee, generateCandidates, signPlayer, releasePlayer,
    renamePlayer, renumberPlayer, renameClub, setDriverRole, advanceSeason, applyValorizacao,
    isInjured, setInjury, clearInjury, reduceInjuryBy,
    applyConditionRecovery, applyMatchConditionDrop,
    expiredContracts, renewContract,
    MORAL_DEFAULT, moralLabel, moralPaceMult, adjustMoralForResult, adjustMoralForRetirement,
    adjustMoralForSetupMatch, applyMoralRecovery,
  };
})();
