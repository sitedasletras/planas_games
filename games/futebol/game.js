(() => {
  'use strict';

  // ---------- Config ----------
  const FIELD_W = 400, FIELD_H = 711;
  const GOAL_W = 120;
  const GOAL_L = (FIELD_W - GOAL_W) / 2, GOAL_R = GOAL_L + GOAL_W;
  const GOAL_NET_DEPTH = 24; // profundidade visual do "caixote" da rede, desenhado pra dentro do campo
  const WALL_MIN = 14, WALL_MAX = FIELD_W - 14;
  const PLAYER_R = 13, BALL_R = 7;
  const CLAMP_Y_MIN = 16, CLAMP_Y_MAX = FIELD_H - 16;
  const CLAMP_X_MIN = 16, CLAMP_X_MAX = FIELD_W - 16;

  const TEAMMATE_SPEED = 98;   // px/sec, AI support
  const CHASER_SPEED = 108;    // px/sec, AI chasing ball
  const DRIBBLE_SPEED = 92;    // px/sec, quem está com a bola avançando
  const GK_SPEED = 82;
  const DRIBBLE_PRESSURE_R = 70; // raio em que o marcador mais próximo influencia o drible

  const PICKUP_R = PLAYER_R + BALL_R + 2;
  const SHOOT_POWER = 260, PASS_POWER = 190, CLEAR_POWER = 230;
  const KICK_COOLDOWN_MS = 300;
  const AI_DECISION_MIN_MS = 650, AI_DECISION_MAX_MS = 1300;

  // ---------- Clock ----------
  // Each half shows 46 game-minutes on the scoreboard, compressed into
  // HALF_REAL_SECONDS of actual wall-clock play.
  const HALF_REAL_SECONDS = 170; // 2:50 — mais devagar, dá tempo de acompanhar faltas/barreiras
  const HALF_DISPLAY_MINUTES = 46;
  const HALF_DISPLAY_SECONDS = HALF_DISPLAY_MINUTES * 60;
  const CLOCK_SCALE = HALF_DISPLAY_SECONDS / HALF_REAL_SECONDS; // game-seconds per real-second
  const TECH_TIMEOUT_MINUTE = 23;
  const TECH_TIMEOUT_REAL_SECONDS = 10;
  const HALFTIME_REAL_SECONDS = 15;

  // ---------- Fouls / cards / offside ----------
  const FOUL_CHANCE = 0.006;       // per-frame chance a tackle attempt is a foul
  const STEAL_CHANCE = 0.06;       // per-frame chance of a clean steal (unchanged)
  const HARD_FOUL_SHARE = 0.2;     // fraction of fouls that come in hard
  const YELLOW_CHANCE_NORMAL = 0.08;
  const YELLOW_CHANCE_HARD = 0.25;
  const RED_CHANCE_HARD = 0.03;
  const STAGGER_MS = 900;          // hard foul knocks the fouled player down briefly
  const CLOSE_FK_RANGE = 150, LONG_FK_RANGE = 320;
  const WALL_MIN_DIST = 55; // minimum distance defenders are pushed back on a free kick
  const MAX_SUBS = 5;
  const STOPPAGE_MS = 1100;
  const WALL_STOPPAGE_BONUS_MS = 1400; // tempo extra pra dar pra ver a barreira se formando
  const CONFUSION_CHANCE = 0.18;   // chance de virar confusão após falta dura com cartão
  const CONFUSION_BONUS_MS = 1300; // tempo extra de pausa pra mostrar a confusão
  const SIDE_STOPPAGE_MS = 700;
  const PENALTY_VAR_CONFIRM_CHANCE = 0.75;
  const PENALTY_GOAL_CHANCE = 0.76;
  const PENALTY_STOPPAGE_MS = 1800;
  const VAR_REVIEW_MS = 1900;
  const GREAT_SAVE_CHANCE = 0.18; // nem toda defesa vira "lance de perigo" com pausa — só as mais vistosas
  const GREAT_SAVE_STOPPAGE_MS = 1600;

  // ---------- Fadiga / lesão ----------
  const FATIGUE_RATE_PER_SEC = 0.0032;
  const FATIGUE_SPEED_PENALTY = 0.3;
  const FATIGUE_NARRATE_THRESHOLD = 0.75;
  const FATIGUE_HALFTIME_RECOVERY = 0.18;
  const INJURY_CHANCE_HARD_FOUL = 0.12;

  // lesão que passa a valer além da partida atual (desfalca o time nos próximos
  // jogos, até o Médico do departamento reduzir o tempo de recuperação)
  const INJURY_SEVERITIES = [
    { key: 'leve', label: 'lesão leve', days: 1, weight: 60 },
    { key: 'moderada', label: 'lesão moderada', days: 3, weight: 30 },
    { key: 'grave', label: 'lesão grave', days: 7, weight: 10 },
  ];
  function pickInjurySeverity() {
    const total = INJURY_SEVERITIES.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const s of INJURY_SEVERITIES) {
      if (r < s.weight) return s;
      r -= s.weight;
    }
    return INJURY_SEVERITIES[0];
  }

  // ---------- Qualidade do jogador (rating 35-99) ----------
  const RATING_SPEED_BASE = 0.85;
  const RATING_SPEED_SPAN = 0.3; // multiplicador de velocidade vai de 0.85 (rating baixo) a 1.15 (rating alto)
  function ratingSpeedMult(rating) {
    return RATING_SPEED_BASE + ((rating || 60) / 100) * RATING_SPEED_SPAN;
  }

  // condicionamento físico do elenco (persistente entre partidas) — jogador
  // desgastado começa a partida já um pouco mais devagar, indo de 0.85x (20%,
  // o piso do desgaste) a 1x (100%, totalmente recuperado)
  const CONDITION_SPEED_SPAN = 0.15;
  function conditionSpeedMult(condition) {
    const c = condition == null ? 100 : condition;
    return 1 - (1 - c / 100) * CONDITION_SPEED_SPAN;
  }

  // conjunto genérico — só usado como último recurso quando o time reserva
  // não tem elenco carregado (sem posição de verdade pra cada jogador)
  const INSTRUCTIONS = [
    { key: 'zona', label: 'Zona' },
    { key: 'individual', label: 'Individual' },
    { key: 'ataque', label: 'Atk+' },
    { key: 'defesa', label: 'Def+' },
  ];

  // instruções específicas por posição — cada opção tem um efeito real no
  // motor de movimento/decisão (ver updatePlayer, pickPassTarget,
  // attemptShoot e o roubo de bola em updateBall)
  const INSTRUCTION_SETS = {
    zagueiro: [
      { key: 'zona', label: 'Marc. Zona' },
      { key: 'individual', label: 'Individual' },
      { key: 'sobra', label: 'Sobra' },
      { key: 'marcar_frente', label: 'Marcar à Frente' },
    ],
    lateral: [
      { key: 'zona', label: 'Padrão' },
      { key: 'apoiador', label: 'Apoiador' },
      { key: 'defensivo', label: 'Defensivo' },
      { key: 'por_dentro', label: 'Por Dentro' },
      { key: 'aberto', label: 'Aberto' },
    ],
    volante: [
      { key: 'mais_marcacao', label: 'Marcação' },
      { key: 'saida_rapida', label: 'Saída Rápida' },
      { key: 'classico', label: 'Clássico' },
      { key: 'racudo', label: 'Raçudo' },
    ],
    meia: [
      { key: 'dez_classico', label: '10 Clássico' },
      { key: 'fazedor_tabela', label: 'Tabela' },
      { key: 'lancamento_preciso', label: 'Lançamento' },
      { key: 'zona', label: 'Padrão' },
    ],
    ponta: [
      { key: 'facao', label: 'Facão' },
      { key: 'aberto', label: 'Aberto' },
      { key: 'forca', label: 'Força' },
      { key: 'habilidade', label: 'Habilidade' },
    ],
    atacante: [
      { key: 'driblador', label: '1x1' },
      { key: 'cabeceio', label: 'Cabeceio' },
      { key: 'fazedor_tabela', label: 'Tabela' },
      { key: 'finalizador', label: 'Finalizador' },
      { key: 'chute_forte', label: 'Chute Forte' },
    ],
  };

  // mapeia a posição do elenco (squad.js) pro conjunto de instruções certo
  const POSITION_INSTRUCTION_GROUP = {
    zagueiro: 'zagueiro', beque_central: 'zagueiro', quarto_zagueiro: 'zagueiro',
    libero_adiantado: 'zagueiro', libero_retaguarda: 'zagueiro', lateral_zagueiro: 'zagueiro',
    lateral: 'lateral', lateral_ala: 'lateral',
    volante: 'volante', segundo_volante: 'volante', meia_defensivo: 'volante',
    meia_ofensivo: 'meia', motorzinho: 'meia',
    atacante_pontas: 'ponta',
    segundo_atacante: 'atacante', centro_avante: 'atacante',
  };

  function instructionSetFor(p) {
    const group = p.position && POSITION_INSTRUCTION_GROUP[p.position];
    return (group && INSTRUCTION_SETS[group]) || INSTRUCTIONS;
  }

  // pra não misturar zagueiro/lateral/volante/etc numa ordem qualquer nas
  // listas de instrução e substituição — o slot tático não segue a posição
  // real do jogador (o usuário pode escalar qualquer um em qualquer slot),
  // então listar "por ordem de escalação" ficava embaralhado e confuso
  const POSITION_GROUP_ORDER = ['goleiro', 'zagueiro', 'lateral', 'volante', 'meia', 'ponta', 'atacante'];
  const POSITION_GROUP_ABBR = { goleiro: 'GOL', zagueiro: 'ZAG', lateral: 'LAT', volante: 'VOL', meia: 'MEI', ponta: 'PON', atacante: 'ATA' };
  function positionGroupFor(p) {
    if (p.role === 'GK') return 'goleiro';
    return (p.position && POSITION_INSTRUCTION_GROUP[p.position]) || null;
  }
  function sortByPositionGroup(list) {
    return list.slice().sort((a, b) => {
      const ia = POSITION_GROUP_ORDER.indexOf(positionGroupFor(a));
      const ib = POSITION_GROUP_ORDER.indexOf(positionGroupFor(b));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }

  // ---------- Tactics ----------
  // d = distance from own goal line (0 = own goal, FIELD_H = opponent's goal)
  // x = lateral position (0-400). Every tactic has exactly 10 outfield slots.
  const TACTICS = {
    ferrolho: {
      label: 'Ferrolho (6-3-1)',
      drift: 0.15,
      formation: [6, 3, 1],
      slots: [
        { d: 110, x: 40 }, { d: 110, x: 110 }, { d: 110, x: 180 }, { d: 110, x: 220 }, { d: 110, x: 290 }, { d: 110, x: 360 },
        { d: 260, x: 110 }, { d: 260, x: 200 }, { d: 260, x: 290 },
        { d: 460, x: 200 },
      ],
    },
    cincoTresDois: {
      label: '5-3-2',
      drift: 0.25,
      formation: [5, 3, 2],
      slots: [
        { d: 150, x: 40 }, { d: 150, x: 120 }, { d: 150, x: 200 }, { d: 150, x: 280 }, { d: 150, x: 360 },
        { d: 330, x: 90 }, { d: 330, x: 200 }, { d: 330, x: 310 },
        { d: 520, x: 110 }, { d: 520, x: 290 },
      ],
    },
    quatroTresTres: {
      label: '4-3-3',
      drift: 0.3,
      formation: [4, 3, 3],
      slots: [
        { d: 150, x: 70 }, { d: 150, x: 150 }, { d: 150, x: 250 }, { d: 150, x: 330 },
        { d: 340, x: 110 }, { d: 340, x: 200 }, { d: 340, x: 290 },
        { d: 530, x: 90 }, { d: 530, x: 200 }, { d: 530, x: 310 },
      ],
    },
    tresCincoDois: {
      label: '3-5-2',
      drift: 0.35,
      formation: [3, 5, 2],
      slots: [
        { d: 160, x: 110 }, { d: 160, x: 200 }, { d: 160, x: 290 },
        { d: 330, x: 40 }, { d: 330, x: 120 }, { d: 330, x: 200 }, { d: 330, x: 280 }, { d: 330, x: 360 },
        { d: 520, x: 110 }, { d: 520, x: 290 },
      ],
    },
    abafa: {
      label: 'Abafa (3-3-4)',
      drift: 0.45,
      formation: [3, 3, 4],
      slots: [
        { d: 170, x: 110 }, { d: 170, x: 200 }, { d: 170, x: 290 },
        { d: 320, x: 90 }, { d: 320, x: 200 }, { d: 320, x: 310 },
        { d: 500, x: 40 }, { d: 500, x: 360 }, { d: 540, x: 150 }, { d: 540, x: 250 },
      ],
    },
    quatroDoisQuatro: {
      label: '4-2-4',
      drift: 0.4,
      formation: [4, 2, 4],
      slots: [
        { d: 150, x: 50 }, { d: 150, x: 150 }, { d: 150, x: 250 }, { d: 150, x: 350 },
        { d: 290, x: 140 }, { d: 290, x: 260 },
        { d: 520, x: 40 }, { d: 520, x: 147 }, { d: 520, x: 253 }, { d: 520, x: 360 },
      ],
    },
    tresQuatroTres: {
      label: '3-4-3',
      drift: 0.35,
      formation: [3, 4, 3],
      slots: [
        { d: 160, x: 110 }, { d: 160, x: 200 }, { d: 160, x: 290 },
        { d: 330, x: 60 }, { d: 330, x: 153 }, { d: 330, x: 247 }, { d: 330, x: 340 },
        { d: 520, x: 90 }, { d: 520, x: 200 }, { d: 520, x: 310 },
      ],
    },
    quatroUmQuatroUm: {
      label: '4-1-4-1',
      drift: 0.25,
      formation: [4, 5, 1],
      slots: [
        { d: 140, x: 50 }, { d: 140, x: 150 }, { d: 140, x: 250 }, { d: 140, x: 350 },
        { d: 250, x: 200 },
        { d: 360, x: 60 }, { d: 360, x: 153 }, { d: 360, x: 247 }, { d: 360, x: 340 },
        { d: 530, x: 200 },
      ],
    },
    losango: {
      label: '4-1-2-1-2 (Losango)',
      drift: 0.3,
      formation: [4, 4, 2],
      slots: [
        { d: 140, x: 50 }, { d: 140, x: 150 }, { d: 140, x: 250 }, { d: 140, x: 350 },
        { d: 240, x: 200 },
        { d: 320, x: 140 }, { d: 320, x: 260 },
        { d: 410, x: 200 },
        { d: 520, x: 110 }, { d: 520, x: 290 },
      ],
    },
    quadrado: {
      label: '4-2-2-2 (Quadrado)',
      drift: 0.35,
      formation: [4, 4, 2],
      slots: [
        { d: 140, x: 50 }, { d: 140, x: 150 }, { d: 140, x: 250 }, { d: 140, x: 350 },
        { d: 260, x: 140 }, { d: 260, x: 260 },
        { d: 400, x: 110 }, { d: 400, x: 290 },
        { d: 530, x: 150 }, { d: 530, x: 250 },
      ],
    },
  };

  function tacticBuckets(tacticKey) {
    const [nDef, nMid, nAtt] = TACTICS[tacticKey].formation;
    const buckets = [];
    for (let i = 0; i < nDef; i++) buckets.push('DEF');
    for (let i = 0; i < nMid; i++) buckets.push('MID');
    for (let i = 0; i < nAtt; i++) buckets.push('ATT');
    return buckets;
  }
  const TACTIC_KEYS = Object.keys(TACTICS);

  // gera o layout de campo (linhas espaçadas por igual) pra qualquer combinação
  // livre de defesa/meio/ataque que não bata com nenhuma tática pronta acima
  function generateFormationSlots(nDef, nMid, nAtt) {
    const DEPTH = { def: 150, mid: 330, att: 520 };
    function rowXs(n) {
      if (n <= 0) return [];
      if (n === 1) return [200];
      const margin = 40;
      const span = 400 - margin * 2;
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(margin + (span * i) / (n - 1));
      return xs;
    }
    const slots = [];
    rowXs(nDef).forEach((x) => slots.push({ d: DEPTH.def, x }));
    rowXs(nMid).forEach((x) => slots.push({ d: DEPTH.mid, x }));
    rowXs(nAtt).forEach((x) => slots.push({ d: DEPTH.att, x }));
    return slots;
  }

  // devolve a chave de uma tática (pronta ou recém-gerada) cujo formation seja
  // exatamente [nDef, nMid, nAtt] — usado pra escalação livre montada pelo usuário
  function ensureTacticForFormation(nDef, nMid, nAtt) {
    for (const key of TACTIC_KEYS) {
      const f = TACTICS[key].formation;
      if (f && f[0] === nDef && f[1] === nMid && f[2] === nAtt) return key;
    }
    const key = 'custom_' + nDef + '_' + nMid + '_' + nAtt;
    if (!TACTICS[key]) {
      TACTICS[key] = {
        label: nDef + '-' + nMid + '-' + nAtt,
        drift: Math.max(0.15, Math.min(0.5, 0.15 + nAtt * 0.07)),
        formation: [nDef, nMid, nAtt],
        slots: generateFormationSlots(nDef, nMid, nAtt),
        generated: true,
      };
      TACTIC_KEYS.push(key);
    }
    return key;
  }

  // ---------- Escalação salva pelo usuário (games/futebol/escalacao.html) ----------
  const LINEUP_STORAGE_KEY = 'wsp_lineup_v1';
  function loadUserLineup() {
    try {
      const raw = JSON.parse(localStorage.getItem(LINEUP_STORAGE_KEY) || 'null');
      return (raw && Array.isArray(raw.formation) && raw.formation.length === 3 && raw.gkId && raw.lines) ? raw : null;
    } catch (e) {
      return null;
    }
  }
  function selectStartersFromLineup(squad, lineup) {
    const isInjured = window.WSPSquad ? window.WSPSquad.isInjured : () => false;
    const available = squad.players.filter((p) => !isInjured(p));
    const byId = {};
    available.forEach((p) => { byId[p.id] = p; });
    const usedIdsSet = new Set();
    let anyReplaced = false;
    const pickReplacement = () => available.find((p) => !usedIdsSet.has(p.id)) || null;

    let gk = byId[lineup.gkId];
    if (!gk) { gk = pickReplacement(); anyReplaced = true; }
    if (!gk) return null; // elenco inteiro indisponível (todo mundo machucado/vendido)
    usedIdsSet.add(gk.id);

    const orderedIds = [].concat(lineup.lines.def || [], lineup.lines.mid || [], lineup.lines.att || []);
    if (orderedIds.length !== 10) return null;
    const outfield = [];
    for (const id of orderedIds) {
      let p = byId[id];
      if (!p || usedIdsSet.has(id)) { p = pickReplacement(); anyReplaced = true; }
      if (!p) return null; // não sobrou ninguém disponível pra completar o time
      usedIdsSet.add(p.id);
      outfield.push({ player: p, improvised: false });
    }
    const bench = available.filter((p) => !usedIdsSet.has(p.id));
    if (anyReplaced) {
      narrate('Escalação ajustada: um ou mais titulares escolhidos estavam machucados ou indisponíveis e foram substituídos por reservas.');
    }
    return { gk, outfield, bench };
  }

  // ---------- Season integration ----------
  const seasonMode = new URLSearchParams(window.location.search).get('season') === '1';
  let seasonOpponent = null; // { name, strength } quando a partida vem da temporada
  if (seasonMode) {
    try {
      const pending = JSON.parse(localStorage.getItem('wsp_season_pending') || 'null');
      if (pending && pending.opponentName) seasonOpponent = { name: pending.opponentName, strength: pending.opponentStrength };
    } catch (e) { /* ignore corrupt storage */ }
  }

  // ---------- DOM ----------
  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d');
  const scoreHomeEl = document.getElementById('score-home');
  const scoreAwayEl = document.getElementById('score-away');
  const timerEl = document.getElementById('timer');
  const halfLabelEl = document.getElementById('half-label');
  const btnPause = document.getElementById('btn-pause');
  const btnSpeed = document.getElementById('btn-speed');
  const btnTactics = document.getElementById('btn-tactics');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const overlayRestart = document.getElementById('overlay-restart');
  const reportBtnEl = document.getElementById('report-btn');
  const replayWrapEl = document.getElementById('replay-wrap');
  const replayCanvas = document.getElementById('replay-canvas');
  const replayCtx = replayCanvas ? replayCanvas.getContext('2d') : null;
  const pressOverlay = document.getElementById('press-overlay');
  const pressQuestionEl = document.getElementById('press-question');
  const pressAnswersEl = document.getElementById('press-answers');
  const pressReactionEl = document.getElementById('press-reaction');
  const pressContinueBtn = document.getElementById('press-continue-btn');
  const breakActionsEl = document.getElementById('break-actions');
  const breakTacticsBtn = document.getElementById('break-tactics-btn');
  const breakInstructionsBtn = document.getElementById('break-instructions-btn');
  const breakSubsBtn = document.getElementById('break-subs-btn');
  const ratingsSectionEl = document.getElementById('ratings-section');
  const ratingsTeamEl = document.getElementById('ratings-team');
  const ratingsListEl = document.getElementById('ratings-list');
  const tacticsOverlay = document.getElementById('tactics-overlay');
  const tacticsList = document.getElementById('tactics-list');
  const tacticsClose = document.getElementById('tactics-close');
  const btnInstructions = document.getElementById('btn-instructions');
  const instructionsOverlay = document.getElementById('instructions-overlay');
  const instructionsList = document.getElementById('instructions-list');
  const instructionsClose = document.getElementById('instructions-close');
  const btnSubs = document.getElementById('btn-subs');
  const subsOverlay = document.getElementById('subs-overlay');
  const subsOnfieldEl = document.getElementById('subs-onfield');
  const subsBenchEl = document.getElementById('subs-bench');
  const subsCounterEl = document.getElementById('subs-counter');
  const subsHintEl = document.getElementById('subs-hint');
  const subsClose = document.getElementById('subs-close');
  const narrationOverlay = document.getElementById('narration-overlay');
  const narrationList = document.getElementById('narration-list');
  const narrationClose = document.getElementById('narration-close');
  const sponsorStripEl = document.getElementById('sponsor-strip');
  const crowdStripEl = document.getElementById('crowd-strip');
  const tickerEl = document.getElementById('ticker');
  const sideInstructionsListEl = document.getElementById('side-instructions-list');
  const duelPopupEl = document.getElementById('duel-popup');
  const duelPlayerAEl = document.getElementById('duel-player-a');
  const duelNameAEl = document.getElementById('duel-name-a');
  const duelRatingAEl = document.getElementById('duel-rating-a');
  const duelPlayerBEl = document.getElementById('duel-player-b');
  const duelNameBEl = document.getElementById('duel-name-b');
  const duelRatingBEl = document.getElementById('duel-rating-b');
  const duelResultEl = document.getElementById('duel-result');
  const pressureFillHomeEl = document.getElementById('pressure-fill-home');
  const pressureFillAwayEl = document.getElementById('pressure-fill-away');
  const pressureLabelHomeEl = document.getElementById('pressure-label-home');
  const pressureLabelAwayEl = document.getElementById('pressure-label-away');

  // ---------- State ----------
  let players = [];
  let ball;
  let score = { home: 0, away: 0 };
  let paused = false;
  let speedMultiplier = 1;
  let matchOver = false;
  let stopPause = 0; // ms remaining while play is stopped (goal/falta/cartão/impedimento)
  let lastFrame = null;
  let homeTactic = 'quatroTresTres';
  let awayTactic = 'quatroTresTres';
  let sidePanelRefreshMs = 0;
  let pressureRefreshMs = 0;
  let possessionHomeMs = 0;
  let possessionAwayMs = 0;

  // clock state
  let half = 1;
  let displaySeconds = 0; // elapsed game-seconds within the current half (0..HALF_DISPLAY_SECONDS)
  let techTimeoutDone = false;
  let breakKind = null; // null | 'tech' | 'halftime'
  let breakTimer = 0; // ms remaining in the current break

  // substitutions
  let homeBench = [];
  let awayBench = [];
  let homeSubsUsed = 0;
  let awaySubsUsed = 0;
  let awaySubMinutes = [12 + Math.random() * 10, 24 + Math.random() * 8, 34 + Math.random() * 8];
  let awaySubWindowIdx = 0;
  let awayPostureAppliedMinute = -1;
  let matchHadConfusion = false; // pra entrevista pós-jogo perguntar sobre o climão
  let lastShotOrigin = 'jogo'; // 'jogo' | 'falta' | 'penalti' — pra escolher a cena certa no replay do gol

  // narração
  let narrationLog = [];
  let lastShooter = null;
  let lastAssistCandidate = null;
  let goalZoomActive = false;
  let goalZoomX = 200, goalZoomY = FIELD_H / 2;
  const GOAL_ZOOM_DURATION = 1400; // igual ao stopPause definido em onGoal()
  const GOAL_ZOOM_SCALE = 1.7;

  function currentGoalZoomScale() {
    if (!goalZoomActive) return 1;
    const elapsed = GOAL_ZOOM_DURATION - stopPause;
    if (elapsed < 200) return 1 + (GOAL_ZOOM_SCALE - 1) * Math.max(0, elapsed) / 200;
    if (elapsed < 1000) return GOAL_ZOOM_SCALE;
    if (elapsed < GOAL_ZOOM_DURATION) return GOAL_ZOOM_SCALE - (GOAL_ZOOM_SCALE - 1) * (elapsed - 1000) / (GOAL_ZOOM_DURATION - 1000);
    return 1;
  }
  let pendingPenalty = null; // { team, taker, takerName } enquanto uma cobrança de pênalti está em andamento
  let pendingVarReview = null; // { defender, attackerWithBall, spot } enquanto o VAR está revendo o lance
  let pendingKickoffReset = false; // adia o reposicionamento pro kickoff até o fim da comemoração do gol
  let matchParticipants = []; // todo jogador que entrou em campo na partida, pra nota pós-jogo
  let matchInjuriesThisGame = []; // { name, label } — lesões persistentes sofridas nesta partida, pra coletiva

  let duelCooldownMs = 0;
  let duelVisibleMs = 0;
  const DUEL_COOLDOWN_MS = 6000;
  let greatSaveCooldownMs = 0;
  const GREAT_SAVE_COOLDOWN_MS = 25000; // evita DEFESAÇO em sequência
  const DUEL_VISIBLE_MS = 1600;

  function showDuel(winner, loser) {
    duelNameAEl.textContent = displayName(winner);
    duelRatingAEl.textContent = 'NOTA ' + (winner.rating || 60);
    duelPlayerAEl.classList.add('win');
    duelNameBEl.textContent = displayName(loser);
    duelRatingBEl.textContent = 'NOTA ' + (loser.rating || 60);
    duelPlayerBEl.classList.remove('win');
    duelResultEl.textContent = displayName(winner) + ' rouba a bola de ' + displayName(loser) + '!';
    duelPopupEl.classList.remove('hidden');
    duelVisibleMs = DUEL_VISIBLE_MS;
    duelCooldownMs = DUEL_COOLDOWN_MS;
  }

  const homeSquad = window.WSPSquad ? window.WSPSquad.loadSquad() : null;
  const homeClub = window.WSPClub ? window.WSPClub.loadClub() : null;

  if (homeSquad && window.WSPSquad) {
    const fisicaLevel = (homeClub && homeClub.departments)
      ? ['preparador_fisico', 'musculacao', 'hidromassagem'].reduce((s, k) => s + (homeClub.departments[k] || 0), 0) / 3
      : 0;
    if (window.WSPSquad.applyConditionRecovery(homeSquad, fisicaLevel)) window.WSPSquad.saveSquad(homeSquad);
  }

  // se o usuário montou uma escalação em escalacao.html, ela decide quem começa
  // jogando e em que esquema — senão cai no sorteio automático de sempre
  let homeLineup = null;
  let homeLineupTacticKey = null;
  if (homeSquad) {
    const raw = loadUserLineup();
    if (raw) {
      const [nDef, nMid, nAtt] = raw.formation;
      const total = (raw.lines.def || []).length + (raw.lines.mid || []).length + (raw.lines.att || []).length;
      if (nDef + nMid + nAtt === 10 && total === 10) {
        const candidate = selectStartersFromLineup(homeSquad, raw);
        if (candidate) {
          homeLineup = raw;
          homeLineupTacticKey = ensureTacticForFormation(nDef, nMid, nAtt);
          homeTactic = homeLineupTacticKey;
        }
      }
    }
  }

  const BUCKET_ABBR = { GK: 'GOL', DEF: 'ZAG', MID: 'MEI', ATT: 'ATA' };
  const squadById = {};
  if (homeSquad) homeSquad.players.forEach((sp) => { squadById[sp.id] = sp; });
  function positionAbbrevFor(p) {
    // p pode ser um jogador em campo (procura no elenco pelo squadId) ou
    // já um registro do elenco (banco), que tem .bucket direto.
    const sp = p.bucket ? p : (p.squadId ? squadById[p.squadId] : null);
    if (sp && sp.bucket) return BUCKET_ABBR[sp.bucket] || '';
    return p.role === 'GK' ? BUCKET_ABBR.GK : '';
  }

  function renderCrowdStrip() {
    if (!crowdStripEl) return;
    const level = (homeClub && homeClub.departments && homeClub.departments.torcida) || 0;
    const spacing = 15 - level * 1.6; // px entre "cabeças" — mais gente, mais junto
    const opacity = 0.08 + level * 0.16;
    const color = (homeClub && homeClub.colors && homeClub.colors.detail) || '#ffd54a';
    crowdStripEl.style.setProperty('--crowd-dot-color', color);
    crowdStripEl.style.setProperty('--crowd-dot-opacity', opacity);
    crowdStripEl.style.setProperty('--crowd-dot-size', spacing + 'px');
  }
  renderCrowdStrip();

  function renderSponsorStrip() {
    if (!homeClub || !homeClub.sponsors || !window.WSPClub) return;
    const slots = window.WSPClub.SPONSOR_SLOTS;
    const active = Object.keys(slots)
      .map((key) => {
        const s = homeClub.sponsors[key];
        return s && s.current ? { icon: slots[key].icon, name: s.current.name } : null;
      })
      .filter(Boolean);
    if (!active.length) return;
    sponsorStripEl.innerHTML = '';
    active.forEach((a) => {
      const pill = document.createElement('span');
      pill.className = 'sponsor-pill';
      pill.textContent = a.icon + ' ' + a.name;
      sponsorStripEl.appendChild(pill);
    });
    sponsorStripEl.classList.remove('hidden');
  }
  renderSponsorStrip();

  // ---------- Efeitos dos departamentos do clube ----------
  const FATIGUE_DEPTS = ['preparador_fisico', 'massagista', 'musculacao'];
  const INJURY_DEPTS = ['medico', 'fisioterapia', 'ortopedista'];
  function deptLevel(key) {
    return (homeClub && homeClub.departments) ? (homeClub.departments[key] || 0) : 0;
  }
  function deptReduction(keys, perLevel, cap) {
    const total = keys.reduce((s, k) => s + deptLevel(k), 0);
    return Math.min(cap, total * perLevel);
  }

  // ---------- Efeito da moral do elenco (entrevista coletiva pós-jogo) ----------
  // pequeno de propósito: moral não decide partida sozinha, só empurra um pouco
  function homeMorale() {
    return (homeClub && homeClub.morale != null) ? homeClub.morale : 50;
  }
  function moraleFatigueMult() {
    // moral baixa cansa mais rápido, moral alta recupera melhor — varia ±15%
    return 1.15 - (homeMorale() / 100) * 0.3;
  }
  function moraleStealAdjust() {
    // desloca a chance de ganhar a bola em disputas em até ±0.02 (STEAL_CHANCE é 0.06)
    return ((homeMorale() - 50) / 50) * 0.02;
  }

  function makePlayer(team, role, number, x, y, extra) {
    const p = {
      team, role, number, x, y, vx: 0, vy: 0,
      facing: { x: 0, y: team === 'home' ? -1 : 1 },
      baseX: x, baseY: y,
      instruction: 'zona', pendingInstruction: null, markTarget: null,
      name: (extra && extra.name) || null,
      foot: (extra && extra.foot) || 'destro',
      traits: (extra && extra.traits) || [],
      improvised: !!(extra && extra.improvised),
      squadId: (extra && extra.squadId) || null,
      position: (extra && extra.position) || null,
      yellowCards: 0, redCard: false, staggerMs: 0,
      fatigue: 0, fatigueNarrated: false,
      rating: (extra && extra.rating) || 60,
      condition: (extra && extra.condition != null) ? extra.condition : 100,
      matchGoals: 0,
      matchAssists: 0,
      wanderSeed: Math.random() * 1000,
    };
    matchParticipants.push(p);
    return p;
  }

  function slotToXY(team, slot) {
    return { x: slot.x, y: team === 'home' ? FIELD_H - slot.d : slot.d };
  }

  function selectStarters(squad, tacticKey) {
    const buckets = tacticBuckets(tacticKey);
    const isInjured = window.WSPSquad ? window.WSPSquad.isInjured : () => false;
    const pools = { GK: [], DEF: [], MID: [], ATT: [] };
    squad.players.forEach((p) => { if (!isInjured(p)) pools[p.bucket].push(p); });
    Object.values(pools).forEach((arr) => arr.sort(() => Math.random() - 0.5));

    let gk = pools.GK.shift();
    if (!gk) gk = pools.DEF.shift() || pools.MID.shift() || pools.ATT.shift();

    const borrowOrder = { DEF: ['MID', 'ATT'], MID: ['DEF', 'ATT'], ATT: ['MID', 'DEF'] };
    const outfield = buckets.map((bucket) => {
      let player = pools[bucket].shift();
      let improvised = false;
      if (!player) {
        for (const alt of borrowOrder[bucket]) {
          player = pools[alt].shift();
          if (player) { improvised = true; break; }
        }
      }
      return player ? { player, improvised } : null;
    });
    const bench = [].concat(pools.GK, pools.DEF, pools.MID, pools.ATT);
    return { gk, outfield, bench };
  }

  function scaledAwayRating(candidateRating) {
    if (!seasonOpponent || seasonOpponent.strength == null) return candidateRating;
    const base = 35 + seasonOpponent.strength * 60;
    return Math.round(Math.max(35, Math.min(99, candidateRating * 0.4 + base * 0.6)));
  }

  function buildTeam(team, tacticKey) {
    const tactic = TACTICS[tacticKey];
    const gkY = team === 'home' ? FIELD_H - 36 : 36;

    if (team === 'home' && homeSquad) {
      const fromLineup = (homeLineup && tacticKey === homeLineupTacticKey) ? selectStartersFromLineup(homeSquad, homeLineup) : null;
      const { gk, outfield, bench } = fromLineup || selectStarters(homeSquad, tacticKey);
      homeBench = bench;
      const gkExtra = gk ? { name: gk.name, foot: gk.foot, traits: gk.traits, squadId: gk.id, rating: gk.rating, condition: gk.condition, position: gk.position } : null;
      const list = [makePlayer('home', 'GK', gk ? gk.number : 1, 200, gkY, gkExtra)];
      tactic.slots.forEach((slot, i) => {
        const { x, y } = slotToXY('home', slot);
        const entry = outfield[i];
        const extra = entry ? { name: entry.player.name, foot: entry.player.foot, traits: entry.player.traits, improvised: entry.improvised, squadId: entry.player.id, rating: entry.player.rating, condition: entry.player.condition, position: entry.player.position } : null;
        list.push(makePlayer('home', 'OUT', entry ? entry.player.number : i + 2, x, y, extra));
      });
      return list;
    }

    if (team === 'away') {
      const pool = window.WSPSquad ? window.WSPSquad.generateCandidates(18) : [];
      const gkCandidate = pool.find(p => p.bucket === 'GK');
      const rest = pool.filter(p => p !== gkCandidate);
      const outfieldCandidates = rest.slice(0, 10);
      awayBench = rest.slice(10, 15).map((p, i) => ({
        id: 'away_bench_' + i, number: 12 + i, name: p.name, foot: p.foot, traits: p.traits, bucket: p.bucket,
        rating: scaledAwayRating(p.rating),
      }));
      const gkExtra = gkCandidate ? { name: gkCandidate.name, foot: gkCandidate.foot, traits: gkCandidate.traits, rating: scaledAwayRating(gkCandidate.rating) } : null;
      const list = [makePlayer('away', 'GK', 1, 200, gkY, gkExtra)];
      tactic.slots.forEach((slot, i) => {
        const { x, y } = slotToXY('away', slot);
        const c = outfieldCandidates[i];
        const extra = c ? { name: c.name, foot: c.foot, traits: c.traits, rating: scaledAwayRating(c.rating) } : null;
        list.push(makePlayer('away', 'OUT', i + 2, x, y, extra));
      });
      return list;
    }

    // reserva: time da casa sem elenco carregado (script squad.js indisponível)
    const list = [makePlayer(team, 'GK', 1, 200, gkY)];
    tactic.slots.forEach((slot, i) => {
      const { x, y } = slotToXY(team, slot);
      list.push(makePlayer(team, 'OUT', i + 2, x, y));
    });
    return list;
  }

  function repositionTeam(team, tacticKey) {
    const teamPlayers = players.filter(p => p.team === team);
    const gkP = teamPlayers.find(p => p.role === 'GK');
    const outfieldP = teamPlayers.filter(p => p.role !== 'GK');
    const tactic = TACTICS[tacticKey];
    const gkY = team === 'home' ? FIELD_H - 36 : 36;
    if (gkP) { gkP.x = 200; gkP.y = gkY; gkP.baseX = 200; gkP.baseY = gkY; gkP.vx = 0; gkP.vy = 0; }
    outfieldP.forEach((p, i) => {
      const slot = tactic.slots[i % tactic.slots.length];
      const { x, y } = slotToXY(team, slot);
      p.x = x; p.y = y; p.baseX = x; p.baseY = y; p.vx = 0; p.vy = 0;
    });
    return gkP ? [gkP, ...outfieldP] : outfieldP;
  }

  function resetPositions(keepXI) {
    const prevInstructions = players.map(p => ({ team: p.team, number: p.number, instruction: p.instruction }));

    if (keepXI && players.length) {
      // same players (including any substitutions made so far), just line
      // everyone back up for kickoff at their current tactic's slots
      players = [...repositionTeam('home', homeTactic), ...repositionTeam('away', awayTactic)];
    } else {
      players = [...buildTeam('home', homeTactic), ...buildTeam('away', awayTactic)];
      homeSubsUsed = 0;
      awaySubsUsed = 0;
    }

    for (const p of players) {
      const prev = prevInstructions.find(x => x.team === p.team && x.number === p.number);
      if (prev) p.instruction = prev.instruction;
    }
    ball = { x: 200, y: FIELD_H / 2, vx: 0, vy: 0, owner: null, kickerImmune: null, kickCooldown: 0, aiCooldown: 0, lastToucher: null, assistCandidate: null, restartKind: null };
  }

  function applyTactic(team, key) {
    if (!TACTICS[key]) return;
    if (team === 'home') homeTactic = key; else awayTactic = key;
    const tactic = TACTICS[key];
    const outfield = players.filter(p => p.team === team && p.role !== 'GK');
    outfield.forEach((p, i) => {
      const slot = tactic.slots[i];
      if (!slot) return;
      const { x, y } = slotToXY(team, slot);
      p.baseX = x; p.baseY = y;
    });
  }

  function resetMatch() {
    matchParticipants = [];
    matchHadConfusion = false;
    awayTactic = TACTIC_KEYS[Math.floor(Math.random() * TACTIC_KEYS.length)];
    resetPositions(false);
    score = { home: 0, away: 0 };
    half = 1;
    displaySeconds = 0;
    techTimeoutDone = false;
    breakKind = null;
    breakTimer = 0;
    paused = false;
    speedMultiplier = 1;
    matchOver = false;
    stopPause = 0;
    awaySubMinutes = [12 + Math.random() * 10, 24 + Math.random() * 8, 34 + Math.random() * 8];
    awaySubWindowIdx = 0;
    awayPostureAppliedMinute = -1;
    possessionHomeMs = 0;
    possessionAwayMs = 0;
    updatePressureBar();
    hideOverlay();
    updateScoreUI();
    halfLabelEl.textContent = '1T';
    timerEl.textContent = formatClock(0);
    narrationLog = [];
    tickerEl.textContent = '';
    narrate('Bola rolando! ' + teamLabel('home') + ' x ' + teamLabel('away') + '.');
  }

  function startSecondHalf() {
    half = 2;
    displaySeconds = 0;
    techTimeoutDone = false;
    breakKind = null;
    hideOverlay();
    const recovery = Math.min(0.4, FATIGUE_HALFTIME_RECOVERY + deptLevel('hidromassagem') * 0.03);
    players.forEach((p) => {
      if (p.team === 'home') {
        p.fatigue = Math.max(0, p.fatigue - recovery);
        if (p.fatigue < FATIGUE_NARRATE_THRESHOLD) p.fatigueNarrated = false;
      }
    });
    resetPositions(true);
    halfLabelEl.textContent = '2T';
    timerEl.textContent = formatClock(0);
    narrate('Bola rolando para o 2º tempo!');
  }

  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '▶' : '⏸';
  });
  btnSpeed.addEventListener('click', () => {
    speedMultiplier = speedMultiplier === 1 ? 2 : 1;
    btnSpeed.style.opacity = speedMultiplier === 2 ? '0.6' : '1';
  });
  overlayRestart.addEventListener('click', () => {
    openPressConference();
  });
  if (reportBtnEl) {
    reportBtnEl.addEventListener('click', () => {
      openNarrationMenu();
    });
  }

  let pausedByMenu = false;
  function pauseForMenu() {
    if (!paused) { paused = true; pausedByMenu = true; btnPause.textContent = '▶'; }
  }
  function resumeFromMenu() {
    if (pausedByMenu) { paused = false; pausedByMenu = false; btnPause.textContent = '⏸'; }
  }

  function renderTacticsList() {
    tacticsList.innerHTML = '';
    TACTIC_KEYS.forEach((key) => {
      const btn = document.createElement('button');
      btn.className = 'tactic-option' + (key === homeTactic ? ' active' : '');
      btn.textContent = TACTICS[key].label;
      btn.addEventListener('click', () => {
        applyTactic('home', key);
        closeTacticsMenu();
      });
      tacticsList.appendChild(btn);
    });
  }
  function openTacticsMenu() {
    pauseForMenu();
    renderTacticsList();
    tacticsOverlay.classList.remove('hidden');
  }
  function closeTacticsMenu() {
    tacticsOverlay.classList.add('hidden');
    resumeFromMenu();
  }
  btnTactics.addEventListener('click', openTacticsMenu);
  tacticsClose.addEventListener('click', closeTacticsMenu);

  function renderInstructionsList() {
    instructionsList.innerHTML = '';
    const outfield = sortByPositionGroup(players.filter(p => p.team === 'home' && p.role !== 'GK'));
    outfield.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'instr-row';
      const num = document.createElement('span');
      num.className = 'num';
      const posAbbr = POSITION_GROUP_ABBR[positionGroupFor(p)];
      num.textContent = '#' + p.number + (posAbbr ? ' ' + posAbbr : '');
      row.appendChild(num);
      const btnWrap = document.createElement('div');
      btnWrap.className = 'instr-btns';
      instructionSetFor(p).forEach((opt) => {
        const b = document.createElement('button');
        b.className = 'instr-btn' + ((p.instruction || 'zona') === opt.key ? ' active' : '');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          p.instruction = opt.key;
          p.pendingInstruction = null;
          if (opt.key !== 'individual') p.markTarget = null;
          renderInstructionsList();
        });
        btnWrap.appendChild(b);
      });
      row.appendChild(btnWrap);
      instructionsList.appendChild(row);
    });
  }
  function renderSideInstructions() {
    if (!sideInstructionsListEl) return;
    const outfield = sortByPositionGroup(players.filter(p => p.team === 'home' && p.role !== 'GK'));
    sideInstructionsListEl.innerHTML = '';
    outfield.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'side-instr-row';
      const name = document.createElement('div');
      name.className = 'side-instr-name';
      const posAbbr = POSITION_GROUP_ABBR[positionGroupFor(p)];
      name.textContent = '#' + p.number + (posAbbr ? ' ' + posAbbr : '') + ' ' + displayNameFor(p);
      row.appendChild(name);
      const activeKey = p.pendingInstruction || p.instruction || 'zona';
      const btnWrap = document.createElement('div');
      btnWrap.className = 'side-instr-btns';
      instructionSetFor(p).forEach((opt) => {
        const b = document.createElement('button');
        b.className = 'side-instr-btn' + (activeKey === opt.key ? ' active' : '');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          // não muda o jogador no meio do lance — só passa a valer na próxima
          // bola parada (lateral, escanteio, tiro de meta, falta) ou após um gol
          p.pendingInstruction = opt.key;
          renderSideInstructions();
        });
        btnWrap.appendChild(b);
      });
      row.appendChild(btnWrap);
      if (p.pendingInstruction != null && p.pendingInstruction !== p.instruction) {
        const hint = document.createElement('div');
        hint.className = 'side-instr-pending';
        hint.textContent = 'Muda na próxima bola parada';
        row.appendChild(hint);
      }
      sideInstructionsListEl.appendChild(row);
    });
  }

  function openInstructionsMenu() {
    pauseForMenu();
    renderInstructionsList();
    instructionsOverlay.classList.remove('hidden');
  }
  function closeInstructionsMenu() {
    instructionsOverlay.classList.add('hidden');
    resumeFromMenu();
  }
  btnInstructions.addEventListener('click', openInstructionsMenu);
  instructionsClose.addEventListener('click', closeInstructionsMenu);

  function renderNarrationList() {
    narrationList.innerHTML = '';
    narrationLog.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'narration-line';
      const min = document.createElement('span');
      min.className = 'min';
      min.textContent = entry.label;
      row.appendChild(min);
      const txt = document.createElement('span');
      txt.textContent = entry.text;
      row.appendChild(txt);
      narrationList.appendChild(row);
    });
  }
  function openNarrationMenu() {
    pauseForMenu();
    renderNarrationList();
    narrationOverlay.classList.remove('hidden');
  }
  function closeNarrationMenu() {
    narrationOverlay.classList.add('hidden');
    resumeFromMenu();
  }
  tickerEl.addEventListener('click', openNarrationMenu);
  narrationClose.addEventListener('click', closeNarrationMenu);

  let subOutSelected = null;
  function displayNameFor(p) { return p.name || ('#' + p.number); }

  function renderSubsPanel() {
    subsCounterEl.textContent = homeSubsUsed + '/' + MAX_SUBS + ' usadas';
    subsHintEl.textContent = homeSubsUsed >= MAX_SUBS
      ? 'Limite de substituições atingido'
      : (subOutSelected ? 'Agora escolha quem entra' : 'Toque em quem sai, depois em quem entra');

    subsOnfieldEl.innerHTML = '';
    const onField = sortByPositionGroup(players.filter(p => p.team === 'home'));
    onField.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'sub-player' + (subOutSelected === p ? ' selected' : '');
      btn.innerHTML = '<span class="num">' + p.number + '</span><span class="pos">' + positionAbbrevFor(p) + '</span><span class="nm">' + displayNameFor(p) + '</span>';
      btn.disabled = homeSubsUsed >= MAX_SUBS;
      btn.addEventListener('click', () => {
        subOutSelected = subOutSelected === p ? null : p;
        renderSubsPanel();
      });
      subsOnfieldEl.appendChild(btn);
    });

    subsBenchEl.innerHTML = '';
    if (!homeBench.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#888;font-size:0.7rem;font-style:italic;padding:6px;';
      empty.textContent = 'Banco vazio';
      subsBenchEl.appendChild(empty);
    }
    sortByPositionGroup(homeBench).forEach((bp) => {
      const btn = document.createElement('button');
      btn.className = 'sub-player';
      btn.innerHTML = '<span class="num">' + bp.number + '</span><span class="pos">' + positionAbbrevFor(bp) + '</span><span class="nm">' + bp.name + '</span>';
      btn.disabled = !subOutSelected || homeSubsUsed >= MAX_SUBS;
      btn.addEventListener('click', () => {
        if (!subOutSelected) return;
        const ok = makeHomeSubstitution(subOutSelected, bp);
        subOutSelected = null;
        if (ok) renderSubsPanel();
      });
      subsBenchEl.appendChild(btn);
    });
  }

  function openSubsMenu() {
    pauseForMenu();
    subOutSelected = null;
    renderSubsPanel();
    subsOverlay.classList.remove('hidden');
  }
  function closeSubsMenu() {
    subsOverlay.classList.add('hidden');
    resumeFromMenu();
  }
  btnSubs.addEventListener('click', openSubsMenu);
  subsClose.addEventListener('click', closeSubsMenu);

  breakTacticsBtn.addEventListener('click', openTacticsMenu);
  breakInstructionsBtn.addEventListener('click', openInstructionsMenu);
  breakSubsBtn.addEventListener('click', openSubsMenu);

  // ---------- Helpers ----------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clampPlayer(p) {
    p.x = Math.max(CLAMP_X_MIN, Math.min(CLAMP_X_MAX, p.x));
    p.y = Math.max(CLAMP_Y_MIN, Math.min(CLAMP_Y_MAX, p.y));
  }
  function teammates(team) { return players.filter(p => p.team === team); }
  function opponentsOf(team) { return players.filter(p => p.team !== team); }

  function kick(player, targetX, targetY, power) {
    const dx = targetX - ball.x, dy = targetY - ball.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    ball.vx = ux * power;
    ball.vy = uy * power;
    // nudge the ball clear of the kicker right away so it can't be
    // re-picked-up on the very next frame before it has actually moved
    ball.x += ux * (PLAYER_R + BALL_R + 6);
    ball.y += uy * (PLAYER_R + BALL_R + 6);
    clampBall();
    ball.owner = null;
    ball.kickerImmune = player;
    ball.kickCooldown = KICK_COOLDOWN_MS;
    ball.lastToucher = player;
    ball.assistCandidate = null; // attemptPass sets this back right after, for real passes only
  }

  function clampBall() {
    ball.x = Math.max(BALL_R, Math.min(FIELD_W - BALL_R, ball.x));
    ball.y = Math.max(BALL_R, Math.min(FIELD_H - BALL_R, ball.y));
  }

  function pickPassTarget(p) {
    const mates = teammates(p.team).filter(m => m !== p && m.role !== 'GK');
    if (!mates.length) return null;
    const opponents = opponentsOf(p.team).filter(o => o.role !== 'GK');
    const forward = p.team === 'home' ? -1 : 1;

    // pontua cada companheiro por avanço + espaço livre (marcação), penalizando
    // levemente passes muito longos — bem melhor que "sempre o mais adiantado",
    // que ignorava se o cara estava marcado ou impedido. A instrução de quem
    // está passando ajusta os pesos: lançamento aceita passe mais longo,
    // saída rápida e tabela preferem opção curta e segura por perto
    let advW = 0.55, openW = 1.3, distPenaltyW = 0.4, distPenaltyFree = 220;
    if (p.instruction === 'lancamento_preciso') { distPenaltyW = 0.15; advW = 0.75; }
    else if (p.instruction === 'saida_rapida') { advW = 0.3; openW = 1.6; distPenaltyW = 0.7; distPenaltyFree = 130; }
    else if (p.instruction === 'fazedor_tabela') { distPenaltyW = 0.9; distPenaltyFree = 90; openW = 1.5; }

    function scoreFor(m) {
      const advancement = forward < 0 ? (FIELD_H - m.y) : m.y;
      const marker = nearestTo(opponents, m);
      const openness = marker ? dist(m, marker) : 200;
      const distFromPasser = dist(p, m);
      return advancement * advW + openness * openW - Math.max(0, distFromPasser - distPenaltyFree) * distPenaltyW;
    }

    const onside = mates.filter((m) => !isPassOffside(p, m));
    const pool = onside.length ? onside : mates;
    let target = pool[0], bestScore = scoreFor(pool[0]);
    for (const m of pool) {
      const s = scoreFor(m);
      if (s > bestScore) { bestScore = s; target = m; }
    }
    let power = Math.min(260, Math.max(150, dist(p, target) * 0.9 + 70));
    if (p.instruction === 'lancamento_preciso') power = Math.min(270, power * 1.08);
    return { target, power };
  }

  function footBias(foot) {
    if (foot === 'canhoto') return -8;
    if (foot === 'destro') return 8;
    return 0; // ambidestro / pé invertido / sem preferência marcada
  }

  function isPassOffside(passer, target) {
    const opp = opponentsOf(passer.team).filter(o => o.role !== 'GK');
    if (opp.length < 2) return false;
    const sorted = passer.team === 'home'
      ? opp.slice().sort((a, b) => a.y - b.y)
      : opp.slice().sort((a, b) => b.y - a.y);
    const offsideLineY = sorted[1].y;
    const ownHalf = passer.team === 'home' ? target.y > FIELD_H / 2 : target.y < FIELD_H / 2;
    if (ownHalf) return false;
    const pastDefense = passer.team === 'home' ? target.y < offsideLineY : target.y > offsideLineY;
    const pastBall = passer.team === 'home' ? target.y < ball.y : target.y > ball.y;
    return pastDefense && pastBall;
  }

  function attemptShoot(p, bonus) {
    lastShooter = p;
    lastAssistCandidate = ball.assistCandidate; // captura antes do próprio chute limpar ball.assistCandidate
    const attackingGoalY = p.team === 'home' ? 8 : FIELD_H - 8;
    const accuracyMult = 1.3 - ((p.rating || 60) / 100) * 0.6;
    let missChance = bonus ? 0.03 : Math.max(0.03, Math.min(0.3, 0.35 - (p.rating || 60) / 200));
    let powerMult = bonus ? 1.15 : 1;
    // finalizador/cabeceio: bem mais frio na hora de definir; chute forte:
    // bate mais forte, mas perde um pouco de precisão em troca
    if (p.instruction === 'finalizador' || p.instruction === 'cabeceio') missChance *= 0.75;
    if (p.instruction === 'chute_forte') { powerMult *= 1.12; missChance = Math.min(0.4, missChance * 1.15); }
    let spread;
    if (Math.random() < missChance) {
      // chute mal ajustado, vai claramente para fora do gol
      const side = Math.random() < 0.5 ? -1 : 1;
      spread = side * (65 + Math.random() * 45);
    } else {
      spread = (Math.random() - 0.5) * (bonus ? 14 : 32) * accuracyMult;
    }
    spread += footBias(p.foot);
    kick(p, 200 + spread, attackingGoalY, SHOOT_POWER * powerMult);
  }

  function attemptPass(p, pass) {
    if (isPassOffside(p, pass.target)) {
      const otherTeam = p.team === 'home' ? 'away' : 'home';
      narrate('Impedimento! Tiro livre para ' + teamLabel(otherTeam) + '.');
      awardFreeKick(otherTeam, { x: pass.target.x, y: pass.target.y });
      stopPause = STOPPAGE_MS;
      showStoppage('IMPEDIMENTO!', 'Tiro livre para ' + teamLabel(otherTeam));
      return;
    }
    kick(p, pass.target.x, pass.target.y, pass.power);
    ball.assistCandidate = p;
  }

  function updatePlayer(p, dt, teamOutfield, oppOutfield) {
    if (p.staggerMs > 0) {
      p.staggerMs -= dt * 1000;
      p.vx = 0; p.vy = 0;
      return;
    }
    let fatigueMult = 1;
    if (p.role !== 'GK') {
      const reduction = p.team === 'home' ? deptReduction(FATIGUE_DEPTS, 0.04, 0.5) : 0;
      const moraleMult = p.team === 'home' ? moraleFatigueMult() : 1;
      p.fatigue = Math.min(1, p.fatigue + dt * FATIGUE_RATE_PER_SEC * (1 - reduction) * moraleMult);
      if (p.team === 'home' && !p.fatigueNarrated && p.fatigue >= FATIGUE_NARRATE_THRESHOLD) {
        p.fatigueNarrated = true;
        narrate(displayName(p) + ' está visivelmente cansado.');
      }
      fatigueMult = 1 - p.fatigue * FATIGUE_SPEED_PENALTY;
    }
    if (p.role === 'GK') {
      const ownGoalY = p.team === 'home' ? FIELD_H - 20 : 20;
      const targetX = Math.max(GOAL_L + 14, Math.min(GOAL_R - 14, ball.x));
      const dx = targetX - p.x, dy = ownGoalY - p.y;
      const len = Math.hypot(dx, dy) || 1;
      p.vx = (dx / len) * GK_SPEED * Math.min(1, Math.abs(dx) / 10);
      p.vy = (dy / len) * GK_SPEED * Math.min(1, Math.abs(dy) / 10);
    } else {
      const hasBall = ball.owner === p;
      // "isPressing" cobre dois casos com o mesmo comportamento (correr reto
      // pra bola): perseguir bola solta, e o defensor mais próximo pressionando
      // quem está com a bola do time adversário
      const chaser = nearestTo(teamOutfield, ball);
      const isPressing = !hasBall && chaser === p;
      const fitFactor = p.improvised ? 0.9 : 1; // out-of-position players are a bit less sharp
      if (hasBall) {
        // motor de drible: avança em direção ao gol adversário desviando do
        // marcador mais próximo, em vez de só correr atrás da própria bola
        // (que ficava "grudada" nele e fazia o drible parecer sem direção)
        const forward = p.team === 'home' ? -1 : 1;
        const nearestOpp = nearestTo(oppOutfield, p);
        let steerX = 0;
        if (nearestOpp) {
          const awayX = p.x - nearestOpp.x, awayY = p.y - nearestOpp.y;
          const oppDist = Math.hypot(awayX, awayY) || 1;
          if (oppDist < DRIBBLE_PRESSURE_R) {
            steerX = (awayX / oppDist) * (1 - oppDist / DRIBBLE_PRESSURE_R);
          }
        }
        // driblador/habilidade escapam melhor da marcação; facão/aberto
        // puxam o drible pra dentro ou pra linha lateral, respectivamente
        const evasionMult = (p.instruction === 'driblador' || p.instruction === 'habilidade') ? 1.6 : 1;
        let lateralPull = 0;
        if (p.instruction === 'facao') lateralPull = (p.x > FIELD_W / 2 ? -1 : 1) * 18;
        else if (p.instruction === 'aberto') lateralPull = (p.x > FIELD_W / 2 ? 1 : -1) * 18;
        let tx = p.x + steerX * 70 * evasionMult + lateralPull;
        let ty = p.y + forward * 90;
        tx = Math.max(CLAMP_X_MIN + 10, Math.min(CLAMP_X_MAX - 10, tx));
        const dx = tx - p.x, dy = ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        p.vx = (dx / len) * DRIBBLE_SPEED * fitFactor;
        p.vy = (dy / len) * DRIBBLE_SPEED * fitFactor;
        p.facing = { x: dx / len, y: dy / len };
      } else if (isPressing) {
        const dx = ball.x - p.x, dy = ball.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        p.vx = (dx / len) * CHASER_SPEED * fitFactor;
        p.vy = (dy / len) * CHASER_SPEED * fitFactor;
        p.facing = { x: dx / len, y: dy / len };
      } else {
        const instr = p.instruction || 'zona';
        const forward = p.team === 'home' ? -1 : 1;
        // 0 (linha de defesa) a 1 (linha de ataque) — usado pra decidir quem
        // arrisca correr pra frente em busca de espaço e quem segura a linha
        const advancement = Math.max(0, Math.min(1, forward < 0 ? 1 - p.baseY / FIELD_H : p.baseY / FIELD_H));
        let tx, ty;
        if (instr === 'individual') {
          if (!p.markTarget) {
            p.markTarget = nearestTo(oppOutfield, p);
          }
          if (p.markTarget) {
            const goalSide = p.team === 'home' ? 12 : -12;
            tx = p.markTarget.x;
            ty = p.markTarget.y + goalSide;
          } else {
            tx = p.baseX; ty = p.baseY;
          }
        } else {
          const baseDrift = TACTICS[p.team === 'home' ? homeTactic : awayTactic].drift;
          // cada instrução específica de posição empurra o jogador de um jeito
          // diferente: mais/menos pra frente (driftDelta/yBiasExtra) ou mais
          // pro centro/pra linha lateral (xBiasSign)
          let driftDelta = 0, yBiasExtra = 0, xBiasSign = 0;
          switch (instr) {
            case 'ataque': yBiasExtra = forward * 55; break;
            case 'defesa': driftDelta = -0.15; yBiasExtra = -forward * 55; break;
            case 'sobra': driftDelta = -0.12; yBiasExtra = -forward * 35; break;
            case 'marcar_frente': driftDelta = 0.15; yBiasExtra = forward * 30; break;
            case 'apoiador': driftDelta = 0.28; yBiasExtra = forward * 45; break;
            case 'defensivo': driftDelta = -0.15; yBiasExtra = -forward * 30; break;
            case 'por_dentro': xBiasSign = -1; break;
            case 'aberto': xBiasSign = 1; break;
            case 'facao': xBiasSign = -1; yBiasExtra = forward * 15; break;
            case 'mais_marcacao': driftDelta = -0.12; yBiasExtra = -forward * 25; break;
            case 'racudo': driftDelta = 0.08; break;
            case 'dez_classico': driftDelta = 0.15; break;
            default: break; // zona/padrão/clássico/individual-fallback/etc.
          }
          const drift = Math.max(0.05, Math.min(0.7, baseDrift + driftDelta));
          const yBias = yBiasExtra;
          const xBiasAmount = xBiasSign !== 0 ? xBiasSign * (40 + advancement * 20) : 0;
          tx = p.baseX + (ball.x - 200) * drift + xBiasAmount;
          ty = p.baseY + (ball.y - p.baseY) * 0.15 + yBias;

          // sem a bola no pé, o time ainda se move: quem tem a bola ganha apoio
          // (companheiros se abrem oferecendo linha de passe, e os mais adiantados
          // arriscam correr pro espaço nas costas da defesa) — e contra a bola o
          // time comprime/segura a linha junto, em vez de só balançar na posição base
          if (ball.owner && ball.owner.team === p.team && ball.owner !== p) {
            const sideSign = (p.x - ball.owner.x) >= 0 ? 1 : -1;
            tx += sideSign * (16 + advancement * 10);
            ty += forward * (12 + advancement * 26);
          } else if (ball.owner && ball.owner.team !== p.team) {
            const towardX = ball.x - p.x, towardY = ball.y - p.y;
            const tlen = Math.hypot(towardX, towardY) || 1;
            // a defesa (advancement baixo) segura mais a linha e comprime menos
            // em direção à bola, pra manter o bloco coeso pra armar impedimento
            const pressAmount = 5 + (1 - advancement) * 5;
            tx += (towardX / tlen) * pressAmount;
            ty += (towardY / tlen) * pressAmount;
          }
        }
        const t = performance.now() / 1000;
        // a linha de defesa balança menos (segura a linha), o ataque balança mais
        const wanderAmp = 10 + advancement * 10;
        tx += Math.sin(t * 0.6 + p.wanderSeed) * wanderAmp;
        ty += Math.cos(t * 0.45 + p.wanderSeed * 1.7) * wanderAmp;
        const dx = tx - p.x, dy = ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.max(8, Math.min(TEAMMATE_SPEED, len * 4)) * fitFactor;
        p.vx = (dx / len) * speed;
        p.vy = (dy / len) * speed;
      }
    }
    if (p.role !== 'GK') {
      const combinedMult = fatigueMult * ratingSpeedMult(p.rating) * conditionSpeedMult(p.condition);
      p.vx *= combinedMult; p.vy *= combinedMult;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampPlayer(p);
  }

  function nearestTo(list, point) {
    if (!list.length) return null;
    let best = list[0], bestD = dist(list[0], point);
    for (const p of list) {
      const d = dist(p, point);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  function ballCarrierAIAct(dt) {
    if (ball.aiCooldown > 0) ball.aiCooldown -= dt * 1000;

    if (ball.owner && ball.owner.role !== 'GK') {
      const p = ball.owner;
      if (ball.restartKind === 'corner') {
        // escanteio: quase sempre é um cruzamento pra área; gol direto (olímpico) é raro
        ball.restartKind = null;
        const golOlimpico = Math.random() < 0.07;
        if (golOlimpico) {
          lastShotOrigin = 'jogo';
          attemptShoot(p, false);
        } else {
          const pass = pickPassTarget(p);
          if (pass) attemptPass(p, pass);
          else attemptShoot(p, false);
        }
        return;
      }
      if (ball.restartKind === 'throwin') {
        // não existe gol direto de lateral pelas regras — é sempre um lançamento pra um companheiro
        ball.restartKind = null;
        const pass = pickPassTarget(p);
        if (pass) attemptPass(p, pass);
        else p.facing = { x: 0, y: p.team === 'home' ? -1 : 1 };
        return;
      }
      // alcance apertado: só dispara o chute perto de verdade do gol (senão
      // qualquer bola que chega no terço final virava chute na hora, gerando
      // dezenas de finalizações por partida); finalizador arrisca um pouco mais
      const shootRange = p.instruction === 'finalizador' ? 175 : 150;
      const nearGoal = p.team === 'home' ? p.y < shootRange : p.y > FIELD_H - shootRange;
      if (nearGoal) {
        const bonus = !!ball.freeKickBonus;
        ball.freeKickBonus = false;
        lastShotOrigin = bonus ? 'falta' : 'jogo';
        attemptShoot(p, bonus);
      } else if (ball.aiCooldown <= 0) {
        const pass = pickPassTarget(p);
        const passChance = p.instruction === 'finalizador' ? 0.45 : 0.6;
        if (pass && Math.random() < passChance) {
          attemptPass(p, pass);
        } else {
          p.facing = { x: 0, y: p.team === 'home' ? -1 : 1 };
        }
        ball.aiCooldown = AI_DECISION_MIN_MS + Math.random() * (AI_DECISION_MAX_MS - AI_DECISION_MIN_MS);
      }
    }
    if (ball.owner && ball.owner.role === 'GK') {
      const p = ball.owner;
      const forwardX = 200 + (Math.random() - 0.5) * 160;
      const forwardY = p.team === 'home' ? p.y - 240 : p.y + 240;
      kick(p, forwardX, forwardY, CLEAR_POWER);
      ball.assistCandidate = p; // lançamento do goleiro pode virar assistência se um companheiro finalizar em seguida
    }
  }

  // ---------- Ball physics ----------
  function updateBall(dt) {
    if (ball.kickCooldown > 0) ball.kickCooldown -= dt * 1000;

    if (ball.owner) {
      const p = ball.owner;
      const fx = p.facing.x || 0, fy = p.facing.y || (p.team === 'home' ? -1 : 1);
      const flen = Math.hypot(fx, fy) || 1;
      ball.x = p.x + (fx / flen) * (PLAYER_R + 2);
      ball.y = p.y + (fy / flen) * (PLAYER_R + 2);
      ball.vx = 0; ball.vy = 0;
    } else {
      ball.vx *= 0.985;
      ball.vy *= 0.985;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < WALL_MIN) {
        const spot = { x: WALL_MIN, y: Math.max(BALL_R, Math.min(FIELD_H - BALL_R, ball.y)) };
        awardThrowIn(otherTeamOf(ball.lastToucher), spot);
        return;
      }
      if (ball.x > WALL_MAX) {
        const spot = { x: WALL_MAX, y: Math.max(BALL_R, Math.min(FIELD_H - BALL_R, ball.y)) };
        awardThrowIn(otherTeamOf(ball.lastToucher), spot);
        return;
      }

      const inGoalX = ball.x > GOAL_L + BALL_R && ball.x < GOAL_R - BALL_R;
      const cornerSide = ball.x < FIELD_W / 2 ? WALL_MIN : WALL_MAX;
      if (ball.y < BALL_R) {
        if (inGoalX) { onGoal('home'); return; }
        if (ball.lastToucher && ball.lastToucher.team === 'away') {
          awardCorner('home', { x: cornerSide, y: BALL_R });
        } else {
          awardGoalKick('away', { x: 200, y: 30 });
        }
        return;
      }
      if (ball.y > FIELD_H - BALL_R) {
        if (inGoalX) { onGoal('away'); return; }
        if (ball.lastToucher && ball.lastToucher.team === 'home') {
          awardCorner('away', { x: cornerSide, y: FIELD_H - BALL_R });
        } else {
          awardGoalKick('home', { x: 200, y: FIELD_H - 30 });
        }
        return;
      }
    }

    // pickup
    let pickupCandidate = null, pickupDist = Infinity;
    for (const p of players) {
      if (ball.kickerImmune === p && ball.kickCooldown > 0) continue;
      const d = dist(p, ball);
      if (d < PICKUP_R && d < pickupDist) { pickupCandidate = p; pickupDist = d; }
    }
    if (pickupCandidate) {
      if (!ball.owner) {
        // goleiro pegando a bola direto de um chute do adversário — pode
        // virar um "lance de perigo" com pausa e replay de defesaço
        if (pickupCandidate.role === 'GK' && lastShooter && ball.lastToucher === lastShooter && lastShooter.team !== pickupCandidate.team) {
          triggerGreatSave(pickupCandidate, lastShooter);
        }
        ball.owner = pickupCandidate;
        ball.lastToucher = pickupCandidate;
        if (ball.assistCandidate && (ball.assistCandidate === pickupCandidate || ball.assistCandidate.team !== pickupCandidate.team)) {
          ball.assistCandidate = null; // interceptado ou bola solta sem ligação com o passe
        }
      } else if (ball.owner !== pickupCandidate && ball.owner.team !== pickupCandidate.team) {
        const roll = Math.random();
        // defensor mais bem avaliado rouba mais, driblador mais bem avaliado resiste mais
        const ratingDiff = (pickupCandidate.rating || 60) - (ball.owner.rating || 60);
        let stealChance = Math.max(0.015, Math.min(0.16, STEAL_CHANCE + ratingDiff * 0.0015));
        // força/habilidade seguram mais a bola; raçudo rouba mais (mas comete mais faltas)
        if (ball.owner.instruction === 'forca' || ball.owner.instruction === 'habilidade') stealChance *= 0.8;
        let foulChance = FOUL_CHANCE;
        if (pickupCandidate.instruction === 'racudo') { stealChance *= 1.25; foulChance *= 1.4; }
        const moraleAdj = moraleStealAdjust();
        if (pickupCandidate.team === 'home') stealChance = Math.max(0.01, stealChance + moraleAdj);
        else if (ball.owner.team === 'home') stealChance = Math.max(0.01, stealChance - moraleAdj);
        stealChance = Math.max(0.01, Math.min(0.2, stealChance));
        if (roll < foulChance) {
          commitFoul(pickupCandidate, ball.owner);
          return;
        } else if (roll < foulChance + stealChance) {
          const previousOwner = ball.owner;
          ball.owner = pickupCandidate;
          ball.lastToucher = pickupCandidate;
          ball.assistCandidate = null; // roubada de bola quebra a corrente de assistência
          if (duelCooldownMs <= 0) showDuel(pickupCandidate, previousOwner);
        }
      }
    }
    if (ball.kickCooldown <= 0) ball.kickerImmune = null;
  }

  function onGoal(scoringTeam, viaPenalty) {
    applyPendingInstructions();
    score[scoringTeam]++;
    updateScoreUI();
    if (lastShooter && lastShooter.team === scoringTeam) {
      goalZoomActive = true;
      goalZoomX = lastShooter.x;
      goalZoomY = lastShooter.y;
    }
    if (!viaPenalty) {
      const scorer = lastShooter && lastShooter.team === scoringTeam ? displayName(lastShooter) : null;
      let assistText = '';
      if (lastShooter && lastShooter.team === scoringTeam) {
        lastShooter.matchGoals++;
        const assister = lastAssistCandidate;
        if (assister && assister !== lastShooter && assister.team === scoringTeam) {
          assister.matchAssists++;
          assistText = ' Assistência de ' + displayName(assister) + '.';
        }
      }
      narrate((scorer ? 'GOL de ' + scorer + '! ' : 'GOL! ') + teamLabel(scoringTeam) + ' marca. ' + score.home + ' x ' + score.away + '.' + assistText);
    }
    lastAssistCandidate = null;
    lastShooter = null;
    showGoal(scoringTeam);
    pendingKickoffReset = true;
    stopPause = 1400;
  }

  function displayName(p) { return p.name || ('#' + p.number); }

  function bookPlayer(p, wantsRed) {
    if (wantsRed) {
      p.redCard = true;
      sendOff(p);
      return 'red';
    }
    if ((p.yellowCards || 0) >= 1) {
      p.redCard = true;
      sendOff(p);
      return 'red2';
    }
    p.yellowCards = 1;
    return 'yellow';
  }

  function sendOff(p) {
    const idx = players.indexOf(p);
    if (idx >= 0) players.splice(idx, 1);
    if (ball.owner === p) ball.owner = null;
  }

  function substitutePlayer(outPlayer, inData) {
    const idx = players.indexOf(outPlayer);
    if (idx < 0) return null;
    const extra = { name: inData.name, foot: inData.foot, traits: inData.traits || [], squadId: inData.id || null, rating: inData.rating, condition: inData.condition, position: inData.position };
    const newPlayer = makePlayer(outPlayer.team, outPlayer.role, inData.number, outPlayer.x, outPlayer.y, extra);
    newPlayer.baseX = outPlayer.baseX;
    newPlayer.baseY = outPlayer.baseY;
    newPlayer.instruction = outPlayer.instruction;
    players[idx] = newPlayer;
    if (ball.owner === outPlayer) ball.owner = newPlayer;
    narrate('Mudança em ' + teamLabel(outPlayer.team) + ': entra ' + displayName(newPlayer) + ', sai ' + displayName(outPlayer) + '.');
    return newPlayer;
  }

  function makeHomeSubstitution(outPlayer, benchPlayer) {
    if (homeSubsUsed >= MAX_SUBS) return false;
    const result = substitutePlayer(outPlayer, benchPlayer);
    if (!result) return false;
    homeBench = homeBench.filter((p) => p.id !== benchPlayer.id);
    homeSubsUsed++;
    return true;
  }

  function makeAwaySubstitution() {
    if (awaySubsUsed >= MAX_SUBS || !awayBench.length) return false;
    const outCandidates = players.filter((p) => p.team === 'away' && p.role !== 'GK');
    if (!outCandidates.length) return false;
    // tira sempre o mais desgastado, como um técnico de verdade faria — em vez de sortear
    const outPlayer = outCandidates.reduce((worst, p) => (p.fatigue > worst.fatigue ? p : worst), outCandidates[0]);
    const benchPlayer = awayBench.shift();
    const result = substitutePlayer(outPlayer, benchPlayer);
    if (result) awaySubsUsed++;
    return !!result;
  }

  // motor tático do adversário: reage ao placar empurrando a linha quando
  // está perdendo (mais gente em 'ataque') e segurando o resultado quando
  // está vencendo com folga (mais gente em 'defesa'), reaproveitando o
  // mesmo sistema de instruções que o usuário já usa pro próprio time
  function updateAwayPosture(minute) {
    const diff = score.away - score.home;
    const late = minute >= 20;
    let mode = 'zona';
    if (diff <= -1 && late) mode = 'ataque';
    else if (diff >= 2 && late) mode = 'defesa';
    const awayOutfield = players.filter((p) => p.team === 'away' && p.role !== 'GK');
    awayOutfield.forEach((p, i) => {
      // mesmo empurrando a linha, mantém uma base seguindo a zona pra não
      // expor o time inteiro
      p.instruction = (mode === 'ataque' && i % 3 === 0) ? 'zona' : mode;
    });
  }

  function otherTeamOf(player) {
    return player && player.team === 'home' ? 'away' : 'home';
  }

  function awardThrowIn(team, spot) {
    narrate('Lateral para ' + teamLabel(team) + '.');
    awardFreeKick(team, spot);
    ball.restartKind = 'throwin';
    stopPause = SIDE_STOPPAGE_MS;
    showStoppage('LATERAL!', teamLabel(team) + ' vai repor.');
  }

  function awardCorner(team, spot) {
    narrate('Escanteio para ' + teamLabel(team) + '.');
    awardFreeKick(team, spot);
    ball.restartKind = 'corner';
    stopPause = SIDE_STOPPAGE_MS;
    showStoppage('ESCANTEIO!', teamLabel(team) + ' vai cobrar.');
  }

  function awardGoalKick(team, spot) {
    narrate('Tiro de meta para ' + teamLabel(team) + '.');
    awardFreeKick(team, spot);
    stopPause = SIDE_STOPPAGE_MS;
    showStoppage('TIRO DE META', teamLabel(team) + ' vai repor.');
  }

  function applyPendingInstructions() {
    players.forEach((p) => {
      if (p.pendingInstruction != null) {
        p.instruction = p.pendingInstruction;
        if (p.instruction !== 'individual') p.markTarget = null;
        p.pendingInstruction = null;
      }
    });
  }

  function awardFreeKick(team, spot) {
    applyPendingInstructions();
    ball.x = spot.x; ball.y = spot.y;
    ball.vx = 0; ball.vy = 0;
    ball.owner = null; ball.kickerImmune = null; ball.kickCooldown = 0;
    ball.freeKickBonus = false;
    ball.assistCandidate = null;
    ball.restartKind = null;
    clampBall();

    let teamPlayers = players.filter(p => p.team === team && p.role !== 'GK' && p.staggerMs <= 0);
    if (!teamPlayers.length) teamPlayers = players.filter(p => p.team === team && p.role !== 'GK');
    if (!teamPlayers.length) return false;
    const goalY = team === 'home' ? 8 : FIELD_H - 8;
    const distToGoal = Math.abs(spot.y - goalY);

    let taker = null;
    if (distToGoal < CLOSE_FK_RANGE) taker = teamPlayers.find(p => p.traits.includes('batedor_perto'));
    else if (distToGoal < LONG_FK_RANGE) taker = teamPlayers.find(p => p.traits.includes('batedor_longe'));
    if (!taker) taker = nearestTo(teamPlayers, spot) || teamPlayers[0];

    const forward = team === 'home' ? -1 : 1;
    taker.x = Math.max(CLAMP_X_MIN, Math.min(CLAMP_X_MAX, spot.x));
    taker.y = Math.max(CLAMP_Y_MIN, Math.min(CLAMP_Y_MAX, spot.y + forward * 6));
    taker.vx = 0; taker.vy = 0;
    taker.facing = { x: 0, y: forward };
    ball.owner = taker;
    ball.freeKickBonus = distToGoal < LONG_FK_RANGE &&
      (taker.traits.includes('batedor_perto') || taker.traits.includes('batedor_longe'));

    return pushBackDefenders(team, spot);
  }

  function pushAwayFromSpot(p, spot) {
    const dx = p.x - spot.x, dy = p.y - spot.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < WALL_MIN_DIST) {
      const scale = WALL_MIN_DIST / d;
      p.x = Math.max(CLAMP_X_MIN, Math.min(CLAMP_X_MAX, spot.x + dx * scale));
      p.y = Math.max(CLAMP_Y_MIN, Math.min(CLAMP_Y_MAX, spot.y + dy * scale));
      p.vx = 0; p.vy = 0;
    }
  }

  function pushBackDefenders(attackingTeam, spot) {
    const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';
    const defenders = players.filter(p => p.team === defendingTeam && p.role !== 'GK');
    if (!defenders.length) return false;

    const goalY = defendingTeam === 'home' ? FIELD_H - 8 : 8;
    const distToGoal = Math.abs(spot.y - goalY);
    const wallSize = distToGoal < CLOSE_FK_RANGE ? 4 : distToGoal < LONG_FK_RANGE ? 2 : 0;

    if (wallSize > 0) {
      const dirX = 200 - spot.x, dirY = goalY - spot.y;
      const len = Math.hypot(dirX, dirY) || 1;
      const ux = dirX / len, uy = dirY / len;
      const wallCenterX = spot.x + ux * WALL_MIN_DIST;
      const wallCenterY = spot.y + uy * WALL_MIN_DIST;
      const perpX = -uy, perpY = ux;

      const size = Math.min(wallSize, defenders.length);
      const wallPlayers = defenders.slice().sort((a, b) => dist(a, spot) - dist(b, spot)).slice(0, size);
      wallPlayers.forEach((p, i) => {
        const offset = (i - (size - 1) / 2) * (PLAYER_R * 2 + 4);
        p.x = Math.max(CLAMP_X_MIN, Math.min(CLAMP_X_MAX, wallCenterX + perpX * offset));
        p.y = Math.max(CLAMP_Y_MIN, Math.min(CLAMP_Y_MAX, wallCenterY + perpY * offset));
        p.vx = 0; p.vy = 0;
      });
      defenders.filter(p => !wallPlayers.includes(p)).forEach(p => pushAwayFromSpot(p, spot));
      return true;
    }
    defenders.forEach(p => pushAwayFromSpot(p, spot));
    return false;
  }

  function isInPenaltyBox(spot, attackingTeam) {
    const inX = spot.x >= GOAL_L - 40 && spot.x <= GOAL_R + 40;
    if (!inX) return false;
    return attackingTeam === 'home' ? spot.y <= 100 : spot.y >= FIELD_H - 100;
  }

  function forceInjurySub(p) {
    narrate('Lesão! ' + displayName(p) + ' sente dores e não aguenta continuar.');
    if (p.team === 'home' && p.squadId && homeSquad && window.WSPSquad) {
      const squadPlayer = homeSquad.players.find((sp) => sp.id === p.squadId);
      if (squadPlayer) {
        const severity = pickInjurySeverity();
        const reduction = deptReduction(INJURY_DEPTS, 0.03, 0.6);
        const days = Math.max(1, severity.days * (1 - reduction));
        const dayMs = (window.WSPCalendar && window.WSPCalendar.GAME_DAY_REAL_MS) || (2 * 60 * 60 * 1000);
        window.WSPSquad.setInjury(squadPlayer, Date.now() + days * dayMs, severity.label);
        window.WSPSquad.saveSquad(homeSquad);
        narrate(displayName(p) + ' sofreu uma ' + severity.label + ' e vai desfalcar o time nos próximos jogos.');
        matchInjuriesThisGame.push({ name: displayName(p), label: severity.label });
      }
    }
    if (p.team === 'home' && homeSubsUsed < MAX_SUBS && homeBench.length) {
      makeHomeSubstitution(p, homeBench[0]);
    } else if (p.team === 'away' && awaySubsUsed < MAX_SUBS && awayBench.length) {
      const benchPlayer = awayBench.shift();
      const result = substitutePlayer(p, benchPlayer);
      if (result) awaySubsUsed++;
    } else {
      sendOff(p);
      narrate(teamLabel(p.team) + ' fica com um a menos em campo após a lesão.');
    }
  }

  function checkInjury(hard, victim) {
    if (!hard) return;
    const reduction = victim.team === 'home' ? deptReduction(INJURY_DEPTS, 0.06, 0.65) : 0;
    if (Math.random() < INJURY_CHANCE_HARD_FOUL * (1 - reduction)) forceInjurySub(victim);
  }

  function commitFoul(defender, attackerWithBall) {
    const spot = { x: ball.x, y: ball.y };
    if (isInPenaltyBox(spot, attackerWithBall.team)) {
      commitPenaltyFoul(defender, attackerWithBall, spot);
      return;
    }

    const hard = Math.random() < HARD_FOUL_SHARE;
    const roll = Math.random();
    let cardResult = null;
    if (hard) {
      if (roll < RED_CHANCE_HARD) cardResult = bookPlayer(defender, true);
      else if (roll < RED_CHANCE_HARD + YELLOW_CHANCE_HARD) cardResult = bookPlayer(defender, false);
    } else if (roll < YELLOW_CHANCE_NORMAL) {
      cardResult = bookPlayer(defender, false);
    }
    if (hard) attackerWithBall.staggerMs = STAGGER_MS;

    let sub = hard ? 'Falta dura' : 'Falta';
    if (cardResult === 'yellow') sub += ' — cartão amarelo p/ ' + displayName(defender);
    else if (cardResult === 'red') sub += ' — cartão vermelho p/ ' + displayName(defender);
    else if (cardResult === 'red2') sub += ' — 2º amarelo, vermelho p/ ' + displayName(defender);

    narrate((hard ? 'Falta dura de ' : 'Falta de ') + displayName(defender) + ' em ' + displayName(attackerWithBall) + '.' +
      (cardResult ? ' ' + (cardResult === 'yellow' ? 'Cartão amarelo' : cardResult === 'red' ? 'Cartão vermelho' : '2º amarelo, vermelho!') + ' p/ ' + displayName(defender) + '.' : ''));

    checkInjury(hard, attackerWithBall);

    // falta dura com cartão às vezes esquenta o ânimo dos dois times — vira
    // confusão, com chance de mais um jogador ser advertido e uma pausa
    // maior pra mostrar o climão (fica registrado pra pauta da entrevista)
    const triggerConfusion = hard && !!cardResult && Math.random() < CONFUSION_CHANCE;
    let confusionExtraCardColor = null;
    if (triggerConfusion) {
      matchHadConfusion = true;
      const bystanders = players.filter((p) => p.role !== 'GK' && p !== defender && p !== attackerWithBall && p.staggerMs <= 0);
      const extra = bystanders.length ? bystanders[Math.floor(Math.random() * bystanders.length)] : null;
      const extraResult = extra ? bookPlayer(extra, false) : null;
      if (extraResult) {
        confusionExtraCardColor = extraResult === 'yellow' ? '#ffd54a' : '#b02c2c';
        narrate('Confusão generalizada! Jogadores dos dois times se estranham após o lance. Cartão amarelo também p/ ' + displayName(extra) + '.');
      } else {
        narrate('Confusão generalizada! Jogadores dos dois times se estranham após o lance.');
      }
      sub += ' — confusão em campo';
    }

    const wallFormed = awardFreeKick(attackerWithBall.team, spot);
    if (wallFormed) {
      narrate(teamLabel(defender.team) + ' monta a barreira.');
      sub += ' — barreira montada';
    }
    stopPause = STOPPAGE_MS + (wallFormed ? WALL_STOPPAGE_BONUS_MS : 0) + (triggerConfusion ? CONFUSION_BONUS_MS : 0);
    showStoppage(hard ? 'FALTA DURA!' : 'FALTA!', sub);
    if (triggerConfusion) {
      drawConfusionReplay(confusionExtraCardColor);
      if (replayWrapEl) replayWrapEl.classList.remove('hidden');
    }
  }

  function commitPenaltyFoul(defender, attackerWithBall, spot) {
    const benefitsHome = attackerWithBall.team === 'home';
    narrate(benefitsHome
      ? 'Falta na área! A torcida grita por pênalti!'
      : 'Falta na área... muita reclamação, a torcida da casa fica apreensiva.');
    narrate('O árbitro vai rever o lance no VAR...');

    pendingVarReview = { defender, attackerWithBall, spot };
    stopPause = VAR_REVIEW_MS;
    showStoppage('REVISÃO NO VAR', 'O árbitro está revendo o lance...');
    if (replayCtx) {
      drawVarReplay();
      replayWrapEl.classList.remove('hidden');
    }
  }

  function resolveVarReview() {
    const { defender, attackerWithBall, spot } = pendingVarReview;
    pendingVarReview = null;
    const benefitsHome = attackerWithBall.team === 'home';

    const confirmed = Math.random() < PENALTY_VAR_CONFIRM_CHANCE;
    if (!confirmed) {
      narrate(benefitsHome
        ? 'Sem pênalti! O VAR marcou simulação de ' + displayName(attackerWithBall) + '. A torcida vaia a decisão!'
        : 'Sem pênalti! O VAR marcou simulação. Urro de alívio da torcida da casa!');
      awardFreeKick(defender.team, spot);
      stopPause = STOPPAGE_MS;
      showStoppage('SEM PÊNALTI', 'VAR: simulação de ' + displayName(attackerWithBall));
      return;
    }

    const hard = Math.random() < HARD_FOUL_SHARE;
    const roll = Math.random();
    let cardResult = null;
    if (hard) {
      if (roll < RED_CHANCE_HARD) cardResult = bookPlayer(defender, true);
      else if (roll < RED_CHANCE_HARD + YELLOW_CHANCE_HARD) cardResult = bookPlayer(defender, false);
    } else if (roll < YELLOW_CHANCE_NORMAL) {
      cardResult = bookPlayer(defender, false);
    }

    if (hard) attackerWithBall.staggerMs = STAGGER_MS;

    let cardNote = '';
    if (cardResult === 'yellow') cardNote = ' Cartão amarelo p/ ' + displayName(defender) + '.';
    else if (cardResult === 'red') cardNote = ' Cartão vermelho p/ ' + displayName(defender) + '!';
    else if (cardResult === 'red2') cardNote = ' 2º amarelo, vermelho p/ ' + displayName(defender) + '!';

    narrate('PÊNALTI CONFIRMADO' + (benefitsHome ? '! A torcida vibra!' : ' contra o ' + teamLabel('home') + '...') + cardNote);
    checkInjury(hard, attackerWithBall);
    awardPenalty(attackerWithBall.team);
  }

  // cena de perfil do árbitro checando o lance no monitor à beira do campo
  function drawVarReplay() {
    if (!replayCtx) return;
    const w = replayCanvas.width, h = replayCanvas.height;
    const groundY = h - 22;
    replayCtx.clearRect(0, 0, w, h);
    replayCtx.fillStyle = '#153020';
    replayCtx.fillRect(0, 0, w, h);
    replayCtx.fillStyle = '#2f9e44';
    replayCtx.fillRect(0, groundY, w, h - groundY);
    replayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    replayCtx.lineWidth = 2;
    replayCtx.beginPath();
    replayCtx.moveTo(0, groundY);
    replayCtx.lineTo(w, groundY);
    replayCtx.stroke();

    // monitor do VAR: uma tela pequena numa haste, com um "X" de estática
    const monitorX = w / 2 + 30, monitorY = groundY - 70;
    replayCtx.strokeStyle = '#ccc';
    replayCtx.lineWidth = 3;
    replayCtx.beginPath();
    replayCtx.moveTo(monitorX, groundY);
    replayCtx.lineTo(monitorX, monitorY + 24);
    replayCtx.stroke();
    replayCtx.fillStyle = '#0e1c15';
    replayCtx.fillRect(monitorX - 20, monitorY - 16, 40, 30);
    replayCtx.strokeStyle = '#ffd54a';
    replayCtx.lineWidth = 2;
    replayCtx.strokeRect(monitorX - 20, monitorY - 16, 40, 30);
    replayCtx.beginPath();
    replayCtx.moveTo(monitorX - 14, monitorY - 10);
    replayCtx.lineTo(monitorX + 14, monitorY + 8);
    replayCtx.moveTo(monitorX + 14, monitorY - 10);
    replayCtx.lineTo(monitorX - 14, monitorY + 8);
    replayCtx.stroke();

    // árbitro parado de frente pro monitor, mão no fone
    drawSideFigure(replayCtx, monitorX - 46, groundY, '#111', 'parado');
  }

  // lance de perigo: goleiro pega um chute perigoso do adversário — só
  // uma fração vira pausa+replay, senão toda defesa de rotina interromperia
  // o jogo
  function triggerGreatSave(keeper, shooter) {
    if (greatSaveCooldownMs > 0 || Math.random() > GREAT_SAVE_CHANCE) return;
    greatSaveCooldownMs = GREAT_SAVE_COOLDOWN_MS;
    narrate('DEFESAÇO! ' + displayName(keeper) + ' faz uma grande defesa em cima de ' + displayName(shooter) + '!');
    stopPause = Math.max(stopPause, GREAT_SAVE_STOPPAGE_MS);
    showStoppage('DEFESAÇO!', displayName(keeper) + ' evita o gol de ' + displayName(shooter) + '!');
    if (replayCtx) {
      drawSaveReplay(keeper, shooter);
      replayWrapEl.classList.remove('hidden');
    }
  }

  function drawSaveReplay(keeper, shooter) {
    if (!replayCtx) return;
    const w = replayCanvas.width, h = replayCanvas.height;
    const groundY = h - 22;
    replayCtx.clearRect(0, 0, w, h);
    replayCtx.fillStyle = '#153020';
    replayCtx.fillRect(0, 0, w, h);
    replayCtx.fillStyle = '#2f9e44';
    replayCtx.fillRect(0, groundY, w, h - groundY);
    replayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    replayCtx.lineWidth = 2;
    replayCtx.beginPath();
    replayCtx.moveTo(0, groundY);
    replayCtx.lineTo(w, groundY);
    replayCtx.stroke();

    const postX = w - 66, postTopY = groundY - 86, crossX = w - 20, crossY = postTopY + 16;
    replayCtx.fillStyle = 'rgba(255,255,255,0.12)';
    replayCtx.beginPath();
    replayCtx.moveTo(postX, groundY);
    replayCtx.lineTo(postX, postTopY);
    replayCtx.lineTo(crossX, crossY);
    replayCtx.lineTo(crossX, groundY);
    replayCtx.closePath();
    replayCtx.fill();
    replayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    replayCtx.lineWidth = 1;
    replayCtx.beginPath();
    for (let i = 1; i < 6; i++) {
      const tt = i / 6;
      const x1 = postX + (crossX - postX) * tt, y1 = postTopY + (crossY - postTopY) * tt;
      replayCtx.moveTo(x1, y1);
      replayCtx.lineTo(x1, groundY);
    }
    for (let gy = postTopY + 12; gy < groundY; gy += 12) {
      replayCtx.moveTo(postX, gy);
      replayCtx.lineTo(crossX, gy);
    }
    replayCtx.stroke();
    replayCtx.strokeStyle = '#fff';
    replayCtx.lineWidth = 4;
    replayCtx.beginPath();
    replayCtx.moveTo(postX, groundY);
    replayCtx.lineTo(postX, postTopY);
    replayCtx.lineTo(crossX, crossY);
    replayCtx.stroke();

    const shooterColor = shooter.team === 'home' ? homeColors.primary : '#b02c2c';
    drawSideFigure(replayCtx, 60, groundY, shooterColor, 'chute');
    // goleiro espalmando — a bola para na altura da mão dele, não dentro da rede
    drawSideFigure(replayCtx, postX - 22, groundY, '#a05a2c', 'goleiro');
    replayCtx.fillStyle = '#fff';
    replayCtx.beginPath();
    replayCtx.arc(postX - 6, groundY - 44, 6, 0, Math.PI * 2);
    replayCtx.fill();
    replayCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    replayCtx.lineWidth = 1;
    replayCtx.stroke();
  }

  function awardPenalty(team) {
    const penaltySpot = { x: 200, y: team === 'home' ? 78 : FIELD_H - 78 };
    ball.x = penaltySpot.x; ball.y = penaltySpot.y;
    ball.vx = 0; ball.vy = 0;
    ball.owner = null; ball.kickerImmune = null; ball.kickCooldown = 0;
    ball.assistCandidate = null;
    clampBall();

    const teamPlayers = players.filter(p => p.team === team && p.role !== 'GK');
    const taker = teamPlayers.find(p => p.traits.includes('batedor_perto'))
      || teamPlayers.find(p => p.traits.includes('batedor_longe'))
      || teamPlayers[0];
    if (!taker) {
      stopPause = STOPPAGE_MS;
      showStoppage('PÊNALTI!', teamLabel(team) + ' vai cobrar.');
      return;
    }

    taker.x = penaltySpot.x;
    taker.y = team === 'home' ? penaltySpot.y + 6 : penaltySpot.y - 6;
    taker.vx = 0; taker.vy = 0;
    taker.facing = { x: 0, y: team === 'home' ? -1 : 1 };

    pendingPenalty = { team, taker, takerName: displayName(taker) };
    stopPause = PENALTY_STOPPAGE_MS;
    showStoppage('PÊNALTI!', teamLabel(team) + ' vai cobrar — ' + displayName(taker));
  }

  function resolvePenalty() {
    const { team, taker, takerName } = pendingPenalty;
    pendingPenalty = null;
    const scored = Math.random() < PENALTY_GOAL_CHANCE;
    if (scored) {
      narrate('GOL DE PÊNALTI! ' + takerName + ' não desperdiça! ' + teamLabel(team) + ' marca.');
      taker.matchGoals++;
      lastShotOrigin = 'penalti';
      onGoal(team, true);
      return;
    }
    const savedByGK = Math.random() < 0.65;
    narrate(savedByGK
      ? 'PÊNALTI DEFENDIDO! Grande defesa do goleiro!'
      : 'PÊNALTI PERDIDO! ' + takerName + ' manda para fora!');
    const defendingTeam = team === 'home' ? 'away' : 'home';
    awardFreeKick(defendingTeam, { x: 200, y: team === 'home' ? 40 : FIELD_H - 40 });
    stopPause = STOPPAGE_MS;
    showStoppage(savedByGK ? 'DEFENDEU!' : 'PARA FORA!', '');
  }

  // ---------- Narração ----------
  function teamLabel(team) {
    if (team === 'home') return homeSquad ? homeSquad.clubName : 'Bandeirantes';
    return seasonOpponent ? seasonOpponent.name : 'Adversário';
  }
  function narrate(text) {
    const minute = Math.floor(displaySeconds / 60);
    const label = half + 'T ' + minute + "'";
    narrationLog.push({ label, text });
    if (narrationLog.length > 200) narrationLog.shift();
    tickerEl.textContent = '📢 ' + label + ' — ' + text;
    if (!narrationOverlay.classList.contains('hidden')) renderNarrationList();
  }

  // ---------- UI ----------
  function updateScoreUI() {
    scoreHomeEl.textContent = score.home;
    scoreAwayEl.textContent = score.away;
  }
  function formatClock(s) {
    s = Math.max(0, Math.min(HALF_DISPLAY_SECONDS, Math.floor(s)));
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  // ---------- Replay 2D de perfil ----------
  // desenho simples "boneco de palito" visto de lado — usado nos replays
  // de lance (gol, e depois confusão), pra dar uma cara diferente do
  // gramado visto de cima que já ocupa a tela toda no resto do tempo
  function drawSideFigure(rctx, x, groundY, color, pose) {
    rctx.strokeStyle = color;
    rctx.fillStyle = color;
    rctx.lineWidth = 4;
    rctx.lineCap = 'round';
    const headY = groundY - 40;
    rctx.beginPath();
    rctx.arc(x, headY, 7, 0, Math.PI * 2);
    rctx.fill();
    rctx.beginPath();
    rctx.moveTo(x, headY + 7);
    rctx.lineTo(x - 1, groundY - 18);
    rctx.stroke();
    if (pose === 'chute') {
      rctx.beginPath();
      rctx.moveTo(x - 1, groundY - 18);
      rctx.lineTo(x - 8, groundY);
      rctx.moveTo(x - 1, groundY - 18);
      rctx.lineTo(x + 20, groundY - 10);
      rctx.stroke();
      rctx.beginPath();
      rctx.moveTo(x, headY + 12);
      rctx.lineTo(x - 10, groundY - 26);
      rctx.moveTo(x, headY + 12);
      rctx.lineTo(x + 9, headY + 24);
      rctx.stroke();
    } else if (pose === 'goleiro') {
      // goleiro batido, esticado no chão tentando alcançar
      rctx.save();
      rctx.translate(x, groundY - 10);
      rctx.rotate(-0.5);
      rctx.beginPath();
      rctx.arc(0, -30, 7, 0, Math.PI * 2);
      rctx.fill();
      rctx.beginPath();
      rctx.moveTo(0, -23);
      rctx.lineTo(2, 0);
      rctx.moveTo(2, 0);
      rctx.lineTo(-6, 14);
      rctx.moveTo(2, 0);
      rctx.lineTo(12, 10);
      rctx.moveTo(0, -18);
      rctx.lineTo(18, -24);
      rctx.stroke();
      rctx.restore();
    } else if (pose === 'confusao') {
      // pernas fincadas, braços erguidos discutindo/empurrando
      rctx.beginPath();
      rctx.moveTo(x - 1, groundY - 18);
      rctx.lineTo(x - 7, groundY);
      rctx.moveTo(x - 1, groundY - 18);
      rctx.lineTo(x + 7, groundY);
      rctx.moveTo(x, headY + 12);
      rctx.lineTo(x - 14, headY);
      rctx.moveTo(x, headY + 12);
      rctx.lineTo(x + 14, headY);
      rctx.stroke();
    } else {
      // parado, torcendo/observando
      rctx.beginPath();
      rctx.moveTo(x - 1, groundY - 18);
      rctx.lineTo(x - 6, groundY);
      rctx.moveTo(x - 1, groundY - 18);
      rctx.lineTo(x + 6, groundY);
      rctx.moveTo(x, headY + 12);
      rctx.lineTo(x - 9, headY + 22);
      rctx.moveTo(x, headY + 12);
      rctx.lineTo(x + 9, headY + 22);
      rctx.stroke();
    }
  }

  function drawReferee(rctx, x, groundY, cardColor) {
    rctx.strokeStyle = '#111';
    rctx.fillStyle = '#111';
    rctx.lineWidth = 4;
    rctx.lineCap = 'round';
    const headY = groundY - 40;
    rctx.beginPath();
    rctx.arc(x, headY, 7, 0, Math.PI * 2);
    rctx.fill();
    rctx.beginPath();
    rctx.moveTo(x, headY + 7);
    rctx.lineTo(x, groundY - 18);
    rctx.moveTo(x, groundY - 18);
    rctx.lineTo(x - 6, groundY);
    rctx.moveTo(x, groundY - 18);
    rctx.lineTo(x + 6, groundY);
    rctx.moveTo(x, headY + 10);
    rctx.lineTo(x + 4, headY - 22);
    rctx.stroke();
    rctx.fillStyle = cardColor;
    rctx.fillRect(x - 2, headY - 34, 10, 14);
  }

  function drawConfusionReplay(extraCardColor) {
    if (!replayCtx) return;
    const w = replayCanvas.width, h = replayCanvas.height;
    const groundY = h - 22;
    replayCtx.clearRect(0, 0, w, h);
    replayCtx.fillStyle = '#153020';
    replayCtx.fillRect(0, 0, w, h);
    replayCtx.fillStyle = '#2f9e44';
    replayCtx.fillRect(0, groundY, w, h - groundY);
    replayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    replayCtx.lineWidth = 2;
    replayCtx.beginPath();
    replayCtx.moveTo(0, groundY);
    replayCtx.lineTo(w, groundY);
    replayCtx.stroke();

    drawSideFigure(replayCtx, 80, groundY, homeColors.primary, 'confusao');
    drawSideFigure(replayCtx, 106, groundY, '#b02c2c', 'confusao');
    drawSideFigure(replayCtx, 136, groundY, homeColors.primary, 'confusao');
    drawSideFigure(replayCtx, 162, groundY, '#b02c2c', 'confusao');
    drawReferee(replayCtx, 226, groundY, extraCardColor || '#ffd54a');
  }

  let replayAnimId = null;

  // t vai de 0 (bola ainda no pé do batedor) a 1 (bola na rede) — chamada a
  // cada frame da animação em vez de desenhar só o quadro final parado
  function drawGoalReplayFrame(scoringTeam, origin, t) {
    if (!replayCtx) return;
    const w = replayCanvas.width, h = replayCanvas.height;
    const groundY = h - 22;
    replayCtx.clearRect(0, 0, w, h);
    replayCtx.fillStyle = '#153020';
    replayCtx.fillRect(0, 0, w, h);
    replayCtx.fillStyle = '#2f9e44';
    replayCtx.fillRect(0, groundY, w, h - groundY);
    replayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    replayCtx.lineWidth = 2;
    replayCtx.beginPath();
    replayCtx.moveTo(0, groundY);
    replayCtx.lineTo(w, groundY);
    replayCtx.stroke();

    // moldura do gol vista de lado: trave, travessão inclinado e rede
    const postX = w - 66, postTopY = groundY - 86, crossX = w - 20, crossY = postTopY + 16;
    replayCtx.fillStyle = 'rgba(255,255,255,0.12)';
    replayCtx.beginPath();
    replayCtx.moveTo(postX, groundY);
    replayCtx.lineTo(postX, postTopY);
    replayCtx.lineTo(crossX, crossY);
    replayCtx.lineTo(crossX, groundY);
    replayCtx.closePath();
    replayCtx.fill();
    replayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    replayCtx.lineWidth = 1;
    replayCtx.beginPath();
    for (let i = 1; i < 6; i++) {
      const tt = i / 6;
      const x1 = postX + (crossX - postX) * tt, y1 = postTopY + (crossY - postTopY) * tt;
      replayCtx.moveTo(x1, y1);
      replayCtx.lineTo(x1, groundY);
    }
    for (let gy = postTopY + 12; gy < groundY; gy += 12) {
      replayCtx.moveTo(postX, gy);
      replayCtx.lineTo(crossX, gy);
    }
    replayCtx.stroke();
    replayCtx.strokeStyle = '#fff';
    replayCtx.lineWidth = 4;
    replayCtx.beginPath();
    replayCtx.moveTo(postX, groundY);
    replayCtx.lineTo(postX, postTopY);
    replayCtx.lineTo(crossX, crossY);
    replayCtx.stroke();

    // pênalti: batedor bem mais perto, sozinho com o goleiro, sem barreira.
    // falta: barreira de 2 jogadores do time que sofreu o gol entre o
    // batedor e o gol. jogo aberto: batedor mais longe, sem barreira
    const shooterX = origin === 'penalti' ? crossX - 100 : 60;
    if (origin === 'falta') {
      const wallColor = scoringTeam === 'home' ? '#b02c2c' : homeColors.primary;
      drawSideFigure(replayCtx, shooterX + 55, groundY, wallColor, 'parado');
      drawSideFigure(replayCtx, shooterX + 72, groundY, wallColor, 'parado');
    }

    // goleiro batido perto do gol, batedor com a perna do chute esticada
    drawSideFigure(replayCtx, postX - 24, groundY, '#a05a2c', 'goleiro');
    const shooterColor = scoringTeam === 'home' ? homeColors.primary : '#b02c2c';
    drawSideFigure(replayCtx, shooterX, groundY, shooterColor, 'chute');

    // bola viaja do pé do batedor até a rede, conforme o progresso t
    const ballStartX = shooterX + 20, ballStartY = groundY - 6;
    const ballEndX = crossX - 18, ballEndY = groundY - 36;
    const arcLift = Math.sin(Math.min(1, t) * Math.PI) * 18; // sobe um pouco no meio do caminho
    const ballX = ballStartX + (ballEndX - ballStartX) * t;
    const ballY = ballStartY + (ballEndY - ballStartY) * t - arcLift;
    replayCtx.fillStyle = '#fff';
    replayCtx.beginPath();
    replayCtx.arc(ballX, ballY, 6, 0, Math.PI * 2);
    replayCtx.fill();
    replayCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    replayCtx.lineWidth = 1;
    replayCtx.stroke();
  }

  function animateGoalReplay(scoringTeam, origin) {
    if (!replayCtx) return;
    if (replayAnimId) cancelAnimationFrame(replayAnimId);
    const duration = 650;
    const start = performance.now();
    function step(ts) {
      const t = Math.min(1, (ts - start) / duration);
      drawGoalReplayFrame(scoringTeam, origin, t);
      replayAnimId = t < 1 ? requestAnimationFrame(step) : null;
    }
    replayAnimId = requestAnimationFrame(step);
  }

  function showGoal(team) {
    showStoppage('GOL!', teamLabel(team) + ' marcou!');
    if (replayCtx) {
      replayWrapEl.classList.remove('hidden');
      animateGoalReplay(team, lastShotOrigin);
    }
  }
  function showStoppage(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub || '';
    overlayRestart.classList.add('hidden');
    if (reportBtnEl) reportBtnEl.classList.add('hidden');
    breakActionsEl.classList.add('hidden');
    ratingsSectionEl.classList.add('hidden');
    if (replayWrapEl) replayWrapEl.classList.add('hidden');
    if (replayAnimId) { cancelAnimationFrame(replayAnimId); replayAnimId = null; }
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }
  function computeTeamRating(golsFor, golsAgainst) {
    const diff = golsFor - golsAgainst;
    return Math.max(2, Math.min(10, 6 + diff * 0.6));
  }
  function computePlayerRating(p) {
    let rating = 6 + (p.matchGoals || 0) * 1.2;
    if (p.redCard) rating -= 1.5;
    else if ((p.yellowCards || 0) >= 1) rating -= 0.4;
    rating += (Math.random() - 0.5) * 0.6;
    return Math.max(3, Math.min(10, rating));
  }
  function ratingTier(rating) {
    if (rating >= 7.5) return 'high';
    if (rating >= 5.5) return 'mid';
    return 'low';
  }
  function renderMatchRatings() {
    const teamRating = computeTeamRating(score.home, score.away);
    ratingsTeamEl.innerHTML = '';
    const teamLabelSpan = document.createElement('span');
    teamLabelSpan.textContent = 'Nota do time';
    ratingsTeamEl.appendChild(teamLabelSpan);
    const teamChip = document.createElement('span');
    teamChip.className = 'rating-chip ' + ratingTier(teamRating);
    teamChip.textContent = teamRating.toFixed(1);
    ratingsTeamEl.appendChild(teamChip);

    ratingsListEl.innerHTML = '';
    matchParticipants.filter(p => p.team === 'home').forEach((p) => {
      const rating = computePlayerRating(p);
      const row = document.createElement('div');
      row.className = 'rating-row';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = '#' + p.number;
      row.appendChild(num);
      const nm = document.createElement('span');
      nm.className = 'nm';
      let suffix = '';
      if (p.matchGoals) suffix += ' ' + '⚽'.repeat(Math.min(p.matchGoals, 3));
      if (p.redCard) suffix += ' 🟥';
      else if (p.yellowCards) suffix += ' 🟨';
      nm.textContent = displayName(p) + suffix;
      row.appendChild(nm);
      const chip = document.createElement('span');
      chip.className = 'rating-chip ' + ratingTier(rating);
      chip.textContent = rating.toFixed(1);
      row.appendChild(chip);
      ratingsListEl.appendChild(row);
    });
  }
  // ---------- Coletiva de imprensa pós-jogo ----------
  // várias perguntas por situação, pra não repetir sempre a mesma — a que se
  // encaixa num evento específico da partida (lesão, expulsão) tem prioridade
  // sobre as genéricas de resultado
  const PRESS_RESULT_TOPICS = {
    vitoria: [
      {
        question: 'Técnico, como você avalia a atuação da equipe hoje?',
        answers: [
          { text: 'Fizemos um jogo espetacular, o elenco merece todo o crédito.', delta: 3, reaction: 'A torcida recebe bem a declaração — o elenco sai confiante.' },
          { text: 'Vencemos, mas ainda temos pontos a melhorar.', delta: 1, reaction: 'Resposta equilibrada, bem recebida pela imprensa.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      },
      {
        question: 'Essa vitória aproxima o time dos objetivos da temporada?',
        answers: [
          { text: 'Sim, estamos no caminho certo pra brigar lá em cima.', delta: 2, reaction: 'Declaração ambiciosa anima o grupo.' },
          { text: 'Um passo de cada vez, sem contar com o que ainda não veio.', delta: 1, reaction: 'Tom cauteloso, bem recebido pela diretoria.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      },
    ],
    empate: [
      {
        question: 'O time saiu de campo com uma sensação de "podia ser mais". Qual sua leitura, técnico?',
        answers: [
          { text: 'Lutamos até o fim, o empate foi um resultado justo.', delta: 1, reaction: 'Tom equilibrado — o elenco absorve bem a mensagem.' },
          { text: 'Deveríamos ter vencido, saio frustrado com o resultado.', delta: -1, reaction: 'A autocrítica pesa um pouco no humor do grupo.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      },
      {
        question: 'Faltou algo pontual pra sair com os três pontos hoje?',
        answers: [
          { text: 'Faltou capricho nas finalizações, isso a gente treina.', delta: 1, reaction: 'Resposta técnica, o grupo aceita bem a cobrança específica.' },
          { text: 'A arbitragem atrapalhou o nosso resultado.', delta: -2, reaction: 'Culpar a arbitragem não convence — a imprensa cobra mais no dia seguinte.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      },
    ],
    derrota: [
      {
        question: 'Mais uma derrota. Como o senhor explica o resultado, técnico?',
        answers: [
          { text: 'A responsabilidade é minha, vamos corrigir os erros.', delta: 2, reaction: 'O elenco valoriza o técnico assumir a responsabilidade.' },
          { text: 'O time deu o seu melhor, faz parte do jogo.', delta: 0, reaction: 'Resposta neutra, sem grande efeito no humor do grupo.' },
          { text: 'Fomos prejudicados, o adversário teve sorte.', delta: -3, reaction: 'Jogar a culpa pra fora não cai bem — o grupo sente a fuga de responsabilidade.' },
        ],
      },
      {
        question: 'A torcida já começa a cobrar. O senhor teme pelo cargo?',
        answers: [
          { text: 'Meu compromisso é com o trabalho, vamos reverter isso treinando.', delta: 2, reaction: 'Postura firme tranquiliza o vestiário.' },
          { text: 'Isso não depende de mim, é decisão da diretoria.', delta: -1, reaction: 'Resposta evasiva não empolga ninguém.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      },
    ],
  };

  function pressBucketFor(golsFor, golsAgainst) {
    if (golsFor > golsAgainst) return 'vitoria';
    if (golsFor < golsAgainst) return 'derrota';
    return 'empate';
  }

  // perguntas ligadas a um evento específico da própria partida — quando
  // existem, entram na roda junto com as genéricas de resultado
  function pressEventTopics() {
    const topics = [];
    const homePlayers = matchParticipants.filter((p) => p.team === 'home');

    if (matchInjuriesThisGame.length) {
      const inj = matchInjuriesThisGame[0];
      topics.push({
        question: 'A saída de ' + inj.name + ' por lesão preocupa pros próximos jogos?',
        answers: [
          { text: 'Vamos cuidar dele com calma no departamento médico, sem pressa.', delta: 1, reaction: 'Postura responsável com a saúde do elenco é bem vista.' },
          { text: 'É um desfalque sensível, vamos sentir a falta dele.', delta: -1, reaction: 'A preocupação pública deixa o grupo um pouco tenso.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      });
    }

    if (matchHadConfusion) {
      topics.push({
        question: 'Rolou confusão em campo hoje — como o senhor avalia o climão entre os times?',
        answers: [
          { text: 'Faz parte do jogo, o importante é manter o foco na bola.', delta: 1, reaction: 'Resposta serena, passa tranquilidade pro grupo.' },
          { text: 'O outro time provocou, meus jogadores só reagiram.', delta: -1, reaction: 'Declaração inflamada pode esquentar ainda mais o clima pro próximo confronto.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      });
    }

    const sentOff = homePlayers.find((p) => p.redCard);
    if (sentOff) {
      topics.push({
        question: 'A expulsão de ' + displayName(sentOff) + ' pesou no resultado?',
        answers: [
          { text: 'Jogar com um a menos sempre pesa, mas não é desculpa.', delta: 1, reaction: 'Resposta madura, sem terceirizar a responsabilidade.' },
          { text: 'A arbitragem exagerou no rigor com o meu jogador.', delta: -1, reaction: 'A reclamação pública não cai bem com a arbitragem local.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      });
    }

    const rated = homePlayers.map((p) => ({ p, rating: computePlayerRating(p) })).sort((a, b) => b.rating - a.rating);
    if (rated.length && rated[0].rating >= 7.5) {
      const star = rated[0].p;
      topics.push({
        question: 'Como foi a atuação de ' + displayName(star) + ' hoje?',
        answers: [
          { text: 'Ele está num momento espetacular, merece reconhecimento.', delta: 2, reaction: 'Elogio público valoriza o jogador e anima o elenco.' },
          { text: 'É um jogador do time, o mérito é coletivo.', delta: 1, reaction: 'Resposta institucional, bem recebida.' },
          { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
        ],
      });
    }

    topics.push({
      question: 'Vocês pretendem reforçar o elenco no próximo mercado de contratações?',
      answers: [
        { text: 'Estamos de olho no mercado, sempre buscando evoluir.', delta: 1, reaction: 'Declaração de ambição agrada a diretoria.' },
        { text: 'O foco agora é 100% no elenco que já temos.', delta: 0, reaction: 'Resposta neutra, sem grande repercussão.' },
        { text: 'Prefiro não comentar agora.', delta: 0, reaction: 'Você evita a entrevista. Nem bem nem mal — só passou batido.' },
      ],
    });

    return topics;
  }

  function openPressConference() {
    if (!pressOverlay || !homeClub || !window.WSPClub) {
      window.location.href = 'clube.html';
      return;
    }
    const bucket = pressBucketFor(score.home, score.away);
    // eventos da própria partida (lesão, expulsão, destaque) entram em dobro
    // no sorteio, pra aparecerem com mais frequência que as genéricas quando existem
    const eventTopics = pressEventTopics();
    const pool = [].concat(PRESS_RESULT_TOPICS[bucket], eventTopics, eventTopics);
    const content = pool[Math.floor(Math.random() * pool.length)];
    pressQuestionEl.textContent = content.question;
    pressReactionEl.classList.add('hidden');
    pressContinueBtn.classList.add('hidden');
    pressAnswersEl.innerHTML = '';
    content.answers.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = 'press-answer-btn';
      btn.textContent = a.text;
      btn.addEventListener('click', () => {
        Array.from(pressAnswersEl.children).forEach((c) => { c.disabled = true; });
        window.WSPClub.adjustMorale(homeClub, a.delta);
        pressReactionEl.textContent = a.reaction;
        pressReactionEl.classList.remove('hidden');
        pressContinueBtn.classList.remove('hidden');
      });
      pressAnswersEl.appendChild(btn);
    });
    overlay.classList.add('hidden');
    pressOverlay.classList.remove('hidden');
  }
  if (pressContinueBtn) {
    pressContinueBtn.addEventListener('click', () => { window.location.href = 'clube.html'; });
  }

  function showFullTime() {
    if (homeSquad && window.WSPSquad) {
      const homeParticipants = matchParticipants.filter((p) => p.team === 'home' && p.squadId);
      homeParticipants.forEach((p) => {
        const squadPlayer = homeSquad.players.find((sp) => sp.id === p.squadId);
        if (squadPlayer && (p.matchGoals || p.matchAssists)) {
          squadPlayer.careerGoals = (squadPlayer.careerGoals || 0) + p.matchGoals;
          squadPlayer.careerAssists = (squadPlayer.careerAssists || 0) + p.matchAssists;
        }
      });
      const fisicaReduction = deptReduction(FATIGUE_DEPTS, 0.04, 0.5);
      window.WSPSquad.applyMatchConditionDrop(homeSquad, homeParticipants.map((p) => p.squadId), fisicaReduction);
      window.WSPSquad.saveSquad(homeSquad);
    }

    overlayTitle.textContent = 'FIM DE JOGO';
    let sub = `${teamLabel('home')} ${score.home} - ${score.away} ${teamLabel('away')}`;
    if (homeClub && window.WSPClub) {
      const revenue = window.WSPClub.payMatchRevenue(homeClub);
      const torcidaLabel = homeClub.torcidaName || 'torcida';
      sub += `\nRenda de bilheteria (${torcidaLabel}): +${formatMoneyBRL(revenue.revenue)}`;
      const expenses = window.WSPClub.payMatchExpenses(homeClub, homeSquad);
      sub += `\nDespesas da partida: -${formatMoneyBRL(expenses.total)} (caixa: ${formatMoneyBRL(homeClub.budget)})`;
    }
    if (window.WSPTrail) window.WSPTrail.addMatchResult(score.home, score.away);
    if (seasonMode) {
      try {
        localStorage.setItem('wsp_season_result', JSON.stringify({ golsUser: score.home, golsRival: score.away }));
      } catch (e) { /* storage unavailable */ }
    }
    if (window.WSPCalendar && homeClub) {
      const cal = window.WSPCalendar.loadCalendar();
      window.WSPCalendar.registerMatchResult(cal, {
        clube: (homeSquad && homeSquad.clubName) || 'Seu time',
        adv: teamLabel('away'),
        golsFor: score.home,
        golsAgainst: score.away,
        competition: seasonMode ? 'Temporada' : 'Amistoso',
      });
    }
    overlayRestart.textContent = 'Coletiva de Imprensa';
    overlaySub.textContent = sub;
    renderMatchRatings();
    ratingsSectionEl.classList.remove('hidden');
    overlayRestart.classList.remove('hidden');
    if (reportBtnEl) reportBtnEl.classList.remove('hidden');
    breakActionsEl.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
  function formatMoneyBRL(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }
  function showBreak() {
    overlayTitle.textContent = breakKind === 'halftime' ? 'INTERVALO' : 'PARADA TÉCNICA';
    overlayRestart.classList.add('hidden');
    if (reportBtnEl) reportBtnEl.classList.add('hidden');
    breakActionsEl.classList.remove('hidden');
    ratingsSectionEl.classList.add('hidden');
    overlay.classList.remove('hidden');
    updateBreakSub();
  }
  function updateBreakSub() {
    const secsLeft = Math.max(0, Math.ceil(breakTimer / 1000));
    overlaySub.textContent = `Voltamos em ${secsLeft}s... aproveite para ajustar o time:`;
  }

  // ---------- Render ----------
  function drawField() {
    ctx.fillStyle = '#2f9e44';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) ctx.fillRect(0, (FIELD_H / 10) * i, FIELD_W, FIELD_H / 10);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, FIELD_W - 20, FIELD_H - 20);
    ctx.beginPath();
    ctx.moveTo(10, FIELD_H / 2); ctx.lineTo(FIELD_W - 10, FIELD_H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(FIELD_W / 2, FIELD_H / 2, 55, 0, Math.PI * 2);
    ctx.stroke();

    // penalty boxes
    ctx.strokeRect(GOAL_L - 40, 10, GOAL_W + 80, 90);
    ctx.strokeRect(GOAL_L - 40, FIELD_H - 100, GOAL_W + 80, 90);

    // gols — a boca do gol fica em cima da linha de fundo de verdade (a
    // borda do retângulo do campo, em y=10/FIELD_H-10) e a rede se estende
    // pra FORA do campo, como um gol de verdade; o canvas tem uma margem
    // extra (GOAL_NET_DEPTH em cima e embaixo, ver render()) pra isso caber
    drawGoalNet(10, -GOAL_NET_DEPTH);
    drawGoalNet(FIELD_H - 10, GOAL_NET_DEPTH);
  }

  // frontY = linha do gol; depthSign = pra onde a rede "entra" no campo
  function drawGoalNet(frontY, depthSign) {
    const backY = frontY + depthSign;
    const top = Math.min(frontY, backY), bottom = Math.max(frontY, backY);

    const grad = ctx.createLinearGradient(0, frontY, 0, backY);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(GOAL_L, top, GOAL_W, bottom - top);

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = GOAL_L; x <= GOAL_R; x += 12) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = top; y <= bottom; y += 8) {
      ctx.moveTo(GOAL_L, y);
      ctx.lineTo(GOAL_R, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(GOAL_L, top, GOAL_W, bottom - top);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(GOAL_L, frontY);
    ctx.lineTo(GOAL_R, frontY);
    ctx.stroke();
  }

  function drawOffsideLine() {
    const attacker = ball.owner;
    if (!attacker || attacker.role === 'GK') return;
    const inAttackHalf = attacker.team === 'home' ? attacker.y < FIELD_H / 2 : attacker.y > FIELD_H / 2;
    if (!inAttackHalf) return;
    const opp = opponentsOf(attacker.team).filter(o => o.role !== 'GK');
    if (opp.length < 2) return;
    const sorted = attacker.team === 'home'
      ? opp.slice().sort((a, b) => a.y - b.y)
      : opp.slice().sort((a, b) => b.y - a.y);
    const lineY = sorted[1].y;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,214,10,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(10, lineY);
    ctx.lineTo(FIELD_W - 10, lineY);
    ctx.stroke();
    ctx.restore();
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const homeColors = (homeClub && homeClub.colors) || { primary: '#1c1c1c', secondary: '#ffffff', detail: '#ffd54a' };
  (() => {
    const tag = document.getElementById('team-tag-home');
    if (tag && homeClub) {
      tag.style.background = (homeClub.crest && homeClub.crest.color) || homeColors.primary;
      tag.style.borderColor = homeColors.detail;
      tag.textContent = homeClub.crest.emblem;
    }
    if (pressureFillHomeEl) pressureFillHomeEl.style.background = homeColors.primary;
  })();

  function updatePressureBar() {
    const total = possessionHomeMs + possessionAwayMs;
    const homePct = total > 0 ? Math.round((possessionHomeMs / total) * 100) : 50;
    const awayPct = 100 - homePct;
    pressureFillHomeEl.style.width = homePct + '%';
    pressureFillAwayEl.style.width = awayPct + '%';
    pressureLabelHomeEl.textContent = homePct + '%';
    pressureLabelAwayEl.textContent = awayPct + '%';
  }

  function drawPlayer(p) {
    let fill = p.team === 'home' ? homeColors.primary : '#b02c2c';
    if (p.role === 'GK') fill = p.team === 'home' ? '#7a3fa0' : '#a05a2c';
    const outline = p.team === 'home' && p.role !== 'GK' ? homeColors.secondary : '#fff';

    // shadow
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 9, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // legs
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(p.x - 5, p.y + 4, 3, 8);
    ctx.fillRect(p.x + 2, p.y + 4, 3, 8);

    // torso
    const tw = 16, th = 14, tx = p.x - tw / 2, ty = p.y - 6;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, 4);
    else ctx.rect(tx, ty, tw, th);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // head
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e0b28a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.number, p.x, p.y + 1);

    if (p.improvised) {
      ctx.beginPath();
      ctx.arc(p.x + PLAYER_R - 2, p.y - PLAYER_R + 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff9800';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (p.yellowCards >= 1) {
      ctx.fillStyle = '#f5d33c';
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 1;
      ctx.fillRect(p.x - PLAYER_R - 7, p.y - PLAYER_R - 1, 5, 7);
      ctx.strokeRect(p.x - PLAYER_R - 7, p.y - PLAYER_R - 1, 5, 7);
    }

    if (ball.owner === p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,213,74,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function render() {
    ctx.fillStyle = '#2f9e44';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const zoomScale = currentGoalZoomScale();
    ctx.save();
    // desloca tudo pra baixo, abrindo uma margem em cima (canvas é mais alto
    // que FIELD_H só pra caber a rede dos gols atrás das linhas de fundo)
    ctx.translate(0, GOAL_NET_DEPTH);
    if (zoomScale !== 1) {
      ctx.translate(FIELD_W / 2, FIELD_H / 2);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-goalZoomX, -goalZoomY);
    }
    drawField();
    drawOffsideLine();
    for (const p of players) drawPlayer(p);
    drawBall();
    ctx.restore();
  }

  // ---------- Error resilience ----------
  let errorShown = false;
  function showErrorBanner(err) {
    console.error(err);
    if (errorShown) return;
    errorShown = true;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b02c2c;' +
      'color:#fff;font:11px monospace;padding:6px;z-index:9999;white-space:pre-wrap;' +
      'max-height:40vh;overflow:auto;';
    el.textContent = 'Erro no jogo: ' + (err && err.stack ? err.stack : err);
    document.body.appendChild(el);
  }
  window.addEventListener('error', (e) => showErrorBanner(e.error || e.message));

  // ---------- Main loop ----------
  function frame(ts) {
    if (lastFrame === null) lastFrame = ts;
    let dt = (ts - lastFrame) / 1000;
    lastFrame = ts;
    dt = Math.min(dt, 0.05) * speedMultiplier;

    try {
      if (!paused && !matchOver) {
        if (stopPause > 0) {
          stopPause -= dt * 1000;
          if (stopPause <= 0) {
            goalZoomActive = false;
            if (pendingKickoffReset) { resetPositions(true); pendingKickoffReset = false; }
            hideOverlay();
            if (pendingVarReview) resolveVarReview();
            else if (pendingPenalty) resolvePenalty();
          }
        } else if (breakKind) {
          breakTimer -= dt * 1000;
          if (breakTimer <= 0) {
            if (breakKind === 'halftime') {
              startSecondHalf();
            } else {
              breakKind = null;
              hideOverlay();
            }
          } else {
            updateBreakSub();
          }
        } else {
          const homeOutfield = [], awayOutfield = [];
          for (const p of players) {
            if (p.role === 'GK') continue;
            (p.team === 'home' ? homeOutfield : awayOutfield).push(p);
          }
          for (const p of players) {
            const teamOutfield = p.team === 'home' ? homeOutfield : awayOutfield;
            const oppOutfield = p.team === 'home' ? awayOutfield : homeOutfield;
            updatePlayer(p, dt, teamOutfield, oppOutfield);
          }
          ballCarrierAIAct(dt);
          updateBall(dt);

          const possessor = ball.owner || ball.lastToucher;
          if (possessor) {
            if (possessor.team === 'home') possessionHomeMs += dt * 1000;
            else possessionAwayMs += dt * 1000;
          }

          displaySeconds += dt * CLOCK_SCALE;
          timerEl.textContent = formatClock(displaySeconds);

          const minute = Math.floor(displaySeconds / 60);
          if (half === 2 && awaySubWindowIdx < awaySubMinutes.length && minute >= awaySubMinutes[awaySubWindowIdx]) {
            makeAwaySubstitution();
            awaySubWindowIdx++;
          }
          if (minute !== awayPostureAppliedMinute) {
            awayPostureAppliedMinute = minute;
            updateAwayPosture(minute);
          }
          if (!techTimeoutDone && minute >= TECH_TIMEOUT_MINUTE) {
            techTimeoutDone = true;
            breakKind = 'tech';
            breakTimer = TECH_TIMEOUT_REAL_SECONDS * 1000;
            narrate('Parada técnica.');
            showBreak();
          } else if (displaySeconds >= HALF_DISPLAY_SECONDS) {
            if (half === 1) {
              breakKind = 'halftime';
              breakTimer = HALFTIME_REAL_SECONDS * 1000;
              narrate('Fim de primeiro tempo. ' + teamLabel('home') + ' ' + score.home + ' x ' + score.away + ' ' + teamLabel('away') + '.');
              showBreak();
            } else {
              matchOver = true;
              narrate('Fim de jogo! ' + teamLabel('home') + ' ' + score.home + ' x ' + score.away + ' ' + teamLabel('away') + '.');
              showFullTime();
            }
          }
        }
      }
    } catch (err) {
      showErrorBanner(err);
    }

    try {
      render();
    } catch (err) {
      showErrorBanner(err);
    }

    sidePanelRefreshMs -= dt * 1000;
    if (sidePanelRefreshMs <= 0) {
      sidePanelRefreshMs = 800;
      try { renderSideInstructions(); } catch (err) { showErrorBanner(err); }
    }

    pressureRefreshMs -= dt * 1000;
    if (pressureRefreshMs <= 0) {
      pressureRefreshMs = 1000;
      try { updatePressureBar(); } catch (err) { showErrorBanner(err); }
    }

    if (duelCooldownMs > 0) duelCooldownMs -= dt * 1000;
    if (greatSaveCooldownMs > 0) greatSaveCooldownMs -= dt * 1000;
    if (duelVisibleMs > 0) {
      duelVisibleMs -= dt * 1000;
      if (duelVisibleMs <= 0) duelPopupEl.classList.add('hidden');
    }

    requestAnimationFrame(frame);
  }

  if (window.WSPCalendar) {
    const cal = window.WSPCalendar.loadCalendar();
    if (!window.WSPCalendar.isMatchAvailable(cal)) {
      window.location.href = 'clube.html';
    } else {
      resetMatch();
      requestAnimationFrame(frame);
    }
  } else {
    resetMatch();
    requestAnimationFrame(frame);
  }
})();
