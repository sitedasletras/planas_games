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
    { label: 'Ouro Especial', primary: '#8a6d00', secondary: '#ffd54a', detail: '#ffffff', accent: '#8a6d00' },
    { label: 'Prata Lendária', primary: '#3a3f47', secondary: '#c9d1d9', detail: '#ffd54a', accent: '#3a3f47' },
    { label: 'Fúria Roxa', primary: '#3a0e5c', secondary: '#c084fc', detail: '#ffd54a', accent: '#3a0e5c' },
    { label: 'Fênix', primary: '#7a1a1a', secondary: '#ff8c3f', detail: '#ffd54a', accent: '#7a1a1a' },
  ];

  // Pinturas fictícias inspiradas em estilos de época que marcaram a
  // história da F1 (cores/padrões, nunca marca ou nome de patrocinador
  // real) — o jogador escolhe uma como ponto de partida e ainda pode
  // ajustar as 4 cores manualmente depois.
  const LIVERY_PRESETS = [
    { label: 'Ouro Negro', primary: '#0d0d0d', secondary: '#c9a227', detail: '#ffffff', accent: '#c9a227' },
    { label: 'Flecha de Prata', primary: '#c0c0c0', secondary: '#1a1a1a', detail: '#00d4ff', accent: '#ffffff' },
    { label: 'Verde Clássico', primary: '#0b4d2c', secondary: '#ffd54a', detail: '#ffffff', accent: '#0b4d2c' },
    { label: 'Azul e Laranja', primary: '#0a3a6e', secondary: '#ff7a1a', detail: '#ffffff', accent: '#ff7a1a' },
    { label: 'Listras de Época', primary: '#ffffff', secondary: '#0a3a8c', detail: '#c8102e', accent: '#0a3a8c' },
    { label: 'Vermelho Real', primary: '#c8102e', secondary: '#ffffff', detail: '#0d0d0d', accent: '#c8102e' },
    { label: 'Púrpura Imperial', primary: '#3a0e5c', secondary: '#c084fc', detail: '#ffd54a', accent: '#3a0e5c' },
    { label: 'Preto Absoluto', primary: '#0a0a0a', secondary: '#0a0a0a', detail: '#ffd54a', accent: '#e63946' },
    { label: 'Marinho e Ouro', primary: '#0a1f44', secondary: '#d4af37', detail: '#ffffff', accent: '#d4af37' },
    { label: 'Rosa Choque', primary: '#ff2d95', secondary: '#0d0d0d', detail: '#ffffff', accent: '#ff2d95' },
    { label: 'Verde Limão', primary: '#9acd32', secondary: '#0d0d0d', detail: '#ffffff', accent: '#9acd32' },
    { label: 'Vinho e Creme', primary: '#4a0e1a', secondary: '#f2e8d5', detail: '#c9a227', accent: '#4a0e1a' },
    { label: 'Turquesa Tropical', primary: '#0d9488', secondary: '#ff7a1a', detail: '#ffffff', accent: '#ff7a1a' },
    { label: 'Grafite Militar', primary: '#3a3d2f', secondary: '#ff7a1a', detail: '#c9c9c9', accent: '#ff7a1a' },
    { label: 'Amarelo Canário', primary: '#f5d90a', secondary: '#0d0d0d', detail: '#ffffff', accent: '#0d0d0d' },
    { label: 'Azul Elétrico', primary: '#0057ff', secondary: '#c9d1d9', detail: '#ffffff', accent: '#c9d1d9' },
  ];

  function defaultCustomization() {
    return {
      premiumUnlocked: false,
      colors: { primary: '#1c1c1c', secondary: '#ffffff', detail: '#ffd54a', accent: '#e63946' },
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

  // trava de contrato: uma vez escolhido o fornecedor nesta temporada, só
  // muda de novo quando a próxima temporada começar (mesmo padrão que os
  // patrocínios já sinalizavam na tela, mas que agora vale de verdade)
  function isSupplierLocked(lockedSeason, currentSeason) {
    return lockedSeason != null && currentSeason != null && lockedSeason >= currentSeason;
  }

  function setMotorSupplier(club, name, seasonNumber) {
    if (!MOTORES.includes(name)) return { ok: false, reason: 'invalid' };
    if (isSupplierLocked(club.motorLockedSeason, seasonNumber)) return { ok: false, reason: 'locked' };
    club.motorSupplier = name;
    club.motorLockedSeason = seasonNumber != null ? seasonNumber : club.motorLockedSeason;
    saveClub(club);
    return { ok: true };
  }

  function setChassiSupplier(club, name, seasonNumber) {
    if (!CHASSIS.includes(name)) return { ok: false, reason: 'invalid' };
    if (isSupplierLocked(club.chassiLockedSeason, seasonNumber)) return { ok: false, reason: 'locked' };
    club.chassiSupplier = name;
    club.chassiLockedSeason = seasonNumber != null ? seasonNumber : club.chassiLockedSeason;
    saveClub(club);
    return { ok: true };
  }

  function setCambioSupplier(club, name, seasonNumber) {
    if (!CAMBIO.includes(name)) return { ok: false, reason: 'invalid' };
    if (isSupplierLocked(club.cambioLockedSeason, seasonNumber)) return { ok: false, reason: 'locked' };
    club.cambioSupplier = name;
    club.cambioLockedSeason = seasonNumber != null ? seasonNumber : club.cambioLockedSeason;
    saveClub(club);
    return { ok: true };
  }

  function pickTireSupplierKey() {
    const keys = window.WSPF1Corrida ? Object.keys(window.WSPF1Corrida.TIRE_SUPPLIERS) : [];
    return keys.length ? keys[Math.floor(Math.random() * keys.length)] : null;
  }

  function setTireSupplier(club, key, seasonNumber) {
    const valid = window.WSPF1Corrida && Object.prototype.hasOwnProperty.call(window.WSPF1Corrida.TIRE_SUPPLIERS, key);
    if (!valid) return { ok: false, reason: 'invalid' };
    if (isSupplierLocked(club.tireLockedSeason, seasonNumber)) return { ok: false, reason: 'locked' };
    club.tireSupplier = key;
    club.tireLockedSeason = seasonNumber != null ? seasonNumber : club.tireLockedSeason;
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

  // cada construtor de chassi rende um pouquinho diferente de ritmo — antes
  // disso a escolha do chassi era só estética, sem efeito nenhum no jogo.
  // banda global 86%-98% (regra do usuário pra qualquer porcentagem de
  // fornecedor): a ordem entre as marcas é a mesma de antes, só a escala
  // foi comprimida pra caber no teto/piso instituído
  const CHASSIS_PACE_PROFILES = {
    'Chassi Flor de Lótus': 0.98,
    'Chassi Lobo': 0.86,
    'Chassi Flechas': 0.96,
    'Chassi Março': 0.88,
    'Chassi Ônix': 0.94,
    'Chassi Águia': 0.90,
    'Chassi Insígnia': 0.92,
    'Chassi Pacífico': 0.92,
  };

  function chassiPaceFactor(name) {
    return CHASSIS_PACE_PROFILES[name] != null ? CHASSIS_PACE_PROFILES[name] : 1;
  }

  // CORREÇÃO (pedido explícito do usuário — "não pode ser o fator
  // decisivo"): CHASSIS_PACE_PROFILES guarda a porcentagem EXIBIDA (banda
  // 86%-98%, regra global de fornecedores), mas usar esse número cru como
  // multiplicador de ritmo na física dava até 14% de diferença sozinho —
  // maior que motor+chassi+pneu juntos deveriam pesar. Esta função
  // comprime a mesma banda 86-98% num multiplicador bem mais estreito
  // (~0.97 a ~1.03, igual ao rendimento de motor), então a MARCA continua
  // valendo a escolha sem decidir a corrida sozinha.
  function chassiPaceEffectFactor(name) {
    const pct = Math.round(chassiPaceFactor(name) * 100);
    const clamped = Math.max(86, Math.min(98, pct));
    return 0.97 + ((clamped - 86) / (98 - 86)) * 0.06;
  }

  // Fornecedor de câmbio: marca escolhida pelo jogador (contrato de 1
  // temporada, igual motor/chassi/pneu). "Câmbio" já existia como TIPO de
  // pane mecânica ligada ao departamento de chassi — em vez de repetir o
  // mesmo multiplicador de ritmo que chassi já usa, a marca de câmbio
  // afeta CONFIABILIDADE (chance de pane), uma variável genuinamente
  // nova. Perfil (86%-98%, mesma banda global) mora em corrida.js junto
  // com cambioReliabilityMult, que é quem realmente usa esse número.
  const CAMBIO = [
    'Câmbios Constelação',
    'Transmissões Faísca',
    'Câmbios Rocha',
    'Transmissões Meridiano',
    'Câmbios Ventania',
    'Transmissões Cadência',
    'Câmbios Bússola',
    'Transmissões Alforje',
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
    club.cambioSupplier = pick(CAMBIO);
    // null = nunca travado (ainda não escolheu nada de propósito nesta
    // temporada) — vira o número da temporada assim que o jogador troca de
    // fornecedor, e só destrava de novo quando a temporada seguinte começar
    club.motorLockedSeason = null;
    club.chassiLockedSeason = null;
    club.tireLockedSeason = null;
    club.cambioLockedSeason = null;
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
        if (!parsed.colors.accent) parsed.colors.accent = defaults.colors.accent;
        if (!parsed.crest) parsed.crest = defaults.crest;
        if (parsed.crest.color === undefined) parsed.crest.color = defaults.crest.color;
        if (parsed.torcidaName === undefined) parsed.torcidaName = defaults.torcidaName;
        if (!parsed.motorSupplier) parsed.motorSupplier = pick(MOTORES);
        if (!parsed.chassiSupplier) parsed.chassiSupplier = pick(CHASSIS);
        if (!parsed.tireSupplier) parsed.tireSupplier = pickTireSupplierKey();
        if (!parsed.cambioSupplier) parsed.cambioSupplier = pick(CAMBIO);
        if (parsed.motorLockedSeason === undefined) parsed.motorLockedSeason = null;
        if (parsed.chassiLockedSeason === undefined) parsed.chassiLockedSeason = null;
        if (parsed.tireLockedSeason === undefined) parsed.tireLockedSeason = null;
        if (parsed.cambioLockedSeason === undefined) parsed.cambioLockedSeason = null;
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
    PREMIUM_COST, CREST_SHAPES, CREST_EMBLEMS, EXCLUSIVE_CREST_EMBLEMS, EXCLUSIVE_JERSEY_PRESETS, LIVERY_PRESETS, FACILITY_GROUPS, TORCIDA_NAME_MAX,
    CAMPUS_TIER_CAPS, crestColor, MOTORES, CHASSIS, CHASSIS_PACE_PROFILES, chassiPaceFactor, chassiPaceEffectFactor, CAMBIO,
    upgradeCost, effectiveUpgradeCost, groupForDept, loadClub, saveClub, upgradeDepartment, defaultClub,
    acceptSponsor, rerollSponsor, dismissDepartment, payMatchExpenses, payEndOfSeason,
    unlockPremium, saveCustomization,
    facilityGroupLevel, facilityTierLabel, tierNameForLevel, setTorcidaName, payMatchRevenue,
    setMotorSupplier, setChassiSupplier, setTireSupplier, setCambioSupplier, isSupplierLocked,
    maxDepartmentLevelForGroup, bumpValorizacao, adjustMorale, moraleLabel,
  };
})();
