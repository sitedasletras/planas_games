(() => {
  'use strict';
  const { loadSquad, renameClub, POSITIONS } = window.WSPSquad;
  const { loadClub, unlockPremium, saveCustomization, PREMIUM_COST, CREST_SHAPES, CREST_EMBLEMS, EXCLUSIVE_CREST_EMBLEMS, EXCLUSIVE_JERSEY_PRESETS } = window.WSPClub;

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
    const colorInputs = {};
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
      colorInputs[f.key] = input;
      row.appendChild(input);
      section.appendChild(row);
    });

    if (club.exclusiveJerseyUnlocked) {
      const exclusiveTitle = document.createElement('div');
      exclusiveTitle.className = 'exclusive-emblem-title';
      exclusiveTitle.textContent = 'Uniformes exclusivos (Patrocinador Especial)';
      section.appendChild(exclusiveTitle);

      const presetRow = document.createElement('div');
      presetRow.className = 'jersey-preset-row';
      EXCLUSIVE_JERSEY_PRESETS.forEach((preset) => {
        const btn = document.createElement('button');
        btn.className = 'jersey-preset-option';
        btn.title = preset.label;
        btn.style.background = preset.primary;
        btn.style.borderColor = preset.secondary;
        const dot = document.createElement('span');
        dot.style.cssText = 'display:block;width:10px;height:10px;border-radius:50%;background:' + preset.detail + ';margin:0 auto;';
        btn.appendChild(dot);
        btn.addEventListener('click', () => {
          saveCustomization(club, { colors: { primary: preset.primary, secondary: preset.secondary, detail: preset.detail } });
          colorInputs.primary.value = preset.primary;
          colorInputs.secondary.value = preset.secondary;
          colorInputs.detail.value = preset.detail;
          renderPreview();
        });
        presetRow.appendChild(btn);
      });
      section.appendChild(presetRow);
    }

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
      shape.style.background = club.crest.color || club.colors.primary;
      shape.style.setProperty('--detail', club.colors.detail);
      const span = document.createElement('span');
      span.textContent = club.crest.emblem;
      shape.appendChild(span);
      previewWrap.appendChild(shape);
    }
    renderPreview();

    const crestColorRow = document.createElement('div');
    crestColorRow.className = 'field-row';
    const crestColorLabel = document.createElement('label');
    crestColorLabel.textContent = 'Cor do escudo';
    crestColorRow.appendChild(crestColorLabel);
    const crestColorInput = document.createElement('input');
    crestColorInput.type = 'color';
    crestColorInput.value = club.crest.color || club.colors.primary;
    crestColorInput.addEventListener('input', () => {
      saveCustomization(club, { crest: { color: crestColorInput.value } });
      renderPreview();
    });
    crestColorRow.appendChild(crestColorInput);
    const resetCrestColorBtn = document.createElement('button');
    resetCrestColorBtn.className = 'save-btn';
    resetCrestColorBtn.textContent = 'Usar cor do uniforme';
    resetCrestColorBtn.addEventListener('click', () => {
      saveCustomization(club, { crest: { color: null } });
      crestColorInput.value = club.colors.primary;
      renderPreview();
    });
    crestColorRow.appendChild(resetCrestColorBtn);
    section.appendChild(crestColorRow);

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

    if (club.exclusiveEmblemUnlocked) {
      const exclusiveTitle = document.createElement('div');
      exclusiveTitle.className = 'exclusive-emblem-title';
      exclusiveTitle.textContent = 'Emblemas exclusivos (Patrocinador Especial)';
      section.appendChild(exclusiveTitle);

      const exclusiveGrid = document.createElement('div');
      exclusiveGrid.className = 'emblem-grid';
      EXCLUSIVE_CREST_EMBLEMS.forEach((emblem) => {
        const btn = document.createElement('button');
        btn.className = 'emblem-option exclusive' + (club.crest.emblem === emblem ? ' active' : '');
        btn.textContent = emblem;
        btn.addEventListener('click', () => {
          saveCustomization(club, { crest: { emblem } });
          exclusiveGrid.querySelectorAll('.emblem-option').forEach((b) => b.classList.remove('active'));
          grid.querySelectorAll('.emblem-option').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          renderPreview();
        });
        exclusiveGrid.appendChild(btn);
      });
      section.appendChild(exclusiveGrid);
    }

    return section;
  }

  function playersSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Editar Jogadores</h2>';

    const BUCKET_LABEL = { GK: 'Goleiros', DEF: 'Zaga', MID: 'Meio-campo', ATT: 'Ataque' };
    const BUCKET_ORDER = ['GK', 'DEF', 'MID', 'ATT'];

    BUCKET_ORDER.forEach((bucket) => {
      // ordem estável por nome — se ordenasse pelo número, o jogador "pularia"
      // de posição na lista assim que você trocasse o número dele, e ficava
      // fácil perder o fio de qual linha é qual jogador
      const players = squad.players
        .filter((p) => p.bucket === bucket)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      if (!players.length) return;

      const bucketTitle = document.createElement('div');
      bucketTitle.className = 'exclusive-emblem-title';
      bucketTitle.textContent = BUCKET_LABEL[bucket];
      section.appendChild(bucketTitle);

      players.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'field-row player-edit-row';

        const nameCol = document.createElement('div');
        nameCol.style.flex = '1';
        nameCol.style.minWidth = '0';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = p.name;
        nameCol.appendChild(nameInput);

        const posLabel = document.createElement('div');
        posLabel.className = 'player-edit-position';
        posLabel.textContent = POSITIONS[p.position].label;
        nameCol.appendChild(posLabel);

        row.appendChild(nameCol);

        const numInput = document.createElement('input');
        numInput.type = 'text';
        numInput.value = p.number;
        numInput.placeholder = 'Nº';
        numInput.title = 'Número da camisa';
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
            return;
          }
          numInput.value = p.number;
          btn.textContent = 'Salvo!';
          setTimeout(() => { btn.textContent = 'Salvar'; }, 1200);
        });
        row.appendChild(btn);

        section.appendChild(row);
      });
    });

    return section;
  }

  render();
})();
