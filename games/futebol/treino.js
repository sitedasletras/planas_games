(() => {
  'use strict';
  const { POSITIONS, loadSquad, saveSquad, careerStageFor, isInjured, applyConditionRecovery } = window.WSPSquad;
  const { loadClub } = window.WSPClub || {};
  const Cal = window.WSPCalendar;

  const STORAGE_KEY = 'wsp_training_v1';
  const COOLDOWN_MS = (Cal && Cal.GAME_DAY_REAL_MS) || 2 * 60 * 60 * 1000; // 1 dia do jogo
  const FISICA_DEPTS = ['preparador_fisico', 'musculacao', 'hidromassagem'];

  const squad = loadSquad();
  const club = loadClub ? loadClub() : null;
  const fisicaLevel = club ? FISICA_DEPTS.reduce((s, k) => s + (club.departments[k] || 0), 0) / FISICA_DEPTS.length : 0;
  if (applyConditionRecovery && applyConditionRecovery(squad, fisicaLevel)) saveSquad(squad);

  const statusEl = document.getElementById('training-status');
  const listEl = document.getElementById('training-list');
  const physicalDescEl = document.getElementById('physical-card-desc');
  const physicalBtnEl = document.getElementById('physical-btn');

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return raw || { lastTrainingAt: null, lastResult: null, lastPhysicalAt: null };
    } catch (e) { return { lastTrainingAt: null, lastResult: null, lastPhysicalAt: null }; }
  }
  function saveState(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  }

  let state = loadState();

  function cooldownRemaining() {
    if (!state.lastTrainingAt) return 0;
    return Math.max(0, state.lastTrainingAt + COOLDOWN_MS - Date.now());
  }

  function physicalCooldownRemaining() {
    if (!state.lastPhysicalAt) return 0;
    return Math.max(0, state.lastPhysicalAt + COOLDOWN_MS - Date.now());
  }

  function physicalBoost() {
    return Math.min(35, 15 + fisicaLevel * 1);
  }

  function renderPhysical() {
    const remaining = physicalCooldownRemaining();
    const boost = physicalBoost();
    physicalDescEl.textContent = 'Sessão coletiva de condicionamento — recupera até +' + boost.toFixed(0)
      + '% de condicionamento físico pra todo o elenco (nível médio da Preparação Física: ' + fisicaLevel.toFixed(1) + ').'
      + ' Quer trocar o responsável? Dispense e contrate outro Preparador Físico no Clube > Campus.';
    if (remaining > 0) {
      physicalBtnEl.textContent = 'Próximo treino físico em ' + (Cal ? Cal.formatCountdown(remaining) : Math.ceil(remaining / 60000) + 'min');
      physicalBtnEl.disabled = true;
    } else {
      physicalBtnEl.textContent = 'Treino físico coletivo';
      physicalBtnEl.disabled = false;
    }
  }

  physicalBtnEl.addEventListener('click', () => {
    if (physicalCooldownRemaining() > 0) return;
    const boost = physicalBoost();
    squad.players.forEach((p) => {
      p.condition = Math.min(100, (p.condition == null ? 100 : p.condition) + boost);
    });
    state.lastPhysicalAt = Date.now();
    saveState(state);
    saveSquad(squad);
    renderPhysical();
  });

  function trainable(p) {
    const stage = careerStageFor(p.age);
    return (stage === 'promessa' || stage === 'ascensao') && !isInjured(p);
  }

  function attemptTraining(player) {
    const potential = player.potential || 5;
    const chance = Math.min(0.35, 0.12 * (0.4 + potential / 20));
    const success = Math.random() < chance;
    if (success) player.rating = Math.min(99, (player.rating || 60) + 1);
    return success;
  }

  function render() {
    const remaining = cooldownRemaining();
    if (remaining > 0) {
      statusEl.innerHTML = 'Próximo treino disponível em <span class="cooldown">' + (Cal ? Cal.formatCountdown(remaining) : Math.ceil(remaining / 60000) + 'min') + '</span>.';
    } else {
      statusEl.textContent = 'Treino disponível — escolha uma promessa pra focar a sessão de hoje.';
    }

    listEl.innerHTML = '';
    const candidates = squad.players.filter(trainable).sort((a, b) => (b.potential || 0) - (a.potential || 0));

    if (!candidates.length) {
      const empty = document.createElement('div');
      empty.className = 'training-empty';
      empty.textContent = 'Nenhuma promessa jovem no elenco pra treinar agora — jogadores em fase de ascensão/promessa evoluem com o treino.';
      listEl.appendChild(empty);
      return;
    }

    candidates.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'player-card ' + p.bucket.toLowerCase();

      const info = document.createElement('div');
      info.className = 'player-info';

      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = '#' + p.number + ' ' + p.name;
      info.appendChild(name);

      const pos = document.createElement('div');
      pos.className = 'player-position';
      pos.textContent = (POSITIONS[p.position] ? POSITIONS[p.position].label : '') + ' · Nota ' + (p.rating || 60) + ' · Potencial ' + p.potential;
      info.appendChild(pos);

      const btn = document.createElement('button');
      btn.className = 'train-btn';
      btn.textContent = 'Treinar';
      btn.disabled = remaining > 0;
      btn.addEventListener('click', () => {
        if (cooldownRemaining() > 0) return;
        const success = attemptTraining(p);
        state.lastTrainingAt = Date.now();
        state.lastResult = { name: p.name, success };
        saveState(state);
        saveSquad(squad);
        render();
      });
      info.appendChild(btn);

      if (state.lastResult && state.lastResult.name === p.name && remaining > 0) {
        const result = document.createElement('div');
        result.className = 'training-result ' + (state.lastResult.success ? 'success' : 'fail');
        result.textContent = state.lastResult.success
          ? '📈 Evoluiu! Nota subiu pra ' + p.rating + '.'
          : 'Treino de hoje não trouxe evolução — tenta de novo amanhã.';
        info.appendChild(result);
      }

      card.appendChild(info);
      listEl.appendChild(card);
    });
  }

  render();
  renderPhysical();
  setInterval(() => { render(); renderPhysical(); }, 60000);
})();
