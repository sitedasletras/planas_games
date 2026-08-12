(() => {
  'use strict';
  const { loadSquad, renameClub } = window.WSPSquad;
  const { loadClub, unlockPremium, saveCustomization, PREMIUM_COST, CREST_SHAPES, CREST_EMBLEMS } = window.WSPClub;

  const squad = loadSquad();
  const club = loadClub();
  const contentEl = document.getElementById('content');

  function formatMoney(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function render() {
    contentEl.innerHTML = '';
    if (!club.premiumUnlocked) renderLocked();
    else renderEditor();
  }

  function renderLocked() {
    const card = document.createElement('div');
    card.className = 'lock-card';
    card.innerHTML = `
      <div class="lock-icon">🔒</div>
      <h2>Personalização Premium</h2>
      <ul>
        <li>Nome do clube</li>
        <li>Cores do time e do uniforme</li>
        <li>Escudo (forma + emblema)</li>
        <li>Editar nome e número dos jogadores</li>
      </ul>
    `;
    const btn = document.createElement('button');
    btn.className = 'unlock-btn';
    btn.textContent = 'Desbloquear — ' + formatMoney(PREMIUM_COST);
    btn.disabled = club.budget < PREMIUM_COST;
    btn.addEventListener('click', () => {
      const result = unlockPremium(club);
      if (result.ok) render();
    });
    card.appendChild(btn);
    contentEl.appendChild(card);
  }

  function renderEditor() {
    contentEl.appendChild(clubNameSection());
    contentEl.appendChild(colorsSection());
    contentEl.appendChild(crestSection());
    contentEl.appendChild(playersSection());
  }

  function clubNameSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Nome do Clube</h2>';

    const row = document.createElement('div');
    row.className = 'field-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = squad.clubName;
    row.appendChild(input);
    const btn = document.createElement('button');
    btn.className = 'save-btn';
    btn.textContent = 'Salvar';
    btn.addEventListener('click', () => {
      renameClub(squad, input.value);
      document.querySelectorAll('.club-name-live').forEach((el) => { el.textContent = squad.clubName; });
    });
    row.appendChild(btn);
    section.appendChild(row);
    return section;
  }

  function colorsSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Cores do Time</h2>';

    const preview = document.createElement('div');
    preview.className = 'jersey-preview';
    section.appendChild(preview);

    function renderPreview() {
      preview.innerHTML = '';
      const swatch = document.createElement('div');
      swatch.className = 'jersey-swatch';
      swatch.style.background = club.colors.primary;
      const stripe = document.createElement('div');
      stripe.className = 'stripe';
      stripe.style.background = club.colors.secondary;
      swatch.appendChild(stripe);
      const border = document.createElement('div');
      border.style.cssText = 'width:60px;height:6px;background:' + club.colors.detail + ';border-radius:3px;margin-top:6px;';
      const wrap = document.createElement('div');
      wrap.appendChild(swatch);
      wrap.appendChild(border);
      preview.appendChild(wrap);
    }
    renderPreview();

    const fields = [
      { key: 'primary', label: 'Cor principal' },
      { key: 'secondary', label: 'Cor secundária' },
      { key: 'detail', label: 'Cor de detalhe' },
    ];
    fields.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'field-row';
      const label = document.createElement('label');
      label.textContent = f.label;
      row.appendChild(label);
      const input = document.createElement('input');
      input.type = 'color';
      input.value = club.colors[f.key];
      input.addEventListener('input', () => {
        const patch = {}; patch[f.key] = input.value;
        saveCustomization(club, { colors: patch });
        renderPreview();
      });
      row.appendChild(input);
      section.appendChild(row);
    });

    return section;
  }

  function crestSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Escudo</h2>';

    const previewWrap = document.createElement('div');
    previewWrap.className = 'crest-preview';
    section.appendChild(previewWrap);

    function renderPreview() {
      previewWrap.innerHTML = '';
      const shape = document.createElement('div');
      shape.className = 'crest-shape ' + club.crest.shape;
      shape.style.background = club.colors.primary;
      shape.style.setProperty('--detail', club.colors.detail);
      const span = document.createElement('span');
      span.textContent = club.crest.emblem;
      shape.appendChild(span);
      previewWrap.appendChild(shape);
    }
    renderPreview();

    const shapeRow = document.createElement('div');
    shapeRow.className = 'shape-row';
    CREST_SHAPES.forEach((shape) => {
      const btn = document.createElement('button');
      btn.className = 'shape-option' + (club.crest.shape === shape ? ' active' : '');
      btn.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
      btn.addEventListener('click', () => {
        saveCustomization(club, { crest: { shape } });
        shapeRow.querySelectorAll('.shape-option').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderPreview();
      });
      shapeRow.appendChild(btn);
    });
    section.appendChild(shapeRow);

    const grid = document.createElement('div');
    grid.className = 'emblem-grid';
    CREST_EMBLEMS.forEach((emblem) => {
      const btn = document.createElement('button');
      btn.className = 'emblem-option' + (club.crest.emblem === emblem ? ' active' : '');
      btn.textContent = emblem;
      btn.addEventListener('click', () => {
        saveCustomization(club, { crest: { emblem } });
        grid.querySelectorAll('.emblem-option').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderPreview();
      });
      grid.appendChild(btn);
    });
    section.appendChild(grid);

    return section;
  }

  function playersSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Editar Jogadores</h2>';

    squad.players
      .slice()
      .sort((a, b) => a.number - b.number)
      .forEach((p) => {
        const row = document.createElement('div');
        row.className = 'field-row';

        const label = document.createElement('label');
        label.textContent = '#' + p.number;
        label.style.flex = '0 0 32px';
        row.appendChild(label);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = p.name;
        row.appendChild(nameInput);

        const numInput = document.createElement('input');
        numInput.type = 'text';
        numInput.value = p.number;
        numInput.style.flex = '0 0 44px';
        row.appendChild(numInput);

        const btn = document.createElement('button');
        btn.className = 'save-btn';
        btn.textContent = 'Salvar';
        btn.addEventListener('click', () => {
          window.WSPSquad.renamePlayer(squad, p.id, nameInput.value);
          const result = window.WSPSquad.renumberPlayer(squad, p.id, numInput.value);
          if (!result.ok && result.reason === 'taken') {
            alert('Já existe um jogador com esse número.');
            numInput.value = p.number;
          } else if (result.ok) {
            label.textContent = '#' + p.number;
          }
        });
        row.appendChild(btn);

        section.appendChild(row);
      });

    return section;
  }

  render();
})();
