(() => {
  'use strict';
  const {
    DEPARTMENTS, MAX_LEVEL, upgradeCost, loadClub, upgradeDepartment,
    SPONSOR_SLOTS, acceptSponsor, rerollSponsor, dismissDepartment,
  } = window.WSPClub;

  const club = loadClub();
  const budgetEl = document.getElementById('budget-value');
  const listEl = document.getElementById('dept-list');
  const sponsorListEl = document.getElementById('sponsor-list');

  function formatMoney(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function render() {
    budgetEl.textContent = formatMoney(club.budget);
    listEl.innerHTML = '';

    Object.keys(DEPARTMENTS).forEach((key) => {
      const dept = DEPARTMENTS[key];
      const level = club.departments[key] || 0;
      const maxed = level >= MAX_LEVEL;
      const cost = maxed ? null : upgradeCost(level);

      const card = document.createElement('div');
      card.className = 'dept-card';

      const icon = document.createElement('div');
      icon.className = 'dept-icon';
      icon.textContent = dept.icon;
      card.appendChild(icon);

      const info = document.createElement('div');
      info.className = 'dept-info';

      const name = document.createElement('div');
      name.className = 'dept-name';
      name.textContent = dept.label;
      info.appendChild(name);

      const desc = document.createElement('div');
      desc.className = 'dept-desc';
      desc.textContent = dept.desc;
      info.appendChild(desc);

      const levels = document.createElement('div');
      levels.className = 'dept-levels';
      for (let i = 0; i < MAX_LEVEL; i++) {
        const dot = document.createElement('span');
        dot.className = 'level-dot' + (i < level ? ' filled' : '');
        levels.appendChild(dot);
      }
      info.appendChild(levels);

      const btnRow = document.createElement('div');
      btnRow.className = 'sponsor-proposal';

      const btn = document.createElement('button');
      btn.className = 'upgrade-btn';
      if (maxed) {
        btn.textContent = 'Nível Máximo';
        btn.disabled = true;
      } else {
        const canAfford = club.budget >= cost;
        btn.textContent = 'Melhorar — ' + formatMoney(cost);
        btn.disabled = !canAfford;
        btn.addEventListener('click', () => {
          const result = upgradeDepartment(club, key);
          if (result.ok) render();
        });
      }
      btnRow.appendChild(btn);

      if (level > 0) {
        const dismissCost = Math.round(upgradeCost(level - 1) * 0.6);
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'reroll-btn';
        dismissBtn.textContent = 'Dispensar — ' + formatMoney(dismissCost);
        dismissBtn.disabled = club.budget < dismissCost;
        dismissBtn.addEventListener('click', () => {
          if (!confirm('Dispensar ' + dept.label + ' por ' + formatMoney(dismissCost) + '?')) return;
          const result = dismissDepartment(club, key);
          if (result.ok) render();
        });
        btnRow.appendChild(dismissBtn);
      }

      info.appendChild(btnRow);

      card.appendChild(info);
      listEl.appendChild(card);
    });

    renderSponsors();
  }

  function renderSponsors() {
    sponsorListEl.innerHTML = '';

    Object.keys(SPONSOR_SLOTS).forEach((key) => {
      const slotDef = SPONSOR_SLOTS[key];
      const slot = club.sponsors[key];

      const card = document.createElement('div');
      card.className = 'dept-card';

      const icon = document.createElement('div');
      icon.className = 'dept-icon';
      icon.textContent = slotDef.icon;
      card.appendChild(icon);

      const info = document.createElement('div');
      info.className = 'dept-info';

      const name = document.createElement('div');
      name.className = 'dept-name';
      name.textContent = slotDef.label;
      info.appendChild(name);

      const current = document.createElement('div');
      current.className = 'sponsor-current';
      current.innerHTML = slot.current
        ? 'Patrocinador atual: <strong>' + slot.current.name + '</strong> (' + formatMoney(slot.current.value) + ')'
        : '<span class="none">Nenhum patrocinador ainda</span>';
      info.appendChild(current);

      if (slot.current) {
        const locked = document.createElement('div');
        locked.className = 'sponsor-locked';
        locked.textContent = '🔒 Contrato fechado até a próxima temporada';
        info.appendChild(locked);
      } else {
        const proposalRow = document.createElement('div');
        proposalRow.className = 'sponsor-proposal';

        const btn = document.createElement('button');
        btn.className = 'upgrade-btn';
        btn.textContent = 'Aceitar ' + slot.proposal.name + ' — ' + formatMoney(slot.proposal.value);
        btn.addEventListener('click', () => {
          acceptSponsor(club, key);
          render();
        });
        proposalRow.appendChild(btn);

        const reroll = document.createElement('button');
        reroll.className = 'reroll-btn';
        reroll.textContent = '🔄';
        reroll.title = 'Ver outra proposta';
        reroll.addEventListener('click', () => {
          rerollSponsor(club, key);
          render();
        });
        proposalRow.appendChild(reroll);

        info.appendChild(proposalRow);
      }

      card.appendChild(info);
      sponsorListEl.appendChild(card);
    });
  }

  render();
})();
