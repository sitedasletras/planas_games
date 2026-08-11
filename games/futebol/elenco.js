(() => {
  'use strict';
  const { POSITIONS, TRAITS, FEET, loadSquad } = window.WSPSquad;

  const squad = loadSquad();
  document.getElementById('club-name').textContent = squad.clubName + ' — Elenco';

  const FOOT_LABEL = {};
  FEET.forEach((f) => { FOOT_LABEL[f.key] = f.label; });

  const BUCKET_LABEL = { GK: 'Goleiros', DEF: 'Zaga', MID: 'Meio-campo', ATT: 'Ataque' };
  const BUCKET_ORDER = ['GK', 'DEF', 'MID', 'ATT'];

  const sectionsEl = document.getElementById('elenco-sections');

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

      const num = document.createElement('div');
      num.className = 'player-number';
      num.textContent = p.number;
      card.appendChild(num);

      const info = document.createElement('div');
      info.className = 'player-info';

      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = p.name;
      info.appendChild(name);

      const pos = document.createElement('div');
      pos.className = 'player-position';
      pos.textContent = POSITIONS[p.position].label;
      info.appendChild(pos);

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
      card.appendChild(info);
      section.appendChild(card);
    });

    sectionsEl.appendChild(section);
  });
})();
