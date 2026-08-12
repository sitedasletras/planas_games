(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_club_v1';
  const STARTING_BUDGET = 100000;
  const MAX_LEVEL = 5;
  const BASE_COST = 1000;
  const OTHER_EXPENSES_PER_MATCH = 1500; // direitos de imagem + viagem + despesas gerais, somados
  const PREMIUM_COST = 10000;

  const CREST_SHAPES = ['circulo', 'escudo', 'diamante'];
  const CREST_EMBLEMS = ['⚽', '⭐', '🦁', '🦅', '🐺', '⚔️', '🔱', '👑', '🐎', '🔥', '⚡', '🛡️'];

  function defaultCustomization() {
    return {
      premiumUnlocked: false,
      colors: { primary: '#1c1c1c', secondary: '#ffffff', detail: '#ffd54a' },
      crest: { shape: 'escudo', emblem: '⚽' },
      torcidaName: null,
      valorizacaoLevel: 0,
    };
  }

  const DEPARTMENTS = {
    diretor_tecnico: { label: 'Diretor Técnico', icon: '🎯', desc: 'Planeja o futebol do clube a longo prazo' },
    treinador: { label: 'Treinador', icon: '🧑‍💼', desc: 'Comanda a equipe tecnicamente' },
    auxiliar_tecnico: { label: 'Auxiliar Técnico', icon: '📋', desc: 'Apoia o treinador na comissão técnica' },
    preparador_fisico: { label: 'Preparador Físico', icon: '🏃', desc: 'Reduz o desgaste físico do time' },
    fisioterapia: { label: 'Fisioterapia', icon: '🩹', desc: 'Acelera a recuperação de lesões' },
    massagista: { label: 'Massagista', icon: '💆', desc: 'Alivia a fadiga muscular' },
    medico: { label: 'Médico', icon: '⚕️', desc: 'Reduz o risco de lesões graves' },
    ortopedista: { label: 'Ortopedista', icon: '🦴', desc: 'Cuida de lesões ósseas e articulares' },
    psicologo: { label: 'Psicólogo', icon: '🧠', desc: 'Mantém o elenco mentalmente equilibrado' },
    musculacao: { label: 'Musculação', icon: '🏋️', desc: 'Estrutura de treino de força' },
    hidromassagem: { label: 'Hidromassagem', icon: '🛁', desc: 'Recuperação pós-jogo' },
    assessor_imprensa: { label: 'Assessor de Imprensa', icon: '🎙️', desc: 'Cuida da imagem do clube na mídia' },
    torcida: { label: 'Torcida Organizada', icon: '📣', desc: 'Mobiliza a torcida e aumenta a renda de bilheteria' },
  };

  // Cada instalação do Campus agrupa um ou mais profissionais/departamentos.
  // O nível da instalação é a média (arredondada para baixo) dos níveis dos seus departamentos,
  // e evolui por "tiers" nomeados — a estrutura física acompanha a evolução dos profissionais.
  const FACILITY_GROUPS = {
    medico: {
      label: 'Departamento Médico',
      icon: '⚕️',
      depts: ['medico', 'fisioterapia', 'massagista', 'ortopedista', 'psicologo'],
      tiers: ['Sem estrutura médica', 'Ambulatório', 'Enfermaria', 'Centro Médico', 'Clínica Especializada', 'Hospital Completo'],
    },
    tecnica: {
      label: 'Comissão Técnica',
      icon: '📋',
      depts: ['diretor_tecnico', 'treinador', 'auxiliar_tecnico'],
      tiers: ['Sem comissão formada', 'Comissão Improvisada', 'Sala Técnica', 'CT Básico', 'Centro de Comissão Técnica', 'Comissão de Elite'],
    },
    fisica: {
      label: 'Preparação Física',
      icon: '🏋️',
      depts: ['preparador_fisico', 'musculacao', 'hidromassagem'],
      tiers: ['Sem estrutura física', 'Quadra do Bairro', 'Academia Simples', 'Centro de Performance', 'Laboratório de Alto Rendimento', 'Complexo Olímpico'],
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
      tiers: ['Sem organização', 'Buteco do Bairro', 'Torcida do Bairro', 'Torcida Organizada', 'Torcida Organizada Regional', 'Torcida Organizada Nacional'],
      nameable: true,
      nameableFromLevel: 3,
    },
  };

  function facilityGroupLevel(club, groupKey) {
    const group = FACILITY_GROUPS[groupKey];
    if (!group) return 0;
    const sum = group.depts.reduce((s, k) => s + (club.departments[k] || 0), 0);
    return Math.floor(sum / group.depts.length);
  }

  function facilityTierLabel(club, groupKey) {
    const group = FACILITY_GROUPS[groupKey];
    if (!group) return '';
    return group.tiers[facilityGroupLevel(club, groupKey)];
  }

  const TORCIDA_NAME_MAX = 28;

  function setTorcidaName(club, name) {
    const trimmed = (name || '').trim().slice(0, TORCIDA_NAME_MAX);
    if (!trimmed) return { ok: false, reason: 'empty' };
    club.torcidaName = trimmed;
    saveClub(club);
    return { ok: true };
  }

  const BASE_MATCH_REVENUE = 3000;
  const REVENUE_PER_TORCIDA_LEVEL = 1500;

  function payMatchRevenue(club) {
    const torcidaLevel = (club.departments && club.departments.torcida) || 0;
    const revenue = BASE_MATCH_REVENUE + torcidaLevel * REVENUE_PER_TORCIDA_LEVEL;
    club.budget += revenue;
    saveClub(club);
    return { revenue, torcidaLevel };
  }

  const SPONSOR_SLOTS = {
    camisa_frente: { label: 'Camisa (Frente)', icon: '👕', min: 3000, max: 8000 },
    lateral_campo: { label: 'Lateral de Campo', icon: '🚩', min: 800, max: 2500 },
    isotonicos: { label: 'Fornecedor de Isotônicos', icon: '🥤', min: 500, max: 1500 },
    material_esportivo: { label: 'Material Esportivo', icon: '👟', min: 2000, max: 6000 },
  };

  const SPONSOR_NAMES = {
    camisa_frente: ['TechBank', 'Cerveja Serra Alta', 'Voa Linhas Aéreas', 'Construtora Horizonte', 'SegurPrev Seguros', 'Grupo Atlas'],
    lateral_campo: ['Auto Peças Rael', 'Mercado Bom Preço', 'Farmácia Vitalis', 'Posto Estrada Nova', 'Imobiliária Cedro'],
    isotonicos: ['HidraSport', 'PotencIon', 'AguaViva Esportiva', 'RecarregaMax', 'Ion Total'],
    material_esportivo: ['Tope', 'Ardidas', 'Pênallti', 'Fitas', 'Kappas', 'Tumdro', 'Lêcoque', 'Strike', 'Nova Ballada'],
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomProposal(slotKey, valorizacaoLevel) {
    const slot = SPONSOR_SLOTS[slotKey];
    const mult = 1 + (valorizacaoLevel || 0) * 0.25;
    const min = slot.min * mult, max = slot.max * mult;
    const value = Math.round((min + Math.random() * (max - min)) / 100) * 100;
    return { name: pick(SPONSOR_NAMES[slotKey]), value };
  }

  function upgradeCost(currentLevel) {
    return Math.round(BASE_COST * Math.pow(currentLevel + 1, 1.6));
  }

  // O nível de cada profissional/departamento é limitado pela divisão atual do clube —
  // dinheiro sozinho não compra uma estrutura de ponta enquanto o time ainda está
  // disputando o Campeonato do Bairro, por exemplo.
  const CAMPUS_TIER_CAPS = { bairro: 1, cidade: 2, regional: 4, estadual: 5 };

  function maxDepartmentLevelForGroup(tierGroupKey) {
    const cap = CAMPUS_TIER_CAPS[tierGroupKey];
    return Math.min(MAX_LEVEL, cap == null ? MAX_LEVEL : cap);
  }

  function defaultClub() {
    const departments = {};
    Object.keys(DEPARTMENTS).forEach((k) => { departments[k] = 0; });
    const sponsors = {};
    Object.keys(SPONSOR_SLOTS).forEach((k) => { sponsors[k] = { current: null, proposal: randomProposal(k) }; });
    return Object.assign({ budget: STARTING_BUDGET, departments, sponsors }, defaultCustomization());
  }

  function loadClub() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // fill in any departments/sponsor slots added since this club was saved
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
        if (parsed.torcidaName === undefined) parsed.torcidaName = defaults.torcidaName;
        if (parsed.valorizacaoLevel == null) parsed.valorizacaoLevel = defaults.valorizacaoLevel;
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

  function upgradeDepartment(club, key, levelCap) {
    const level = club.departments[key] || 0;
    const cap = levelCap == null ? MAX_LEVEL : Math.min(MAX_LEVEL, levelCap);
    if (level >= MAX_LEVEL) return { ok: false, reason: 'max' };
    if (level >= cap) return { ok: false, reason: 'tier_locked' };
    const cost = upgradeCost(level);
    if (club.budget < cost) return { ok: false, reason: 'money', cost };
    club.budget -= cost;
    club.departments[key] = level + 1;
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

  // Chamada quando o clube conquista um título: eleva o patamar de patrocínio
  // permanentemente e atualiza as propostas em aberto para refletir o novo prestígio.
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

  function payMatchExpenses(club, squad) {
    const payroll = squad ? squad.players.reduce((s, p) => s + (p.salary || 0), 0) : 0;
    const total = payroll + OTHER_EXPENSES_PER_MATCH;
    club.budget -= total;
    saveClub(club);
    return { payroll, other: OTHER_EXPENSES_PER_MATCH, total };
  }

  function payEndOfSeason(club, squad) {
    const payroll = squad ? squad.players.reduce((s, p) => s + (p.salary || 0), 0) : 0;
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

  window.WSPClub = {
    DEPARTMENTS, MAX_LEVEL, STARTING_BUDGET, SPONSOR_SLOTS, OTHER_EXPENSES_PER_MATCH,
    PREMIUM_COST, CREST_SHAPES, CREST_EMBLEMS, FACILITY_GROUPS, TORCIDA_NAME_MAX,
    CAMPUS_TIER_CAPS,
    upgradeCost, loadClub, saveClub, upgradeDepartment, defaultClub,
    acceptSponsor, rerollSponsor, dismissDepartment, payMatchExpenses, payEndOfSeason,
    unlockPremium, saveCustomization,
    facilityGroupLevel, facilityTierLabel, setTorcidaName, payMatchRevenue,
    maxDepartmentLevelForGroup, bumpValorizacao,
  };
})();
