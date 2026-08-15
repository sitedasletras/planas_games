(() => {
  'use strict';
  const { loadSquad, renameClub } = window.WSPF1Pilotos;
  const { loadClub, unlockPremium, saveCustomization, PREMIUM_COST, CREST_SHAPES, CREST_EMBLEMS, EXCLUSIVE_CREST_EMBLEMS, EXCLUSIVE_JERSEY_PRESETS } = window.WSPF1Equipe;

  const equipe = loadSquad();
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
        <li>Nome da equipe</li>
        <li>Cores da carroceria</li>
        <li>Emblema (forma + símbolo)</li>
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
    contentEl.appendChild(teamNameSection());
    contentEl.appendChild(colorsSection());
    contentEl.appendChild(crestSection());
  }

  function teamNameSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Nome da Equipe</h2>';

    const row = document.createElement('div');
    row.className = 'field-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = equipe.teamName;
    row.appendChild(input);
    const btn = document.createElement('button');
    btn.className = 'save-btn';
    btn.textContent = 'Salvar';
    btn.addEventListener('click', () => {
      renameClub(equipe, input.value);
      document.querySelectorAll('.club-name-live').forEach((el) => { el.textContent = equipe.teamName; });
    });
    row.appendChild(btn);
    section.appendChild(row);
    return section;
  }

  // mesmo desenho em pixel art usado no carro de verdade durante a corrida
  // (corrida.html) — aqui em miniatura, pra escolher a pintura vendo o
  // carrinho de F1 de cima já na cor, em vez de um swatch de cor abstrato
  const MINI_CAR_PIXELS = [
    ['.', 'w', 'w', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'w', 'w', '.', '.'],
    ['g', 'w', 'w', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'w', 'w', 'b', 'g'],
    ['g', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'g'],
    ['g', 'b', 'b', 'b', 'b', 'b', 'b', 'c', 'c', 'b', 'b', 'b', 'b', 'b', 'n', 'g'],
    ['g', 'b', 'b', 'b', 'b', 'b', 'b', 'c', 'c', 'b', 'b', 'b', 'b', 'b', 'n', 'g'],
    ['g', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'g'],
    ['g', 'w', 'w', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'w', 'w', 'b', 'g'],
    ['.', 'w', 'w', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'w', 'w', '.', '.'],
  ];

  function drawMiniCar(canvas, colors) {
    const ctx = canvas.getContext('2d');
    const rows = MINI_CAR_PIXELS.length, cols = MINI_CAR_PIXELS[0].length;
    const cell = canvas.width / cols;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(0, (canvas.height - rows * cell) / 2);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = MINI_CAR_PIXELS[row][col];
        if (px === '.') continue;
        ctx.fillStyle = px === 'w' ? '#141414'
          : px === 'c' ? 'rgba(8,8,8,0.9)'
          : px === 'g' ? colors.secondary
          : px === 'n' ? colors.accent
          : colors.primary;
        ctx.fillRect(col * cell, row * cell, cell + 0.4, cell + 0.4);
      }
    }
    ctx.restore();
  }

  function colorsSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Cores da Carroceria</h2>';

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
      const accentStripe = document.createElement('div');
      accentStripe.style.cssText = 'position:absolute; right:0; top:0; bottom:0; width:14px; background:' + club.colors.accent + ';';
      swatch.style.position = 'relative';
      swatch.appendChild(accentStripe);
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
      { key: 'accent', label: 'Cor de destaque (4ª cor)' },
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

    function applyPreset(preset) {
      saveCustomization(club, { colors: { primary: preset.primary, secondary: preset.secondary, detail: preset.detail, accent: preset.accent } });
      colorInputs.primary.value = preset.primary;
      colorInputs.secondary.value = preset.secondary;
      colorInputs.detail.value = preset.detail;
      colorInputs.accent.value = preset.accent;
      renderPreview();
    }

    const liveryTitle = document.createElement('div');
    liveryTitle.className = 'exclusive-emblem-title';
    liveryTitle.textContent = 'Pinturas de época — escolha uma e ajuste as cores acima se quiser';
    section.appendChild(liveryTitle);

    const liveryRow = document.createElement('div');
    liveryRow.className = 'jersey-preset-row';
    window.WSPF1Equipe.LIVERY_PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.className = 'jersey-preset-option car-preset-option';
      btn.title = preset.label;
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 26;
      btn.appendChild(canvas);
      const label = document.createElement('span');
      label.className = 'car-preset-label';
      label.textContent = preset.label;
      btn.appendChild(label);
      drawMiniCar(canvas, preset);
      btn.addEventListener('click', () => applyPreset(preset));
      liveryRow.appendChild(btn);
    });
    section.appendChild(liveryRow);

    if (club.exclusiveJerseyUnlocked) {
      const exclusiveTitle = document.createElement('div');
      exclusiveTitle.className = 'exclusive-emblem-title';
      exclusiveTitle.textContent = 'Pinturas exclusivas (Patrocinador Especial)';
      section.appendChild(exclusiveTitle);

      const presetRow = document.createElement('div');
      presetRow.className = 'jersey-preset-row';
      EXCLUSIVE_JERSEY_PRESETS.forEach((preset) => {
        const btn = document.createElement('button');
        btn.className = 'jersey-preset-option car-preset-option';
        btn.title = preset.label;
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 26;
        btn.appendChild(canvas);
        const label = document.createElement('span');
        label.className = 'car-preset-label';
        label.textContent = preset.label;
        btn.appendChild(label);
        drawMiniCar(canvas, preset);
        btn.addEventListener('click', () => applyPreset(preset));
        presetRow.appendChild(btn);
      });
      section.appendChild(presetRow);
    }

    return section;
  }

  function crestSection() {
    const section = document.createElement('div');
    section.className = 'custom-section';
    section.innerHTML = '<h2>Emblema</h2>';

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
    crestColorLabel.textContent = 'Cor do emblema';
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
    resetCrestColorBtn.textContent = 'Usar cor da carroceria';
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

  render();
})();
