(() => {
  'use strict';
  const { DEPARTMENTS, MAX_LEVEL, upgradeCost, loadClub, upgradeDepartment } = window.WSPClub;

  const club = loadClub();
  const budgetEl = document.getElementById('budget-value');
  const listEl = document.getElementById('dept-list');

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
      info.appendChild(btn);

      card.appendChild(info);
      listEl.appendChild(card);
    });
  }

  render();
})();
