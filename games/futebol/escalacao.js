(() => {
  'use strict';
  const {
    POSITIONS, FEET, NATIONALITIES, CAREER_STAGES, careerStageFor, loadSquad,
  } = window.WSPSquad;

  const squad = loadSquad();
  const sectionsEl = document.getElementById('lineup-sections');

  const FOOT_LABEL = {};
  FEET.forEach((f) => { FOOT_LABEL[f.key] = f.label; });
  const NAT_BY_KEY = {};
  NATIONALITIES.forEach((n) => { NAT_BY_KEY[n.key] = n; });

  const BUCKET_LABEL = { GK: 'Goleiros', DEF: 'Zaga', MID: 'Meio-campo', ATT: 'Ataque' };
  const BUCKET_ORDER = ['GK', 'DEF', 'MID', 'ATT'];
  // preview formation: equilibrado (4-3-3) — the tactic every match starts with
  const STARTERS_NEEDED = { GK: 1, DEF: 4, MID: 3, ATT: 3 };
  const STAGE_PRIORITY = { auge: 0, experiente: 1, ascensao: 2, promessa: 3, declinio: 4 };

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

  BUCKET_ORDER.forEach((bucket) => {
    const players = squad.players
      .filter((p) => p.bucket === bucket)
      .sort((a, b) => {
        const sa = STAGE_PRIORITY[careerStageFor(a.age)], sb = STAGE_PRIORITY[careerStageFor(b.age)];
        if (sa !== sb) return sa - sb;
        return a.number - b.number;
      });
    if (!players.length) return;

    const needed = STARTERS_NEEDED[bucket] || 0;

    const section = document.createElement('div');
    section.className = 'elenco-section';
    const h2 = document.createElement('h2');
    h2.textContent = BUCKET_LABEL[bucket] + ' (' + players.length + ')';
    section.appendChild(h2);

    players.forEach((p, i) => {
      const isStarter = i < needed;
      const card = document.createElement('div');
      card.className = 'player-card ' + bucket.toLowerCase() + (isStarter ? '' : ' bench');

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
      name.innerHTML = p.name + ' ' + (nat ? nat.flag : '') +
        '<span class="starter-tag ' + (isStarter ? 'starting">Titular' : 'bench">Banco') + '</span>';
      info.appendChild(name);

      const stageKey = careerStageFor(p.age);
      const pos = document.createElement('div');
      pos.className = 'player-position';
      pos.textContent = POSITIONS[p.position].label + ' · ' + p.age + ' anos · ' + CAREER_STAGES[stageKey].label;
      info.appendChild(pos);

      const badges = document.createElement('div');
      badges.className = 'player-badges';
      const footBadge = document.createElement('span');
      footBadge.className = 'badge foot';
      footBadge.textContent = FOOT_LABEL[p.foot];
      badges.appendChild(footBadge);
      info.appendChild(badges);

      card.appendChild(info);
      section.appendChild(card);
    });

    sectionsEl.appendChild(section);
  });
})();
