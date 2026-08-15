(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_f1_equipe_v1';
  const STARTING_BUDGET = 20000;
  const MAX_LEVEL = 20;
  const BASE_COST = 200;
  const OTHER_EXPENSES_PER_MATCH = 300; // viagem, logística, despesas gerais de corrida
  const PREMIUM_COST = 2000;

  const CREST_SHAPES = ['circulo', 'escudo', 'diamante'];
  const CREST_EMBLEMS = ['🏎️', '🏁', '⭐', '🦁', '🦅', '⚔️', '🔱', '👑', '🔥', '⚡', '🛡️', '🐎'];
  const EXCLUSIVE_CREST_EMBLEMS = ['💎', '🏆', '👽', '🐉'];
  const EXCLUSIVE_JERSEY_PRESETS = [
    { label: 'Ouro Especial', primary: '#8a6d00', secondary: '#ffd54a', detail: '#ffffff' },
    { label: 'Prata Lendária', primary: '#3a3f47', secondary: '#c9d1d9', detail: '#ffd54a' },
    { label: 'Fúria Roxa', primary: '#3a0e5c', secondary: '#c084fc', detail: '#ffd54a' },
    { label: 'Fênix', primary: '#7a1a1a', secondary: '#ff8c3f', detail: '#ffd54a' },
  ];

  function defaultCustomization() {
    return {
      premiumUnlocked: false,
      colors: { primary: '#1c1c1c', secondary: '#ffffff', detail: '#ffd54a' },
      crest: { shape: 'escudo', emblem: '🏎️', color: null },
      torcidaName: null,
      motorSupplier: null,
      chassiSupplier: null,
      tireSupplier: null,
      valorizacaoLevel: 0,
      exclusiveEmblemUnlocked: false,
      exclusiveJerseyUnlocked: false,
      morale: 50,
      pendingDiscount: null,
    };
  }

  function adjustMorale(equipe, delta) {
    equipe.morale = Math.max(0, Math.min(100, (equipe.morale == null ? 50 : equipe.morale) + delta));
    saveClub(equipe);
    return equipe.morale;
  }

  function moraleLabel(morale) {
    if (morale >= 80) return 'Muito alta';
    if (morale >= 60) return 'Alta';
    if (morale >= 40) return 'Neutra';
    if (morale >= 20) return 'Baixa';
    return 'Muito baixa';
  }

  const DEPARTMENTS = {
    diretor_esportivo: { label: 'Diretor Esportivo', icon: '🎯', desc: 'Planeja o projeto esportivo da equipe a longo prazo' },
    chefe_equipe: { label: 'Chefe de Equipe', icon: '🧑‍💼', desc: 'Comanda a equipe nos dias de corrida' },
    engenheiro_chefe: { label: 'Engenheiro-Chefe', icon: '📐', desc: 'Coordena o desenvolvimento técnico do carro' },
    aerodinamica: { label: 'Aerodinâmica', icon: '🌬️', desc: 'Melhora o desempenho do carro nas curvas' },
    motor: { label: 'Motor', icon: '🔧', desc: 'Mais potência e confiabilidade mecânica' },
    chassi: { label: 'Chassi', icon: '🔩', desc: 'Equilíbrio e resistência do carro' },
    mecanicos: { label: 'Equipe de Boxes', icon: '🛠️', desc: 'Pit stops mais rápidos' },
    fisioterapia: { label: 'Fisioterapia', icon: '🩹', desc: 'Acelera a recuperação física dos pilotos' },
    medico: { label: 'Médico de Equipe', icon: '⚕️', desc: 'Reduz o risco de lesões graves' },
    psicologo: { label: 'Psicólogo', icon: '🧠', desc: 'Mantém os pilotos mentalmente equilibrados' },
    telemetria: { label: 'Telemetria', icon: '📡', desc: 'Estratégia de corrida mais precisa' },
    assessor_imprensa: { label: 'Assessor de Imprensa', icon: '🎙️', desc: 'Cuida da imagem da equipe na mídia' },
    torcida: { label: 'Fã-Clube', icon: '📣', desc: 'Mobiliza os fãs e aumenta a renda de bilheteria' },
  };

  const FACILITY_GROUPS = {
    medico: {
      label: 'Departamento Médico',
      icon: '⚕️',
      depts: ['medico', 'fisioterapia', 'psicologo'],
      tiers: ['Sem estrutura médica', 'Ambulatório', 'Enfermaria', 'Centro Médico', 'Clínica Especializada', 'Hospital Completo'],
    },
    tecnica: {
      label: 'Comissão Técnica',
      icon: '📋',
      depts: ['diretor_esportivo', 'chefe_equipe', 'engenheiro_chefe'],
      tiers: ['Sem comissão formada', 'Comissão Improvisada', 'Sala Técnica', 'Centro Técnico Básico', 'Centro de Comissão Técnica', 'Comissão de Elite'],
    },
    engenharia: {
      label: 'Engenharia',
      icon: '🌬️',
      depts: ['aerodinamica', 'motor', 'chassi'],
      tiers: ['Sem estrutura', 'Oficina Simples', 'Túnel de Vento Básico', 'Centro de Performance', 'Laboratório de Alto Rendimento', 'Fábrica de Ponta'],
    },
    boxes: {
      label: 'Boxes',
      icon: '🛠️',
      depts: ['mecanicos', 'telemetria'],
      tiers: ['Sem equipe de boxes', 'Equipe Improvisada', 'Boxes Básicos', 'Boxes Profissionais', 'Boxes de Elite', 'Boxes Nível Mundial'],
    },
    imprensa: {
      label: 'Imprensa',
      icon: '🎙️',
      depts: ['assessor_imprensa'],
      tiers: ['Sem assessoria', 'Assessoria Informal', 'Central de Imprensa', 'Departamento de Comunicação', 'Central de Mídia Profissional', 'Agência de Comunicação Global'],
    },
    torcida: {
      label: 'Torcida',
      icon: '📣',
      depts: ['torcida'],
      tiers: ['Sem organização', 'Fãs do Bairro', 'Fã-Clube Local', 'Fã-Clube Organizado', 'Fã-Clube Regional', 'Fã-Clube Nacional'],
      nameable: true,
      nameableFromLevel: 9,
    },
  };

  function facilityGroupLevel(club, groupKey) {
    const group = FACILITY_GROUPS[groupKey];
    if (!group) return 0;
    const sum = group.depts.reduce((s, k) => s + (club.departments[k] || 0), 0);
    return Math.floor(sum / group.depts.length);
  }

  function tierNameForLevel(group, level) {
    if (level <= 0) return group.tiers[0];
    const namedTiers = group.tiers.length - 1;
    const bandSize = Math.ceil(MAX_LEVEL / namedTiers);
    const milestoneIdx = Math.min(namedTiers, Math.ceil(level / bandSize));
    return group.tiers[milestoneIdx];
  }

  function facilityTierLabel(club, groupKey) {
    const group = FACILITY_GROUPS[groupKey];
    if (!group) return '';
    const level = facilityGroupLevel(club, groupKey);
    if (level <= 0) return group.tiers[0];
    return tierNameForLevel(group, level) + ' — Nível ' + level;
  }

  const TORCIDA_NAME_MAX = 28;

  function setTorcidaName(club, name) {
    const trimmed = (name || '').trim().slice(0, TORCIDA_NAME_MAX);
    if (!trimmed) return { ok: false, reason: 'empty' };
    club.torcidaName = trimmed;
    saveClub(club);
    return { ok: true };
  }

  function setMotorSupplier(club, name) {
    if (!MOTORES.includes(name)) return { ok: false, reason: 'invalid' };
    club.motorSupplier = name;
    saveClub(club);
    return { ok: true };
  }

  function setChassiSupplier(club, name) {
    if (!CHASSIS.includes(name)) return { ok: false, reason: 'invalid' };
    club.chassiSupplier = name;
    saveClub(club);
    return { ok: true };
  }

  function pickTireSupplierKey() {
    const keys = window.WSPF1Corrida ? Object.keys(window.WSPF1Corrida.TIRE_SUPPLIERS) : [];
    return keys.length ? keys[Math.floor(Math.random() * keys.length)] : null;
  }

  function setTireSupplier(club, key) {
    const valid = window.WSPF1Corrida && Object.prototype.hasOwnProperty.call(window.WSPF1Corrida.TIRE_SUPPLIERS, key);
    if (!valid) return { ok: false, reason: 'invalid' };
    club.tireSupplier = key;
    saveClub(club);
    return { ok: true };
  }

  const BASE_MATCH_REVENUE = 600;
  const REVENUE_PER_TORCIDA_LEVEL = 300;

  function payMatchRevenue(club) {
    const torcidaLevel = (club.departments && club.departments.torcida) || 0;
    const revenue = BASE_MATCH_REVENUE + torcidaLevel * REVENUE_PER_TORCIDA_LEVEL;
    club.budget += revenue;
    saveClub(club);
    return { revenue, torcidaLevel };
  }

  const SPONSOR_SLOTS = {
    carroceria_principal: { label: 'Carroceria (Principal)', icon: '🏎️', min: 600, max: 1600 },
    capacete: { label: 'Capacete do Piloto', icon: '⛑️', min: 160, max: 500 },
    combustivel: { label: 'Fornecedor de Combustível', icon: '⛽', min: 100, max: 300 },
    equipamentos: { label: 'Material e Equipamentos', icon: '🧰', min: 400, max: 1200 },
  };

  const SPONSOR_NAMES = {
    carroceria_principal: ['TechBank', 'Cerveja Serra Alta', 'Voa Linhas Aéreas', 'Construtora Horizonte', 'SegurPrev Seguros', 'Grupo Atlas', 'Planas Games', 'Instituto Celeiro Literário'],
    capacete: ['Auto Peças Rael', 'Mercado Bom Preço', 'Farmácia Vitalis', 'Posto Estrada Nova', 'Imobiliária Cedro'],
    combustivel: ['HidraSport Combustíveis', 'PotencIon Lubrificantes', 'AguaViva Racing', 'RecarregaMax', 'Ion Total', 'Petróleo do Brás'],
    equipamentos: ['Tope', 'Ardidas', 'Pênallti', 'Fitas', 'Kappas', 'Tumdro', 'Lêcoque', 'Strike', 'Nova Ballada'],
  };

  // Fornecedores de motor e construtores de chassi do grid — inspirados em marcas
  // reais que já não competem mais na F1, com nomes traduzidos/reinterpretados em
  // português (ex.: Lotus -> Flor de Lótus) em vez do nome de marca original.
  const MOTORES = [
    'Motores Auge de Coventry',
    'Motores de Corrida Britânicos',
    'Motores Modernos',
    'Motores Vida',
    'Peças de Reposição Racing',
    'Motores Cervo',
    'Motores Sombra',
    'Motores Pégaso',
  ];

  const CHASSIS = [
    'Chassi Flor de Lótus',
    'Chassi Lobo',
    'Chassi Flechas',
    'Chassi Março',
    'Chassi Ônix',
    'Chassi Águia',
    'Chassi Insígnia',
    'Chassi Pacífico',
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomProposal(slotKey, valorizacaoLevel) {
    const slot = SPONSOR_SLOTS[slotKey];
    const mult = 1 + (valorizacaoLevel || 0) * 0.25;
    const min = slot.min * mult, max = slot.max * mult;
    const value = Math.round((min + Math.random() * (max - min)) / 100) * 100;
    return { name: pick(SPONSOR_NAMES[slotKey]), value };
  }

  function upgradeCost(currentLevel) {
    return Math.round(BASE_COST * Math.pow(currentLevel + 1, 1.15));
  }

  const CAMPUS_TIER_CAPS = { bairro: 4, cidade: 8, regional: 16, estadual: 20 };

  function maxDepartmentLevelForGroup(tierGroupKey) {
    const cap = CAMPUS_TIER_CAPS[tierGroupKey];
    return Math.min(MAX_LEVEL, cap == null ? MAX_LEVEL : cap);
  }

  function defaultClub() {
    const departments = {};
    Object.keys(DEPARTMENTS).forEach((k) => { departments[k] = 0; });
    const sponsors = {};
    Object.keys(SPONSOR_SLOTS).forEach((k) => { sponsors[k] = { current: null, proposal: randomProposal(k) }; });
    const club = Object.assign({ budget: STARTING_BUDGET, departments, sponsors }, defaultCustomization());
    club.motorSupplier = pick(MOTORES);
    club.chassiSupplier = pick(CHASSIS);
    club.tireSupplier = pickTireSupplierKey();
    return club;
  }

  function loadClub() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        Object.keys(DEPARTMENTS).forEach((k) => {
          if (!(k in parsed.departments)) parsed.departments[k] = 0;
        });
        if (!parsed.sponsors) parsed.sponsors = {};
        Object.keys(SPONSOR_SLOTS).forEach((k) => {
          if (!parsed.sponsors[k]) parsed.sponsors[k] = { current: null, proposal: randomProposal(k) };
        });
        const defaults = defaultCustomization();
        if (parsed.premiumUnlocked == null) parsed.premiumUnlocked = defaults.premiumUnlocked;
        if (!parsed.colors) parsed.colors = defaults.colors;
        if (!parsed.crest) parsed.crest = defaults.crest;
        if (parsed.crest.color === undefined) parsed.crest.color = defaults.crest.color;
        if (parsed.torcidaName === undefined) parsed.torcidaName = defaults.torcidaName;
        if (!parsed.motorSupplier) parsed.motorSupplier = pick(MOTORES);
        if (!parsed.chassiSupplier) parsed.chassiSupplier = pick(CHASSIS);
        if (!parsed.tireSupplier) parsed.tireSupplier = pickTireSupplierKey();
        if (parsed.valorizacaoLevel == null) parsed.valorizacaoLevel = defaults.valorizacaoLevel;
        if (parsed.exclusiveEmblemUnlocked == null) parsed.exclusiveEmblemUnlocked = defaults.exclusiveEmblemUnlocked;
        if (parsed.exclusiveJerseyUnlocked == null) parsed.exclusiveJerseyUnlocked = defaults.exclusiveJerseyUnlocked;
        if (parsed.morale == null) parsed.morale = defaults.morale;
        if (parsed.pendingDiscount === undefined) parsed.pendingDiscount = defaults.pendingDiscount;
        return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    const fresh = defaultClub();
    saveClub(fresh);
    return fresh;
  }

  function saveClub(club) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(club)); } catch (e) { /* storage unavailable */ }
  }

  function groupForDept(key) {
    for (const g of Object.keys(FACILITY_GROUPS)) {
      if (FACILITY_GROUPS[g].depts.includes(key)) return g;
    }
    return null;
  }

  function effectiveUpgradeCost(club, key) {
    const level = club.departments[key] || 0;
    let cost = upgradeCost(level);
    if (club.pendingDiscount && club.pendingDiscount.group === groupForDept(key)) {
      cost = Math.max(1, Math.round(cost * (1 - club.pendingDiscount.pct)));
    }
    return cost;
  }

  function upgradeDepartment(club, key, levelCap) {
    const level = club.departments[key] || 0;
    const cap = levelCap == null ? MAX_LEVEL : Math.min(MAX_LEVEL, levelCap);
    if (level >= MAX_LEVEL) return { ok: false, reason: 'max' };
    if (level >= cap) return { ok: false, reason: 'tier_locked' };
    const cost = effectiveUpgradeCost(club, key);
    if (club.budget < cost) return { ok: false, reason: 'money', cost };
    club.budget -= cost;
    club.departments[key] = level + 1;
    if (club.pendingDiscount && club.pendingDiscount.group === groupForDept(key)) {
      club.pendingDiscount = null;
    }
    saveClub(club);
    return { ok: true, cost };
  }

  function acceptSponsor(club, slotKey) {
    const slot = club.sponsors[slotKey];
    club.budget += slot.proposal.value;
    slot.current = slot.proposal;
    slot.proposal = randomProposal(slotKey, club.valorizacaoLevel);
    saveClub(club);
    return { ok: true, value: slot.current.value };
  }

  function rerollSponsor(club, slotKey) {
    club.sponsors[slotKey].proposal = randomProposal(slotKey, club.valorizacaoLevel);
    saveClub(club);
  }

  function bumpValorizacao(club) {
    club.valorizacaoLevel = (club.valorizacaoLevel || 0) + 1;
    Object.keys(club.sponsors).forEach((k) => {
      if (!club.sponsors[k].current) {
        club.sponsors[k].proposal = randomProposal(k, club.valorizacaoLevel);
      }
    });
    saveClub(club);
    return { level: club.valorizacaoLevel };
  }

  function dismissDepartment(club, key) {
    const level = club.departments[key] || 0;
    if (level <= 0) return { ok: false, reason: 'none' };
    const cost = Math.round(upgradeCost(level - 1) * 0.6);
    if (club.budget < cost) return { ok: false, reason: 'money', cost };
    club.budget -= cost;
    club.departments[key] = 0;
    saveClub(club);
    return { ok: true, cost };
  }

  function payMatchExpenses(club, equipe) {
    const payroll = equipe ? equipe.drivers.reduce((s, d) => s + (d.salary || 0), 0) : 0;
    const total = payroll + OTHER_EXPENSES_PER_MATCH;
    club.budget -= total;
    saveClub(club);
    return { payroll, other: OTHER_EXPENSES_PER_MATCH, total };
  }

  function payEndOfSeason(club, equipe) {
    const payroll = equipe ? equipe.drivers.reduce((s, d) => s + (d.salary || 0), 0) : 0;
    const ferias = payroll;
    const decimoTerceiro = payroll;
    const total = ferias + decimoTerceiro;
    club.budget -= total;
    saveClub(club);
    return { ferias, decimoTerceiro, total };
  }

  function unlockPremium(club) {
    if (club.premiumUnlocked) return { ok: false, reason: 'already' };
    if (club.budget < PREMIUM_COST) return { ok: false, reason: 'money', cost: PREMIUM_COST };
    club.budget -= PREMIUM_COST;
    club.premiumUnlocked = true;
    saveClub(club);
    return { ok: true, cost: PREMIUM_COST };
  }

  function saveCustomization(club, { colors, crest }) {
    if (colors) club.colors = Object.assign({}, club.colors, colors);
    if (crest) club.crest = Object.assign({}, club.crest, crest);
    saveClub(club);
  }

  function crestColor(club) {
    return (club.crest && club.crest.color) || club.colors.primary;
  }

  window.WSPF1Equipe = {
    DEPARTMENTS, MAX_LEVEL, STARTING_BUDGET, SPONSOR_SLOTS, OTHER_EXPENSES_PER_MATCH,
    PREMIUM_COST, CREST_SHAPES, CREST_EMBLEMS, EXCLUSIVE_CREST_EMBLEMS, EXCLUSIVE_JERSEY_PRESETS, FACILITY_GROUPS, TORCIDA_NAME_MAX,
    CAMPUS_TIER_CAPS, crestColor, MOTORES, CHASSIS,
    upgradeCost, effectiveUpgradeCost, groupForDept, loadClub, saveClub, upgradeDepartment, defaultClub,
    acceptSponsor, rerollSponsor, dismissDepartment, payMatchExpenses, payEndOfSeason,
    unlockPremium, saveCustomization,
    facilityGroupLevel, facilityTierLabel, tierNameForLevel, setTorcidaName, payMatchRevenue,
    setMotorSupplier, setChassiSupplier, setTireSupplier,
    maxDepartmentLevelForGroup, bumpValorizacao, adjustMorale, moraleLabel,
  };
})();
