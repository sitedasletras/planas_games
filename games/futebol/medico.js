(() => {
  'use strict';
  const { loadSquad, saveSquad, isInjured } = window.WSPSquad;
  const { loadClub, saveClub, facilityTierLabel } = window.WSPClub;
  const Cal = window.WSPCalendar;

  const squad = loadSquad();
  const club = loadClub();

  const budgetPillEl = document.getElementById('budget-pill');
  const deptNoteEl = document.getElementById('medico-dept-note');
  const sectionsEl = document.getElementById('injured-sections');

  const TREATMENT_COST = { 'lesão leve': 150, 'lesão moderada': 400, 'lesão grave': 900 };
  const TREATMENT_RELIEF_PCT = 0.4; // adianta 40% do tempo restante de recuperação

  function formatMoney(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

  function treatmentCostFor(player) {
    const base = TREATMENT_COST[player.injuryLabel] || 300;
    const level = (club.departments && club.departments.medico) || 0;
    const discount = Math.min(0.5, level * 0.02);
    return Math.max(50, Math.round(base * (1 - discount) / 10) * 10);
  }

  function render() {
    budgetPillEl.textContent = formatMoney(club.budget);
    const medicoLevel = (club.departments && club.departments.medico) || 0;
    deptNoteEl.textContent = facilityTierLabel(club, 'medico') + ' — quanto maior o nível, mais barato tratar lesões (desconto atual: '
      + Math.min(50, medicoLevel * 2) + '%).';

    sectionsEl.innerHTML = '';
    const injured = squad.players.filter((p) => isInjured(p));

    if (!injured.length) {
      const empty = document.createElement('div');
      empty.className = 'injury-empty';
      empty.textContent = 'Ninguém no departamento médico agora — elenco 100% disponível.';
      sectionsEl.appendChild(empty);
      return;
    }

    const section = document.createElement('div');
    section.className = 'elenco-section';
    injured.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'player-card ' + p.bucket.toLowerCase() + ' injury-card';

      const info = document.createElement('div');
      info.className = 'player-info';

      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = '#' + p.number + ' ' + p.name + ' 🤕';
      info.appendChild(name);

      const status = document.createElement('div');
      status.className = 'injury-status';
      const remainingMs = Math.max(0, p.injuredUntil - Date.now());
      const days = Cal ? Cal.gameDaysRemaining(remainingMs) : Math.ceil(remainingMs / (2 * 60 * 60 * 1000));
      status.textContent = (p.injuryLabel || 'lesão') + ' — recupera em ' + (days <= 1 ? '1 dia' : days + ' dias');
      info.appendChild(status);

      const cost = treatmentCostFor(p);
      const btn = document.createElement('button');
      btn.className = 'injury-treat-btn';
      btn.textContent = 'Tratamento intensivo — ' + formatMoney(cost);
      btn.disabled = club.budget < cost;
      btn.addEventListener('click', () => {
        if (club.budget < cost) return;
        club.budget -= cost;
        const reliefMs = Math.max(0, p.injuredUntil - Date.now()) * TREATMENT_RELIEF_PCT;
        window.WSPSquad.reduceInjuryBy(p, reliefMs);
        saveClub(club);
        saveSquad(squad);
        render();
      });
      info.appendChild(btn);

      card.appendChild(info);
      section.appendChild(card);
    });
    sectionsEl.appendChild(section);
  }

  render();
})();
