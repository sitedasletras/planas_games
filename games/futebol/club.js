(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_club_v1';
  const STARTING_BUDGET = 500000;
  const MAX_LEVEL = 5;
  const BASE_COST = 8000;

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
  };

  const SPONSOR_SLOTS = {
    camisa_frente: { label: 'Camisa (Frente)', icon: '👕', min: 150000, max: 400000 },
    lateral_campo: { label: 'Lateral de Campo', icon: '🚩', min: 20000, max: 60000 },
    isotonicos: { label: 'Fornecedor de Isotônicos', icon: '🥤', min: 15000, max: 40000 },
  };

  const SPONSOR_NAMES = {
    camisa_frente: ['TechBank', 'Cerveja Serra Alta', 'Voa Linhas Aéreas', 'Construtora Horizonte', 'SegurPrev Seguros', 'Grupo Atlas'],
    lateral_campo: ['Auto Peças Rael', 'Mercado Bom Preço', 'Farmácia Vitalis', 'Posto Estrada Nova', 'Imobiliária Cedro'],
    isotonicos: ['HidraSport', 'PotencIon', 'AguaViva Esportiva', 'RecarregaMax', 'Ion Total'],
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomProposal(slotKey) {
    const slot = SPONSOR_SLOTS[slotKey];
    const value = Math.round((slot.min + Math.random() * (slot.max - slot.min)) / 1000) * 1000;
    return { name: pick(SPONSOR_NAMES[slotKey]), value };
  }

  function upgradeCost(currentLevel) {
    return Math.round(BASE_COST * Math.pow(currentLevel + 1, 1.6));
  }

  function defaultClub() {
    const departments = {};
    Object.keys(DEPARTMENTS).forEach((k) => { departments[k] = 0; });
    const sponsors = {};
    Object.keys(SPONSOR_SLOTS).forEach((k) => { sponsors[k] = { current: null, proposal: randomProposal(k) }; });
    return { budget: STARTING_BUDGET, departments, sponsors };
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

  function upgradeDepartment(club, key) {
    const level = club.departments[key] || 0;
    if (level >= MAX_LEVEL) return { ok: false, reason: 'max' };
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
    slot.proposal = randomProposal(slotKey);
    saveClub(club);
    return { ok: true, value: slot.current.value };
  }

  function rerollSponsor(club, slotKey) {
    club.sponsors[slotKey].proposal = randomProposal(slotKey);
    saveClub(club);
  }

  window.WSPClub = {
    DEPARTMENTS, MAX_LEVEL, STARTING_BUDGET, SPONSOR_SLOTS,
    upgradeCost, loadClub, saveClub, upgradeDepartment, defaultClub,
    acceptSponsor, rerollSponsor,
  };
})();
