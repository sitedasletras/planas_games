(() => {
  'use strict';
  const {
    POSITIONS, TRAITS, FEET, NATIONALITIES, CAREER_STAGES, careerStageFor,
    loadSquad, releaseCost, generateCandidates, signPlayer, releasePlayer,
  } = window.WSPSquad;
  const { loadClub, saveClub } = window.WSPClub;

  const squad = loadSquad();
  const club = loadClub();
  document.getElementById('club-name').textContent = squad.clubName + ' — Elenco';

  const budgetPillEl = document.getElementById('budget-pill');
  const marketListEl = document.getElementById('market-list');
  const marketRerollBtn = document.getElementById('market-reroll');
  const sectionsEl = document.getElementById('elenco-sections');

  const FOOT_LABEL = {};
  FEET.forEach((f) => { FOOT_LABEL[f.key] = f.label; });
  const NAT_BY_KEY = {};
  NATIONALITIES.forEach((n) => { NAT_BY_KEY[n.key] = n; });

  const BUCKET_LABEL = { GK: 'Goleiros', DEF: 'Zaga', MID: 'Meio-campo', ATT: 'Ataque' };
  const BUCKET_ORDER = ['GK', 'DEF', 'MID', 'ATT'];

  function formatMoney(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function hairShape(style, color) {
    if (style === 'curto') return `<path d="M2 17 A18 17 0 0 1 38 17 L38 9 A18 13 0 0 0 2 9 Z" fill="${color}"/>`;
    if (style === 'moicano') return `<rect x="16" y="0" width="8" height="15" rx="3" fill="${color}"/>`;
    if (style === 'cacheado') return `<circle cx="8" cy="11" r="5" fill="${color}"/><circle cx="15" cy="6" r="6" fill="${color}"/><circle cx="25" cy="6" r="6" fill="${color}"/><circle cx="32" cy="11" r="5" fill="${color}"/>`;
    return '';
  }

  function avatarSVG(p, size) {
    const a = p.avatar;
    const hair = a.bald ? '' : hairShape(a.hairStyle, a.hairColor);
    return `<svg viewBox="0 0 40 40" width="${size}" height="${size}">
      <circle cx="20" cy="21" r="18" fill="${a.skin}" />
      <circle cx="14" cy="21" r="2" fill="#222" />
      <circle cx="26" cy="21" r="2" fill="#222" />
      <path d="M14 28 Q20 32 26 28" stroke="#222" stroke-width="1.6" fill="none" stroke-linecap="round" />
      ${hair}
    </svg>`;
  }

  let candidates = generateCandidates(3);

  function render() {
    budgetPillEl.textContent = formatMoney(club.budget);
    renderMarket();
    renderSquad();
  }

  function renderMarket() {
    marketListEl.innerHTML = '';
    candidates.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'market-player';

      const avatarWrap = document.createElement('div');
      avatarWrap.className = 'avatar-wrap';
      avatarWrap.style.width = '36px';
      avatarWrap.style.height = '36px';
      avatarWrap.innerHTML = avatarSVG(c, 36);
      row.appendChild(avatarWrap);

      const info = document.createElement('div');
      info.className = 'player-info';
      const name = document.createElement('div');
      name.className = 'player-name';
      const nat = NAT_BY_KEY[c.nationality];
      name.textContent = c.name + ' ' + (nat ? nat.flag : '');
      info.appendChild(name);
      const pos = document.createElement('div');
      pos.className = 'player-position';
      pos.textContent = POSITIONS[c.position].label + ' · ' + c.age + ' anos';
      info.appendChild(pos);
      row.appendChild(info);

      const btn = document.createElement('button');
      btn.className = 'sign-btn';
      btn.textContent = 'Contratar — ' + formatMoney(c.fee);
      btn.disabled = club.budget < c.fee;
      btn.addEventListener('click', () => {
        if (club.budget < c.fee) return;
        club.budget -= c.fee;
        saveClub(club);
        signPlayer(squad, c);
        candidates = candidates.filter((x) => x.id !== c.id);
        if (candidates.length < 3) candidates.push(...generateCandidates(3 - candidates.length));
        render();
      });
      row.appendChild(btn);

      marketListEl.appendChild(row);
    });
  }

  function renderSquad() {
    sectionsEl.innerHTML = '';

    BUCKET_ORDER.forEach((bucket) => {
      const players = squad.players
        .filter((p) => p.bucket === bucket)
        .sort((a, b) => a.number - b.number);
      if (!players.length) return;

      const section = document.createElement('div');
      section.className = 'elenco-section';
      const h2 = document.createElement('h2');
      h2.textContent = BUCKET_LABEL[bucket] + ' (' + players.length + ')';
      section.appendChild(h2);

      players.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'player-card ' + bucket.toLowerCase();

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'avatar-wrap';
        avatarWrap.innerHTML = avatarSVG(p, 44);
        const chip = document.createElement('span');
        chip.className = 'jersey-chip';
        chip.textContent = p.number;
        avatarWrap.appendChild(chip);
        card.appendChild(avatarWrap);

        const info = document.createElement('div');
        info.className = 'player-info';

        const name = document.createElement('div');
        name.className = 'player-name';
        const nat = NAT_BY_KEY[p.nationality];
        name.textContent = p.name + ' ' + (nat ? nat.flag : '');
        info.appendChild(name);

        const stageKey = careerStageFor(p.age);
        const pos = document.createElement('div');
        pos.className = 'player-position';
        pos.textContent = POSITIONS[p.position].label + ' · ' + p.age + ' anos · ' + p.height + 'cm · ' + CAREER_STAGES[stageKey].label;
        info.appendChild(pos);

        const salary = document.createElement('div');
        salary.className = 'player-position';
        salary.textContent = 'Salário: ' + formatMoney(p.salary) + '/partida';
        info.appendChild(salary);

        const badges = document.createElement('div');
        badges.className = 'player-badges';

        const footBadge = document.createElement('span');
        footBadge.className = 'badge foot';
        footBadge.textContent = FOOT_LABEL[p.foot];
        badges.appendChild(footBadge);

        p.traits.forEach((t) => {
          const b = document.createElement('span');
          b.className = 'badge trait';
          b.textContent = TRAITS[t].label;
          badges.appendChild(b);
        });

        info.appendChild(badges);

        const actions = document.createElement('div');
        actions.className = 'player-actions';
        const cost = releaseCost(p);
        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'dismiss-btn';
        dismissBtn.textContent = 'Dispensar — ' + formatMoney(cost);
        dismissBtn.disabled = club.budget < cost || squad.players.length <= 11;
        dismissBtn.title = squad.players.length <= 11 ? 'Elenco mínimo: 11 jogadores' : '';
        dismissBtn.addEventListener('click', () => {
          if (!confirm('Dispensar ' + p.name + ' por ' + formatMoney(cost) + ' de rescisão?')) return;
          club.budget -= cost;
          saveClub(club);
          releasePlayer(squad, p.id);
          render();
        });
        actions.appendChild(dismissBtn);
        info.appendChild(actions);

        card.appendChild(info);
        section.appendChild(card);
      });

      sectionsEl.appendChild(section);
    });
  }

  marketRerollBtn.addEventListener('click', () => {
    candidates = generateCandidates(3);
    renderMarket();
  });

  render();
})();
