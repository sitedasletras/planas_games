(() => {
  'use strict';
  const {
    DEPARTMENTS, MAX_LEVEL, upgradeCost, effectiveUpgradeCost, loadClub, upgradeDepartment,
    SPONSOR_SLOTS, acceptSponsor, rerollSponsor, dismissDepartment,
    FACILITY_GROUPS, TORCIDA_NAME_MAX, facilityGroupLevel, facilityTierLabel, tierNameForLevel, setTorcidaName,
    maxDepartmentLevelForGroup, moraleLabel,
  } = window.WSPClub;

  const club = loadClub();
  const budgetEl = document.getElementById('budget-value');
  const moraleFillEl = document.getElementById('morale-fill');
  const moraleValueEl = document.getElementById('morale-value');
  const listEl = document.getElementById('dept-list');
  const sponsorListEl = document.getElementById('sponsor-list');
  const tierNoteEl = document.getElementById('campus-tier-note');
  const calendarLabelEl = document.getElementById('calendar-label');
  const calendarValueEl = document.getElementById('calendar-value');
  const calendarPlayBtnEl = document.getElementById('calendar-play-btn');
  const calendarAdBtnEl = document.getElementById('calendar-ad-btn');
  const newsSectionEl = document.getElementById('news-section');
  const newsListEl = document.getElementById('news-list');
  const activityMedicoEl = document.getElementById('activity-medico');
  const adOverlayEl = document.getElementById('ad-overlay');
  const adSubEl = document.getElementById('ad-sub');
  const adBarFillEl = document.getElementById('ad-bar-fill');
  const adCloseBtnEl = document.getElementById('ad-close-btn');
  const dayReportOverlayEl = document.getElementById('day-report-overlay');
  const dayReportTextEl = document.getElementById('day-report-text');
  const dayReportExtraEl = document.getElementById('day-report-extra');
  const dayReportContinueBtnEl = document.getElementById('day-report-continue-btn');

  function renderMedicoBadge() {
    if (!activityMedicoEl || !window.WSPSquad) return;
    const squad = window.WSPSquad.loadSquad();
    const injuredCount = squad.players.filter((p) => window.WSPSquad.isInjured(p)).length;
    const existing = activityMedicoEl.querySelector('.activity-badge');
    if (existing) existing.remove();
    if (injuredCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'activity-badge';
      badge.textContent = injuredCount;
      activityMedicoEl.appendChild(badge);
    }
  }

  const S = window.WSPSeason;
  const seasonState = S.loadState();
  const currentTier = S.TIERS[seasonState.tierIndex];
  const tierGroupIndex = S.TIER_GROUPS.findIndex((g) => g.key === currentTier.group);
  const nextTierGroup = S.TIER_GROUPS[tierGroupIndex + 1];
  const levelCap = maxDepartmentLevelForGroup(currentTier.group);

  function formatMoney(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  // barra de progresso compacta — com 20 níveis, 20 pontinhos não cabem bem
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
    const tierLocked = !maxed && level >= levelCap;
    const cost = (maxed || tierLocked) ? null : effectiveUpgradeCost(club, key);
    const discounted = !!(club.pendingDiscount && cost != null && cost < upgradeCost(level));

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
    } else if (tierLocked) {
      btn.textContent = nextTierGroup
        ? 'Libera no ' + nextTierGroup.label
        : 'Nível Máximo';
      btn.disabled = true;
    } else {
      const canAfford = club.budget >= cost;
      btn.textContent = (discounted ? '🏛️ ' : '') + 'Melhorar — ' + formatMoney(cost) + (discounted ? ' (desconto da diretoria)' : '');
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
      wrap.textContent = 'Evolua a Torcida até "' + tierNameForLevel(group, group.nameableFromLevel) + '" (nível ' + group.nameableFromLevel + ') para poder batizá-la.';
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

  function renderCalendar() {
    if (!window.WSPCalendar) return;
    const cal = window.WSPCalendar.loadCalendar();
    const available = window.WSPCalendar.isMatchAvailable(cal);
    if (available) {
      calendarLabelEl.textContent = 'Partida';
      calendarValueEl.textContent = 'Disponível agora';
      calendarPlayBtnEl.classList.remove('hidden');
      calendarAdBtnEl.classList.add('hidden');
    } else {
      calendarLabelEl.textContent = 'Próxima partida libera em';
      calendarValueEl.textContent = window.WSPCalendar.formatCountdown(window.WSPCalendar.msUntilNextMatch(cal));
      calendarPlayBtnEl.classList.add('hidden');
      calendarAdBtnEl.classList.toggle('hidden', !window.WSPCalendar.canWatchAdToSkipDay(cal));
    }

    newsListEl.innerHTML = '';
    if (cal.headlines && cal.headlines.length) {
      newsSectionEl.classList.remove('hidden');
      cal.headlines.forEach((h) => {
        const item = document.createElement('div');
        item.className = 'news-item';
        item.textContent = h.text;
        const date = document.createElement('span');
        date.className = 'news-date';
        date.textContent = new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        item.appendChild(date);
        newsListEl.appendChild(item);
      });
    } else {
      newsSectionEl.classList.add('hidden');
    }
  }

  function render() {
    budgetEl.textContent = formatMoney(club.budget);
    const morale = club.morale == null ? 50 : club.morale;
    moraleFillEl.style.width = morale + '%';
    moraleValueEl.textContent = moraleLabel(morale) + ' (' + morale + ')';
    renderCalendar();
    renderMedicoBadge();
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

  // ---------- Assistir vídeo pra adiantar 1 dia ----------
  // por enquanto simula o anúncio com uma barra de progresso — quando o
  // provedor de vídeo recompensado for integrado, troca só o miolo dessa
  // função pela chamada real do SDK, o resto do fluxo já fica pronto
  let adWatchTimer = null;
  function openAdOverlay() {
    adSubEl.textContent = 'Carregando vídeo...';
    adBarFillEl.style.width = '0%';
    adCloseBtnEl.classList.add('hidden');
    adOverlayEl.classList.remove('hidden');
    const durationMs = 4000, stepMs = 100;
    let progress = 0;
    clearInterval(adWatchTimer);
    adWatchTimer = setInterval(() => {
      progress += stepMs;
      adBarFillEl.style.width = Math.min(100, (progress / durationMs) * 100) + '%';
      if (progress >= durationMs) {
        clearInterval(adWatchTimer);
        adSubEl.textContent = 'Vídeo concluído!';
        adCloseBtnEl.classList.remove('hidden');
      } else {
        adSubEl.textContent = 'Exibindo anúncio... ' + Math.ceil((durationMs - progress) / 1000) + 's';
      }
    }, stepMs);
  }

  // depois de cada vídeo, mostra um resumo do dia (treino/preparação/etc.)
  // em vez de já liberar o próximo vídeo direto — assim dá pra encadear
  // vários dias sem virar "clique 3x seguido sem sentir nada acontecer"
  const DAY_EVENTS = [
    'O elenco fez um treino tático leve durante o dia.',
    'Sessão de vídeo com a comissão técnica pra estudar o próximo adversário.',
    'Departamento médico acompanhou de perto a recuperação dos machucados.',
    'Preparação física trabalhou o condicionamento do grupo.',
    'Reapresentação no CT, com atividades regenerativas pro elenco.',
    'Comissão técnica revisou os últimos resultados com o time.',
  ];

  function showDayReport() {
    dayReportTextEl.textContent = DAY_EVENTS[Math.floor(Math.random() * DAY_EVENTS.length)];
    dayReportExtraEl.textContent = '';
    if (window.WSPSquad) {
      const squad = window.WSPSquad.loadSquad();
      const fisicaLevel = (club.departments && club.departments.preparador_fisico) || 0;
      window.WSPSquad.applyConditionRecovery(squad, fisicaLevel);
      window.WSPSquad.saveSquad(squad);
      if (squad.players.length) {
        const avgCondition = Math.round(squad.players.reduce((s, p) => s + (p.condition || 100), 0) / squad.players.length);
        dayReportExtraEl.textContent = 'Condicionamento médio do elenco: ' + avgCondition + '%.';
      }
    }
    dayReportOverlayEl.classList.remove('hidden');
  }

  if (calendarAdBtnEl) {
    calendarAdBtnEl.addEventListener('click', openAdOverlay);
  }
  if (adCloseBtnEl) {
    adCloseBtnEl.addEventListener('click', () => {
      const cal = window.WSPCalendar.loadCalendar();
      window.WSPCalendar.watchAdToSkipDay(cal);
      adOverlayEl.classList.add('hidden');
      calendarAdBtnEl.classList.add('hidden'); // só reaparece depois de confirmar o resumo do dia
      showDayReport();
    });
  }
  if (dayReportContinueBtnEl) {
    dayReportContinueBtnEl.addEventListener('click', () => {
      dayReportOverlayEl.classList.add('hidden');
      renderCalendar();
    });
  }

  render();
  setInterval(renderCalendar, 60000);
})();
