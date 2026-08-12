(() => {
  'use strict';
  const {
    DEPARTMENTS, MAX_LEVEL, upgradeCost, loadClub, upgradeDepartment,
    SPONSOR_SLOTS, acceptSponsor, rerollSponsor, dismissDepartment,
    FACILITY_GROUPS, TORCIDA_NAME_MAX, facilityGroupLevel, facilityTierLabel, setTorcidaName,
    maxDepartmentLevelForGroup,
  } = window.WSPClub;

  const club = loadClub();
  const budgetEl = document.getElementById('budget-value');
  const listEl = document.getElementById('dept-list');
  const sponsorListEl = document.getElementById('sponsor-list');
  const tierNoteEl = document.getElementById('campus-tier-note');

  const S = window.WSPSeason;
  const seasonState = S.loadState();
  const currentTier = S.TIERS[seasonState.tierIndex];
  const tierGroupIndex = S.TIER_GROUPS.findIndex((g) => g.key === currentTier.group);
  const nextTierGroup = S.TIER_GROUPS[tierGroupIndex + 1];
  const levelCap = maxDepartmentLevelForGroup(currentTier.group);

  function formatMoney(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function buildDeptCard(key) {
    const dept = DEPARTMENTS[key];
    const level = club.departments[key] || 0;
    const maxed = level >= MAX_LEVEL;
    const tierLocked = !maxed && level >= levelCap;
    const cost = (maxed || tierLocked) ? null : upgradeCost(level);

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
    } else if (tierLocked) {
      btn.textContent = nextTierGroup
        ? 'Libera no ' + nextTierGroup.label
        : 'Nível Máximo';
      btn.disabled = true;
    } else {
      const canAfford = club.budget >= cost;
      btn.textContent = 'Melhorar — ' + formatMoney(cost);
      btn.disabled = !canAfford;
      btn.addEventListener('click', () => {
        const result = upgradeDepartment(club, key, levelCap);
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
    return card;
  }

  function buildTorcidaNaming(group) {
    const level = facilityGroupLevel(club, 'torcida');
    const wrap = document.createElement('div');
    wrap.className = 'torcida-naming';

    if (level < group.nameableFromLevel) {
      wrap.classList.add('locked');
      wrap.textContent = 'Evolua a Torcida até "' + group.tiers[group.nameableFromLevel] + '" para poder batizá-la.';
      return wrap;
    }

    const current = document.createElement('div');
    current.className = 'torcida-current-name';
    current.textContent = club.torcidaName ? 'Nome atual: ' + club.torcidaName : 'Sua torcida organizada ainda não tem nome.';
    wrap.appendChild(current);

    const row = document.createElement('div');
    row.className = 'torcida-naming-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = TORCIDA_NAME_MAX;
    input.placeholder = 'Nome da torcida organizada';
    input.value = club.torcidaName || '';
    row.appendChild(input);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'upgrade-btn';
    saveBtn.textContent = 'Salvar nome';
    saveBtn.addEventListener('click', () => {
      const result = setTorcidaName(club, input.value);
      if (result.ok) render();
    });
    row.appendChild(saveBtn);

    wrap.appendChild(row);
    return wrap;
  }

  function buildFacilityBlock(groupKey) {
    const group = FACILITY_GROUPS[groupKey];
    const level = facilityGroupLevel(club, groupKey);
    const tierLabel = facilityTierLabel(club, groupKey);

    const block = document.createElement('div');
    block.className = 'facility-block';

    const header = document.createElement('div');
    header.className = 'facility-header';

    const icon = document.createElement('div');
    icon.className = 'facility-icon';
    icon.textContent = group.icon;
    header.appendChild(icon);

    const info = document.createElement('div');
    info.className = 'facility-info';

    const label = document.createElement('div');
    label.className = 'facility-label';
    label.textContent = group.label;
    info.appendChild(label);

    const tier = document.createElement('div');
    tier.className = 'facility-tier';
    tier.textContent = tierLabel;
    info.appendChild(tier);

    const levels = document.createElement('div');
    levels.className = 'dept-levels';
    for (let i = 0; i < MAX_LEVEL; i++) {
      const dot = document.createElement('span');
      dot.className = 'level-dot' + (i < level ? ' filled' : '');
      levels.appendChild(dot);
    }
    info.appendChild(levels);

    header.appendChild(info);
    block.appendChild(header);

    if (group.nameable) {
      block.appendChild(buildTorcidaNaming(group));
    }

    const deptCards = document.createElement('div');
    deptCards.className = 'facility-depts';
    group.depts.forEach((key) => deptCards.appendChild(buildDeptCard(key)));
    block.appendChild(deptCards);

    return block;
  }

  function render() {
    budgetEl.textContent = formatMoney(club.budget);
    tierNoteEl.textContent = currentTier.groupLabel + ' — profissionais limitados ao nível ' + levelCap + '/' + MAX_LEVEL
      + (nextTierGroup ? ' até subir para o ' + nextTierGroup.label : ' (nível máximo já disponível)');
    listEl.innerHTML = '';

    Object.keys(FACILITY_GROUPS).forEach((groupKey) => {
      listEl.appendChild(buildFacilityBlock(groupKey));
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
