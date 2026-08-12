(() => {
  'use strict';

  // ---------- Config ----------
  const FIELD_W = 400, FIELD_H = 711;
  const GOAL_W = 120;
  const GOAL_L = (FIELD_W - GOAL_W) / 2, GOAL_R = GOAL_L + GOAL_W;
  const WALL_MIN = 14, WALL_MAX = FIELD_W - 14;
  const PLAYER_R = 13, BALL_R = 7;
  const CLAMP_Y_MIN = 16, CLAMP_Y_MAX = FIELD_H - 16;
  const CLAMP_X_MIN = 16, CLAMP_X_MAX = FIELD_W - 16;

  const USER_SPEED = 145;      // px/sec, controlled player
  const TEAMMATE_SPEED = 105;  // px/sec, AI support
  const CHASER_SPEED = 120;    // px/sec, AI chasing ball
  const GK_SPEED = 90;

  const PICKUP_R = PLAYER_R + BALL_R + 2;
  const SHOOT_POWER = 300, PASS_POWER = 220, CLEAR_POWER = 260;
  const KICK_COOLDOWN_MS = 300;
  const AI_DECISION_MIN_MS = 500, AI_DECISION_MAX_MS = 1100;

  // ---------- Clock ----------
  // Each half shows 46 game-minutes on the scoreboard, compressed into
  // HALF_REAL_SECONDS of actual wall-clock play.
  const HALF_REAL_SECONDS = 110; // 1:50
  const HALF_DISPLAY_MINUTES = 46;
  const HALF_DISPLAY_SECONDS = HALF_DISPLAY_MINUTES * 60;
  const CLOCK_SCALE = HALF_DISPLAY_SECONDS / HALF_REAL_SECONDS; // game-seconds per real-second
  const TECH_TIMEOUT_MINUTE = 23;
  const TECH_TIMEOUT_REAL_SECONDS = 10;
  const HALFTIME_REAL_SECONDS = 15;

  // ---------- Fouls / cards / offside ----------
  const FOUL_CHANCE = 0.015;       // per-frame chance a tackle attempt is a foul
  const STEAL_CHANCE = 0.06;       // per-frame chance of a clean steal (unchanged)
  const HARD_FOUL_SHARE = 0.25;    // fraction of fouls that come in hard
  const YELLOW_CHANCE_NORMAL = 0.15;
  const YELLOW_CHANCE_HARD = 0.45;
  const RED_CHANCE_HARD = 0.08;
  const STAGGER_MS = 900;          // hard foul knocks the fouled player down briefly
  const CLOSE_FK_RANGE = 150, LONG_FK_RANGE = 280;
  const WALL_MIN_DIST = 55; // minimum distance defenders are pushed back on a free kick
  const MAX_SUBS = 5;
  const STOPPAGE_MS = 1100;
  const PENALTY_VAR_CONFIRM_CHANCE = 0.75;
  const PENALTY_GOAL_CHANCE = 0.76;
  const PENALTY_STOPPAGE_MS = 1800;

  // ---------- Fadiga / lesão ----------
  const FATIGUE_RATE_PER_SEC = 0.0032;
  const FATIGUE_SPEED_PENALTY = 0.3;
  const FATIGUE_NARRATE_THRESHOLD = 0.75;
  const FATIGUE_HALFTIME_RECOVERY = 0.18;
  const INJURY_CHANCE_HARD_FOUL = 0.12;

  // ---------- Qualidade do jogador (rating 35-99) ----------
  const RATING_SPEED_BASE = 0.85;
  const RATING_SPEED_SPAN = 0.3; // multiplicador de velocidade vai de 0.85 (rating baixo) a 1.15 (rating alto)
  function ratingSpeedMult(rating) {
    return RATING_SPEED_BASE + ((rating || 60) / 100) * RATING_SPEED_SPAN;
  }

  const INSTRUCTIONS = [
    { key: 'zona', label: 'Zona' },
    { key: 'individual', label: 'Marc.' },
    { key: 'ataque', label: 'Atk+' },
    { key: 'defesa', label: 'Def+' },
    { key: 'acompanhar', label: 'Acomp' },
  ];

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
  const breakActionsEl = document.getElementById('break-actions');
  const breakTacticsBtn = document.getElementById('break-tactics-btn');
  const breakInstructionsBtn = document.getElementById('break-instructions-btn');
  const breakSubsBtn = document.getElementById('break-subs-btn');
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
  const tickerEl = document.getElementById('ticker');
  const controlsHintEl = document.getElementById('controls-hint');
  const controlsHintCloseBtn = document.getElementById('controls-hint-close');
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  const kickBtn = document.getElementById('kick-btn');

  // ---------- State ----------
  let players = [];
  let ball;
  let score = { home: 0, away: 0 };
  let paused = false;
  let speedMultiplier = 1;
  let matchOver = false;
  let stopPause = 0; // ms remaining while play is stopped (goal/falta/cartão/impedimento)
  let controlled = null;
  let lastFrame = null;
  let homeTactic = 'quatroTresTres';
  let awayTactic = 'quatroTresTres';

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
  let awaySubMinute = 15 + Math.random() * 20;

  // narração
  let narrationLog = [];
  let lastShooter = null;
  let pendingPenalty = null; // { team } enquanto uma cobrança de pênalti está em andamento

  const homeSquad = window.WSPSquad ? window.WSPSquad.loadSquad() : null;
  const homeClub = window.WSPClub ? window.WSPClub.loadClub() : null;

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

  function makePlayer(team, role, number, x, y, extra) {
    return {
      team, role, number, x, y, vx: 0, vy: 0,
      facing: { x: 0, y: team === 'home' ? -1 : 1 },
      baseX: x, baseY: y,
      instruction: 'zona', markTarget: null,
      name: (extra && extra.name) || null,
      foot: (extra && extra.foot) || 'destro',
      traits: (extra && extra.traits) || [],
      improvised: !!(extra && extra.improvised),
      squadId: (extra && extra.squadId) || null,
      yellowCards: 0, redCard: false, staggerMs: 0,
      fatigue: 0, fatigueNarrated: false,
      rating: (extra && extra.rating) || 60,
    };
  }

  function slotToXY(team, slot) {
    return { x: slot.x, y: team === 'home' ? FIELD_H - slot.d : slot.d };
  }

  function selectStarters(squad, tacticKey) {
    const buckets = tacticBuckets(tacticKey);
    const pools = { GK: [], DEF: [], MID: [], ATT: [] };
    squad.players.forEach((p) => pools[p.bucket].push(p));
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
      const { gk, outfield, bench } = selectStarters(homeSquad, tacticKey);
      homeBench = bench;
      const gkExtra = gk ? { name: gk.name, foot: gk.foot, traits: gk.traits, squadId: gk.id, rating: gk.rating } : null;
      const list = [makePlayer('home', 'GK', gk ? gk.number : 1, 200, gkY, gkExtra)];
      tactic.slots.forEach((slot, i) => {
        const { x, y } = slotToXY('home', slot);
        const entry = outfield[i];
        const extra = entry ? { name: entry.player.name, foot: entry.player.foot, traits: entry.player.traits, improvised: entry.improvised, squadId: entry.player.id, rating: entry.player.rating } : null;
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
    ball = { x: 200, y: FIELD_H / 2, vx: 0, vy: 0, owner: null, kickerImmune: null, kickCooldown: 0, aiCooldown: 0 };
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
    awaySubMinute = 15 + Math.random() * 20;
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

  // ---------- Input ----------
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (e.key === ' ') { e.preventDefault(); doKick(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  let joyVec = { x: 0, y: 0 };
  let joyActive = false, joyId = null, joyCenter = { x: 0, y: 0 };

  function joyStart(id, clientX, clientY) {
    const rect = joystickZone.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joyActive = true; joyId = id;
    joyMove(clientX, clientY);
  }
  function joyMove(clientX, clientY) {
    if (!joyActive) return;
    const dx = clientX - joyCenter.x, dy = clientY - joyCenter.y;
    const dist = Math.min(40, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * dist, ky = Math.sin(angle) * dist;
    joystickKnob.style.left = 28 + kx + 'px';
    joystickKnob.style.top = 28 + ky + 'px';
    joyVec = dist > 6 ? { x: kx / 40, y: ky / 40 } : { x: 0, y: 0 };
  }
  function joyEnd() {
    joyActive = false; joyId = null; joyVec = { x: 0, y: 0 };
    joystickKnob.style.left = '28px';
    joystickKnob.style.top = '28px';
  }

  joystickZone.addEventListener('pointerdown', (e) => { joystickZone.setPointerCapture(e.pointerId); joyStart(e.pointerId, e.clientX, e.clientY); });
  joystickZone.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e.clientX, e.clientY); });
  joystickZone.addEventListener('pointerup', (e) => { if (e.pointerId === joyId) joyEnd(); });
  joystickZone.addEventListener('pointercancel', () => joyEnd());

  kickBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); doKick(); });

  const CONTROLS_HINT_KEY = 'wsp_controls_hint_dismissed';
  try {
    if (localStorage.getItem(CONTROLS_HINT_KEY)) controlsHintEl.classList.add('hidden');
  } catch (e) { /* storage unavailable */ }
  controlsHintCloseBtn.addEventListener('click', () => {
    controlsHintEl.classList.add('hidden');
    try { localStorage.setItem(CONTROLS_HINT_KEY, '1'); } catch (e) { /* storage unavailable */ }
  });

  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '▶' : '⏸';
  });
  btnSpeed.addEventListener('click', () => {
    speedMultiplier = speedMultiplier === 1 ? 2 : 1;
    btnSpeed.style.opacity = speedMultiplier === 2 ? '0.6' : '1';
  });
  overlayRestart.addEventListener('click', () => {
    if (seasonMode) { window.location.href = 'temporada.html'; return; }
    resetMatch();
  });

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
    const outfield = players.filter(p => p.team === 'home' && p.role !== 'GK');
    outfield.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'instr-row';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = '#' + p.number;
      row.appendChild(num);
      const btnWrap = document.createElement('div');
      btnWrap.className = 'instr-btns';
      INSTRUCTIONS.forEach((opt) => {
        const b = document.createElement('button');
        b.className = 'instr-btn' + ((p.instruction || 'zona') === opt.key ? ' active' : '');
        b.textContent = opt.label;
        b.addEventListener('click', () => {
          p.instruction = opt.key;
          if (opt.key !== 'individual') p.markTarget = null;
          renderInstructionsList();
        });
        btnWrap.appendChild(b);
      });
      row.appendChild(btnWrap);
      instructionsList.appendChild(row);
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
    const onField = players.filter(p => p.team === 'home').sort((a, b) => a.number - b.number);
    onField.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'sub-player' + (subOutSelected === p ? ' selected' : '');
      btn.innerHTML = '<span class="num">' + p.number + '</span><span class="nm">' + displayNameFor(p) + '</span>';
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
    homeBench.slice().sort((a, b) => a.number - b.number).forEach((bp) => {
      const btn = document.createElement('button');
      btn.className = 'sub-player';
      btn.innerHTML = '<span class="num">' + bp.number + '</span><span class="nm">' + bp.name + '</span>';
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

  function inputVector() {
    let x = joyVec.x, y = joyVec.y;
    if (keys.has('arrowleft') || keys.has('a')) x -= 1;
    if (keys.has('arrowright') || keys.has('d')) x += 1;
    if (keys.has('arrowup') || keys.has('w')) y -= 1;
    if (keys.has('arrowdown') || keys.has('s')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

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
  }

  function clampBall() {
    ball.x = Math.max(BALL_R, Math.min(FIELD_W - BALL_R, ball.x));
    ball.y = Math.max(BALL_R, Math.min(FIELD_H - BALL_R, ball.y));
  }

  function pickPassTarget(p) {
    const mates = teammates(p.team).filter(m => m !== p && m.role !== 'GK');
    if (!mates.length) return null;

    let target = mates[0];
    for (const m of mates) {
      if (p.team === 'home' ? m.y < target.y : m.y > target.y) target = m;
    }
    return { target, power: PASS_POWER };
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
    const attackingGoalY = p.team === 'home' ? 8 : FIELD_H - 8;
    const accuracyMult = 1.3 - ((p.rating || 60) / 100) * 0.6;
    const spread = (Math.random() - 0.5) * (bonus ? 14 : 32) * accuracyMult + footBias(p.foot);
    kick(p, 200 + spread, attackingGoalY, SHOOT_POWER * (bonus ? 1.15 : 1));
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
  }

  function doKick() {
    if (matchOver || stopPause > 0) return;
    if (!ball.owner || ball.owner !== controlled) return;
    const p = controlled;
    const bonus = !!ball.freeKickBonus;
    ball.freeKickBonus = false;
    const nearGoal = p.team === 'home' ? p.y < 260 : p.y > FIELD_H - 260;
    if (nearGoal) { attemptShoot(p, bonus); return; }
    const pass = pickPassTarget(p);
    if (pass) attemptPass(p, pass);
    else attemptShoot(p, bonus);
  }

  // ---------- AI / control selection ----------
  function pickControlled(homeOutfield) {
    let best = homeOutfield[0], bestD = dist(homeOutfield[0], ball);
    for (const p of homeOutfield) {
      const d = dist(p, ball);
      if (d < bestD) { best = p; bestD = d; }
    }
    controlled = best;
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
      p.fatigue = Math.min(1, p.fatigue + dt * FATIGUE_RATE_PER_SEC * (1 - reduction));
      if (p.team === 'home' && !p.fatigueNarrated && p.fatigue >= FATIGUE_NARRATE_THRESHOLD) {
        p.fatigueNarrated = true;
        narrate(displayName(p) + ' está visivelmente cansado.');
      }
      fatigueMult = 1 - p.fatigue * FATIGUE_SPEED_PENALTY;
    }
    if (p === controlled) {
      const v = inputVector();
      p.vx = v.x * USER_SPEED;
      p.vy = v.y * USER_SPEED;
      if (v.x || v.y) p.facing = { x: v.x, y: v.y };
    } else if (p.role === 'GK') {
      const ownGoalY = p.team === 'home' ? FIELD_H - 20 : 20;
      const targetX = Math.max(GOAL_L + 14, Math.min(GOAL_R - 14, ball.x));
      const dx = targetX - p.x, dy = ownGoalY - p.y;
      const len = Math.hypot(dx, dy) || 1;
      p.vx = (dx / len) * GK_SPEED * Math.min(1, Math.abs(dx) / 10);
      p.vy = (dy / len) * GK_SPEED * Math.min(1, Math.abs(dy) / 10);
    } else {
      const chaser = nearestTo(teamOutfield, ball);
      const isChaser = chaser === p;
      const fitFactor = p.improvised ? 0.9 : 1; // out-of-position players are a bit less sharp
      if (isChaser) {
        const dx = ball.x - p.x, dy = ball.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        p.vx = (dx / len) * CHASER_SPEED * fitFactor;
        p.vy = (dy / len) * CHASER_SPEED * fitFactor;
        p.facing = { x: dx / len, y: dy / len };
      } else {
        const instr = p.instruction || 'zona';
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
          const drift = instr === 'acompanhar' ? Math.min(0.65, baseDrift + 0.3)
            : instr === 'defesa' ? Math.max(0.1, baseDrift - 0.15)
            : baseDrift;
          const forward = p.team === 'home' ? -1 : 1;
          const yBias = instr === 'ataque' ? forward * 55 : instr === 'defesa' ? -forward * 55 : 0;
          tx = p.baseX + (ball.x - 200) * drift;
          ty = p.baseY + (ball.y - p.baseY) * 0.15 + yBias;
        }
        const dx = tx - p.x, dy = ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.min(TEAMMATE_SPEED, len * 4) * fitFactor;
        p.vx = (dx / len) * speed;
        p.vy = (dy / len) * speed;
      }
    }
    if (p.role !== 'GK') {
      const combinedMult = fatigueMult * ratingSpeedMult(p.rating);
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

  function awayAIAct(dt) {
    if (ball.aiCooldown > 0) ball.aiCooldown -= dt * 1000;

    if (ball.owner && ball.owner.team === 'away' && ball.owner.role !== 'GK') {
      const p = ball.owner;
      if (p.y > FIELD_H - 260) {
        attemptShoot(p, false);
      } else if (ball.aiCooldown <= 0) {
        const pass = pickPassTarget(p);
        if (pass && Math.random() < 0.6) {
          attemptPass(p, pass);
        } else {
          p.facing = { x: 0, y: 1 };
        }
        ball.aiCooldown = AI_DECISION_MIN_MS + Math.random() * (AI_DECISION_MAX_MS - AI_DECISION_MIN_MS);
      }
    }
    if (ball.owner && ball.owner.role === 'GK') {
      const p = ball.owner;
      const forwardX = 200 + (Math.random() - 0.5) * 160;
      const forwardY = p.team === 'home' ? p.y - 240 : p.y + 240;
      kick(p, forwardX, forwardY, CLEAR_POWER);
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

      if (ball.x < WALL_MIN) { ball.x = WALL_MIN; ball.vx *= -0.55; }
      if (ball.x > WALL_MAX) { ball.x = WALL_MAX; ball.vx *= -0.55; }

      const inGoalX = ball.x > GOAL_L + BALL_R && ball.x < GOAL_R - BALL_R;
      if (ball.y < BALL_R) {
        if (inGoalX) { onGoal('home'); return; }
        ball.y = BALL_R; ball.vy *= -0.55;
      }
      if (ball.y > FIELD_H - BALL_R) {
        if (inGoalX) { onGoal('away'); return; }
        ball.y = FIELD_H - BALL_R; ball.vy *= -0.55;
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
        ball.owner = pickupCandidate;
      } else if (ball.owner !== pickupCandidate && ball.owner.team !== pickupCandidate.team) {
        const roll = Math.random();
        if (roll < FOUL_CHANCE) {
          commitFoul(pickupCandidate, ball.owner);
          return;
        } else if (roll < FOUL_CHANCE + STEAL_CHANCE) {
          ball.owner = pickupCandidate;
        }
      }
    }
    if (ball.kickCooldown <= 0) ball.kickerImmune = null;
  }

  function onGoal(scoringTeam, viaPenalty) {
    score[scoringTeam]++;
    updateScoreUI();
    if (!viaPenalty) {
      const scorer = lastShooter && lastShooter.team === scoringTeam ? displayName(lastShooter) : null;
      narrate((scorer ? 'GOL de ' + scorer + '! ' : 'GOL! ') + teamLabel(scoringTeam) + ' marca. ' + score.home + ' x ' + score.away + '.');
    }
    lastShooter = null;
    showGoal(scoringTeam);
    resetPositions(true);
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
    if (controlled === p) controlled = null;
    if (ball.owner === p) ball.owner = null;
  }

  function substitutePlayer(outPlayer, inData) {
    const idx = players.indexOf(outPlayer);
    if (idx < 0) return null;
    const extra = { name: inData.name, foot: inData.foot, traits: inData.traits || [], squadId: inData.id || null, rating: inData.rating };
    const newPlayer = makePlayer(outPlayer.team, outPlayer.role, inData.number, outPlayer.x, outPlayer.y, extra);
    newPlayer.baseX = outPlayer.baseX;
    newPlayer.baseY = outPlayer.baseY;
    newPlayer.instruction = outPlayer.instruction;
    players[idx] = newPlayer;
    if (controlled === outPlayer) controlled = newPlayer;
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
    const outPlayer = outCandidates[Math.floor(Math.random() * outCandidates.length)];
    const benchPlayer = awayBench.shift();
    const result = substitutePlayer(outPlayer, benchPlayer);
    if (result) awaySubsUsed++;
    return !!result;
  }

  function awardFreeKick(team, spot) {
    ball.x = spot.x; ball.y = spot.y;
    ball.vx = 0; ball.vy = 0;
    ball.owner = null; ball.kickerImmune = null; ball.kickCooldown = 0;
    ball.freeKickBonus = false;
    clampBall();

    let teamPlayers = players.filter(p => p.team === team && p.role !== 'GK' && p.staggerMs <= 0);
    if (!teamPlayers.length) teamPlayers = players.filter(p => p.team === team && p.role !== 'GK');
    if (!teamPlayers.length) return;
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

    pushBackDefenders(team, spot);
  }

  function pushBackDefenders(attackingTeam, spot) {
    const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';
    const defenders = players.filter(p => p.team === defendingTeam && p.role !== 'GK');
    defenders.forEach((p) => {
      const dx = p.x - spot.x, dy = p.y - spot.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < WALL_MIN_DIST) {
        const scale = WALL_MIN_DIST / d;
        p.x = Math.max(CLAMP_X_MIN, Math.min(CLAMP_X_MAX, spot.x + dx * scale));
        p.y = Math.max(CLAMP_Y_MIN, Math.min(CLAMP_Y_MAX, spot.y + dy * scale));
        p.vx = 0; p.vy = 0;
      }
    });
  }

  function isInPenaltyBox(spot, attackingTeam) {
    const inX = spot.x >= GOAL_L - 40 && spot.x <= GOAL_R + 40;
    if (!inX) return false;
    return attackingTeam === 'home' ? spot.y <= 100 : spot.y >= FIELD_H - 100;
  }

  function forceInjurySub(p) {
    narrate('Lesão! ' + displayName(p) + ' sente dores e não aguenta continuar.');
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
    awardFreeKick(attackerWithBall.team, spot);
    stopPause = STOPPAGE_MS;
    showStoppage(hard ? 'FALTA DURA!' : 'FALTA!', sub);
  }

  function commitPenaltyFoul(defender, attackerWithBall, spot) {
    const benefitsHome = attackerWithBall.team === 'home';
    narrate(benefitsHome
      ? 'Falta na área! A torcida grita por pênalti!'
      : 'Falta na área... muita reclamação, a torcida da casa fica apreensiva.');
    narrate('O árbitro vai rever o lance no VAR...');

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

  function awardPenalty(team) {
    const penaltySpot = { x: 200, y: team === 'home' ? 78 : FIELD_H - 78 };
    ball.x = penaltySpot.x; ball.y = penaltySpot.y;
    ball.vx = 0; ball.vy = 0;
    ball.owner = null; ball.kickerImmune = null; ball.kickCooldown = 0;
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

    pendingPenalty = { team, takerName: displayName(taker) };
    stopPause = PENALTY_STOPPAGE_MS;
    showStoppage('PÊNALTI!', teamLabel(team) + ' vai cobrar — ' + displayName(taker));
  }

  function resolvePenalty() {
    const { team, takerName } = pendingPenalty;
    pendingPenalty = null;
    const scored = Math.random() < PENALTY_GOAL_CHANCE;
    if (scored) {
      narrate('GOL DE PÊNALTI! ' + takerName + ' não desperdiça! ' + teamLabel(team) + ' marca.');
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
    if (narrationLog.length > 60) narrationLog.shift();
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
  function showGoal(team) {
    showStoppage('GOL!', teamLabel(team) + ' marcou!');
  }
  function showStoppage(title, sub) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub || '';
    overlayRestart.classList.add('hidden');
    breakActionsEl.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }
  function showFullTime() {
    overlayTitle.textContent = 'FIM DE JOGO';
    let sub = `${teamLabel('home')} ${score.home} - ${score.away} ${teamLabel('away')}`;
    if (homeClub && window.WSPClub) {
      const expenses = window.WSPClub.payMatchExpenses(homeClub, homeSquad);
      sub += `\nDespesas da partida: -${formatMoneyBRL(expenses.total)} (caixa: ${formatMoneyBRL(homeClub.budget)})`;
    }
    if (seasonMode) {
      try {
        localStorage.setItem('wsp_season_result', JSON.stringify({ golsUser: score.home, golsRival: score.away }));
      } catch (e) { /* storage unavailable */ }
      overlayRestart.textContent = 'Voltar à Temporada';
    }
    overlaySub.textContent = sub;
    overlayRestart.classList.remove('hidden');
    breakActionsEl.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
  function formatMoneyBRL(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }
  function showBreak() {
    overlayTitle.textContent = breakKind === 'halftime' ? 'INTERVALO' : 'PARADA TÉCNICA';
    overlayRestart.classList.add('hidden');
    breakActionsEl.classList.remove('hidden');
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

    // goals
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(GOAL_L, -14, GOAL_W, 14);
    ctx.strokeRect(GOAL_L, FIELD_H, GOAL_W, 14);
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
      tag.style.background = homeColors.primary;
      tag.style.borderColor = homeColors.detail;
      tag.textContent = homeClub.crest.emblem;
    }
  })();

  function drawPlayer(p) {
    let fill = p.team === 'home' ? homeColors.primary : '#b02c2c';
    if (p.role === 'GK') fill = p.team === 'home' ? '#7a3fa0' : '#a05a2c';

    if (p === controlled) {
      ctx.beginPath();
      ctx.arc(p.x, p.y - 22, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd54a';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = p.team === 'home' && p.role !== 'GK' ? homeColors.secondary : '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
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
    drawField();
    for (const p of players) drawPlayer(p);
    drawBall();
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
            hideOverlay();
            if (pendingPenalty) resolvePenalty();
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
          pickControlled(homeOutfield);
          for (const p of players) {
            const teamOutfield = p.team === 'home' ? homeOutfield : awayOutfield;
            const oppOutfield = p.team === 'home' ? awayOutfield : homeOutfield;
            updatePlayer(p, dt, teamOutfield, oppOutfield);
          }
          awayAIAct(dt);
          updateBall(dt);

          displaySeconds += dt * CLOCK_SCALE;
          timerEl.textContent = formatClock(displaySeconds);

          const minute = Math.floor(displaySeconds / 60);
          if (half === 2 && awaySubsUsed < 1 && minute >= awaySubMinute) {
            makeAwaySubstitution();
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
    requestAnimationFrame(frame);
  }

  resetMatch();
  requestAnimationFrame(frame);
})();
