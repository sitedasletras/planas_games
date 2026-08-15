(() => {
  'use strict';
  const {
    DEPARTMENTS, MAX_LEVEL, upgradeCost, effectiveUpgradeCost, loadClub, upgradeDepartment,
    SPONSOR_SLOTS, acceptSponsor, rerollSponsor, dismissDepartment,
    FACILITY_GROUPS, TORCIDA_NAME_MAX, facilityGroupLevel, facilityTierLabel, tierNameForLevel, setTorcidaName,
    moraleLabel, MOTORES, CHASSIS, setMotorSupplier, setChassiSupplier, setTireSupplier, isSupplierLocked,
    chassiPaceFactor,
  } = window.WSPF1Equipe;
  const TIRE_SUPPLIERS = window.WSPF1Corrida.TIRE_SUPPLIERS;
  const motorSupplierFuelFactor = window.WSPF1Corrida.motorSupplierFuelFactor;

  const club = loadClub();
  // contrato de fornecedor trava até a pré-temporada seguinte — precisa
  // saber em que temporada estamos pra decidir se ainda tá travado, e o
  // rendimento de potência do motor também é por temporada
  const calState = window.WSPF1Calendario ? window.WSPF1Calendario.loadState() : null;
  const seasonNumber = calState ? calState.seasonNumber : 1;
  const motorPerformanceTable = calState ? calState.motorPerformance || {} : {};
  const budgetEl = document.getElementById('budget-value');
  const moraleFillEl = document.getElementById('morale-fill');
  const moraleValueEl = document.getElementById('morale-value');
  const listEl = document.getElementById('dept-list');
  const sponsorListEl = document.getElementById('sponsor-list');
  const motorSelectEl = document.getElementById('motor-select');
  const chassiSelectEl = document.getElementById('chassi-select');
  const tireSelectEl = document.getElementById('tire-select');

  function formatMoney(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function buildLevelBar(level, max) {
    const wrap = document.createElement('div');
    wrap.className = 'level-bar-wrap';
    const track = document.createElement('div');
    track.className = 'level-track';
    const fill = document.createElement('div');
    fill.className = 'level-fill';
    fill.style.width = Math.round((level / max) * 100) + '%';
    track.appendChild(fill);
    wrap.appendChild(track);
    const label = document.createElement('span');
    label.className = 'level-bar-label';
    label.textContent = level + '/' + max;
    wrap.appendChild(label);
    return wrap;
  }

  function buildDeptCard(key) {
    const dept = DEPARTMENTS[key];
    const level = club.departments[key] || 0;
    const maxed = level >= MAX_LEVEL;
    const cost = maxed ? null : effectiveUpgradeCost(club, key);

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

    info.appendChild(buildLevelBar(level, MAX_LEVEL));

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
    return card;
  }

  function buildTorcidaNaming(group) {
    const level = facilityGroupLevel(club, 'torcida');
    const wrap = document.createElement('div');
    wrap.className = 'torcida-naming';

    if (level < group.nameableFromLevel) {
      wrap.classList.add('locked');
      wrap.textContent = 'Evolua o Fã-Clube até "' + tierNameForLevel(group, group.nameableFromLevel) + '" (nível ' + group.nameableFromLevel + ') para poder batizá-lo.';
      return wrap;
    }

    const current = document.createElement('div');
    current.className = 'torcida-current-name';
    current.textContent = club.torcidaName ? 'Nome atual: ' + club.torcidaName : 'Seu fã-clube ainda não tem nome.';
    wrap.appendChild(current);

    const row = document.createElement('div');
    row.className = 'torcida-naming-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = TORCIDA_NAME_MAX;
    input.placeholder = 'Nome do fã-clube';
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

    info.appendChild(buildLevelBar(level, MAX_LEVEL));

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
        reroll.title = 'Trocar proposta';
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

  function renderSuppliers() {
    const motorLocked = isSupplierLocked(club.motorLockedSeason, seasonNumber);
    const chassiLocked = isSupplierLocked(club.chassiLockedSeason, seasonNumber);
    const tireLocked = isSupplierLocked(club.tireLockedSeason, seasonNumber);

    motorSelectEl.innerHTML = '';
    MOTORES.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      const potencia = motorPerformanceTable[name];
      const consumo = Math.round(motorSupplierFuelFactor(name) * 100);
      opt.textContent = name + ' (potência ' + (potencia != null ? potencia + '%' : '?') + ' · consumo ' + consumo + '%)';
      if (name === club.motorSupplier) opt.selected = true;
      motorSelectEl.appendChild(opt);
    });
    motorSelectEl.disabled = motorLocked;
    document.getElementById('motor-locked-note').classList.toggle('hidden', !motorLocked);

    chassiSelectEl.innerHTML = '';
    CHASSIS.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name + ' (ritmo ' + Math.round(chassiPaceFactor(name) * 100) + '%)';
      if (name === club.chassiSupplier) opt.selected = true;
      chassiSelectEl.appendChild(opt);
    });
    chassiSelectEl.disabled = chassiLocked;
    document.getElementById('chassi-locked-note').classList.toggle('hidden', !chassiLocked);

    tireSelectEl.innerHTML = '';
    Object.keys(TIRE_SUPPLIERS).forEach((key) => {
      const supplier = TIRE_SUPPLIERS[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = supplier.label + ' (seco ' + Math.round(supplier.profile.seco * 100) + '% · chuva ' + Math.round(supplier.profile.chuva * 100) + '%)';
      if (key === club.tireSupplier) opt.selected = true;
      tireSelectEl.appendChild(opt);
    });
    tireSelectEl.disabled = tireLocked;
    document.getElementById('tire-locked-note').classList.toggle('hidden', !tireLocked);
  }

  motorSelectEl.addEventListener('change', () => {
    const result = setMotorSupplier(club, motorSelectEl.value, seasonNumber);
    if (!result.ok) motorSelectEl.value = club.motorSupplier;
    renderSuppliers();
  });
  chassiSelectEl.addEventListener('change', () => {
    const result = setChassiSupplier(club, chassiSelectEl.value, seasonNumber);
    if (!result.ok) chassiSelectEl.value = club.chassiSupplier;
    renderSuppliers();
  });
  tireSelectEl.addEventListener('change', () => {
    const result = setTireSupplier(club, tireSelectEl.value, seasonNumber);
    if (!result.ok) tireSelectEl.value = club.tireSupplier;
    renderSuppliers();
  });

  function render() {
    budgetEl.textContent = formatMoney(club.budget);
    const morale = club.morale == null ? 50 : club.morale;
    moraleFillEl.style.width = morale + '%';
    moraleValueEl.textContent = moraleLabel(morale) + ' (' + morale + ')';

    listEl.innerHTML = '';
    Object.keys(FACILITY_GROUPS).forEach((groupKey) => {
      listEl.appendChild(buildFacilityBlock(groupKey));
    });

    renderSponsors();
    renderSuppliers();
  }

  render();
})();
