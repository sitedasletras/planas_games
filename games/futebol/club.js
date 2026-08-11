(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_club_v1';
  const STARTING_BUDGET = 500000;
  const MAX_LEVEL = 5;
  const BASE_COST = 8000;

  const DEPARTMENTS = {
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
  };

  function upgradeCost(currentLevel) {
    return Math.round(BASE_COST * Math.pow(currentLevel + 1, 1.6));
  }

  function defaultClub() {
    const departments = {};
    Object.keys(DEPARTMENTS).forEach((k) => { departments[k] = 0; });
    return { budget: STARTING_BUDGET, departments };
  }

  function loadClub() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // fill in any departments added since this club was saved
        Object.keys(DEPARTMENTS).forEach((k) => {
          if (!(k in parsed.departments)) parsed.departments[k] = 0;
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

  window.WSPClub = {
    DEPARTMENTS, MAX_LEVEL, STARTING_BUDGET,
    upgradeCost, loadClub, saveClub, upgradeDepartment, defaultClub,
  };
})();
