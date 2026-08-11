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
  const MATCH_SECONDS = 120;

  // ---------- Tactics ----------
  // d = distance from own goal line (0 = own goal, FIELD_H = opponent's goal)
  // x = lateral position (0-400). Every tactic has exactly 10 outfield slots.
  const TACTICS = {
    equilibrado: {
      label: 'Equilibrado',
      drift: 0.3,
      slots: [
        { d: 150, x: 70 }, { d: 150, x: 150 }, { d: 150, x: 250 }, { d: 150, x: 330 },
        { d: 340, x: 110 }, { d: 340, x: 200 }, { d: 340, x: 290 },
        { d: 530, x: 90 }, { d: 530, x: 200 }, { d: 530, x: 310 },
      ],
    },
    ataque: {
      label: 'Ataque',
      drift: 0.35,
      slots: [
        { d: 170, x: 110 }, { d: 170, x: 200 }, { d: 170, x: 290 },
        { d: 340, x: 40 }, { d: 340, x: 360 },
        { d: 420, x: 200 },
        { d: 520, x: 60 }, { d: 520, x: 340 },
        { d: 560, x: 150 }, { d: 560, x: 250 },
      ],
    },
    ferrolho: {
      label: 'Ferrolho',
      drift: 0.15,
      slots: [
        { d: 120, x: 40 }, { d: 120, x: 110 }, { d: 120, x: 180 }, { d: 120, x: 220 }, { d: 120, x: 290 }, { d: 120, x: 360 },
        { d: 480, x: 100 }, { d: 480, x: 170 }, { d: 480, x: 230 }, { d: 480, x: 300 },
      ],
    },
    lateral: {
      label: 'Pelas Laterais',
      drift: 0.3,
      slots: [
        { d: 150, x: 50 }, { d: 150, x: 150 }, { d: 150, x: 250 }, { d: 150, x: 350 },
        { d: 330, x: 130 }, { d: 330, x: 200 }, { d: 330, x: 270 },
        { d: 520, x: 50 }, { d: 520, x: 200 }, { d: 520, x: 350 },
      ],
    },
    lancamentos: {
      label: 'Bola Longa',
      drift: 0.3,
      slots: [
        { d: 150, x: 70 }, { d: 150, x: 150 }, { d: 150, x: 250 }, { d: 150, x: 330 },
        { d: 340, x: 110 }, { d: 340, x: 200 }, { d: 340, x: 290 },
        { d: 530, x: 90 }, { d: 530, x: 200 }, { d: 530, x: 310 },
      ],
    },
  };
  const TACTIC_KEYS = Object.keys(TACTICS);

  // ---------- DOM ----------
  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d');
  const scoreHomeEl = document.getElementById('score-home');
  const scoreAwayEl = document.getElementById('score-away');
  const timerEl = document.getElementById('timer');
  const btnPause = document.getElementById('btn-pause');
  const btnSpeed = document.getElementById('btn-speed');
  const btnTactics = document.getElementById('btn-tactics');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');
  const overlayRestart = document.getElementById('overlay-restart');
  const tacticsOverlay = document.getElementById('tactics-overlay');
  const tacticsList = document.getElementById('tactics-list');
  const tacticsClose = document.getElementById('tactics-close');
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  const kickBtn = document.getElementById('kick-btn');

  // ---------- State ----------
  let players = [];
  let ball;
  let score = { home: 0, away: 0 };
  let timeLeft = MATCH_SECONDS;
  let paused = false;
  let speedMultiplier = 1;
  let matchOver = false;
  let goalPause = 0; // ms remaining while celebrating a goal
  let controlled = null;
  let lastFrame = null;
  let homeTactic = 'equilibrado';
  let awayTactic = 'equilibrado';

  function makePlayer(team, role, number, x, y) {
    return {
      team, role, number, x, y, vx: 0, vy: 0,
      facing: { x: 0, y: team === 'home' ? -1 : 1 },
      baseX: x, baseY: y,
    };
  }

  function slotToXY(team, slot) {
    return { x: slot.x, y: team === 'home' ? FIELD_H - slot.d : slot.d };
  }

  function buildTeam(team, tacticKey) {
    const tactic = TACTICS[tacticKey];
    const gkY = team === 'home' ? FIELD_H - 36 : 36;
    const list = [makePlayer(team, 'GK', 1, 200, gkY)];
    tactic.slots.forEach((slot, i) => {
      const { x, y } = slotToXY(team, slot);
      list.push(makePlayer(team, 'OUT', i + 2, x, y));
    });
    return list;
  }

  function resetPositions() {
    players = [...buildTeam('home', homeTactic), ...buildTeam('away', awayTactic)];
    ball = { x: 200, y: FIELD_H / 2, vx: 0, vy: 0, owner: null, kickerImmune: null, kickCooldown: 0 };
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
    resetPositions();
    score = { home: 0, away: 0 };
    timeLeft = MATCH_SECONDS;
    paused = false;
    speedMultiplier = 1;
    matchOver = false;
    goalPause = 0;
    hideOverlay();
    updateScoreUI();
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

  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '▶' : '⏸';
  });
  btnSpeed.addEventListener('click', () => {
    speedMultiplier = speedMultiplier === 1 ? 2 : 1;
    btnSpeed.style.opacity = speedMultiplier === 2 ? '0.6' : '1';
  });
  overlayRestart.addEventListener('click', () => resetMatch());

  let pausedByTactics = false;
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
    if (!paused) { paused = true; pausedByTactics = true; btnPause.textContent = '▶'; }
    renderTacticsList();
    tacticsOverlay.classList.remove('hidden');
  }
  function closeTacticsMenu() {
    tacticsOverlay.classList.add('hidden');
    if (pausedByTactics) { paused = false; pausedByTactics = false; btnPause.textContent = '⏸'; }
  }
  btnTactics.addEventListener('click', openTacticsMenu);
  tacticsClose.addEventListener('click', closeTacticsMenu);

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
    const tacticKey = p.team === 'home' ? homeTactic : awayTactic;
    const mates = teammates(p.team).filter(m => m !== p && m.role !== 'GK');
    if (!mates.length) return null;

    if (tacticKey === 'lancamentos') {
      // hoof it long, straight to whoever is furthest forward
      let target = mates[0];
      for (const m of mates) {
        if (p.team === 'home' ? m.y < target.y : m.y > target.y) target = m;
      }
      return { target, power: PASS_POWER * 1.35 };
    }
    if (tacticKey === 'lateral') {
      // favor the widest advanced option, hugging the touchline
      const advanced = mates.filter(m => p.team === 'home' ? m.y < p.y + 20 : m.y > p.y - 20);
      const pool = advanced.length ? advanced : mates;
      let target = pool[0];
      for (const m of pool) {
        if (Math.abs(m.x - 200) > Math.abs(target.x - 200)) target = m;
      }
      return { target, power: PASS_POWER };
    }
    let target = mates[0];
    for (const m of mates) {
      if (p.team === 'home' ? m.y < target.y : m.y > target.y) target = m;
    }
    return { target, power: PASS_POWER };
  }

  function doKick() {
    if (matchOver || goalPause > 0) return;
    if (!ball.owner || ball.owner !== controlled) return;
    const p = controlled;
    const attackingGoalY = p.team === 'home' ? 8 : FIELD_H - 8;
    const nearGoal = p.team === 'home' ? p.y < 260 : p.y > FIELD_H - 260;
    if (nearGoal) {
      const spread = (Math.random() - 0.5) * 40;
      kick(p, 200 + spread, attackingGoalY, SHOOT_POWER);
      return;
    }
    const pass = pickPassTarget(p);
    if (pass) kick(p, pass.target.x, pass.target.y, pass.power);
    else kick(p, 200, attackingGoalY, SHOOT_POWER);
  }

  // ---------- AI / control selection ----------
  function pickControlled() {
    const field = players.filter(p => p.team === 'home' && p.role !== 'GK');
    let best = field[0], bestD = dist(field[0], ball);
    for (const p of field) {
      const d = dist(p, ball);
      if (d < bestD) { best = p; bestD = d; }
    }
    controlled = best;
  }

  function updatePlayer(p, dt) {
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
      const opp = opponentsOf(p.team);
      const chaser = nearestTo(opp.length ? teammates(p.team).filter(t => t.role !== 'GK') : [], ball);
      const isChaser = chaser === p;
      if (isChaser) {
        const dx = ball.x - p.x, dy = ball.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        p.vx = (dx / len) * CHASER_SPEED;
        p.vy = (dy / len) * CHASER_SPEED;
        p.facing = { x: dx / len, y: dy / len };
      } else {
        const drift = TACTICS[p.team === 'home' ? homeTactic : awayTactic].drift;
        const tx = p.baseX + (ball.x - 200) * drift;
        const ty = p.baseY + (ball.y - p.baseY) * 0.15;
        const dx = tx - p.x, dy = ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = Math.min(TEAMMATE_SPEED, len * 4);
        p.vx = (dx / len) * speed;
        p.vy = (dy / len) * speed;
      }
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

  function awayAIAct() {
    if (ball.owner && ball.owner.team === 'away' && ball.owner.role !== 'GK') {
      const p = ball.owner;
      const goalY = FIELD_H - 8;
      if (p.y > FIELD_H - 260) {
        const spread = (Math.random() - 0.5) * 40;
        kick(p, 200 + spread, goalY, SHOOT_POWER);
      } else {
        p.facing = { x: 0, y: 1 };
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
        if (Math.random() < 0.06) ball.owner = pickupCandidate;
      }
    }
    if (ball.kickCooldown <= 0) ball.kickerImmune = null;
  }

  function onGoal(scoringTeam) {
    score[scoringTeam]++;
    updateScoreUI();
    showGoal(scoringTeam);
    resetPositions();
    goalPause = 1400;
  }

  // ---------- UI ----------
  function updateScoreUI() {
    scoreHomeEl.textContent = score.home;
    scoreAwayEl.textContent = score.away;
  }
  function formatTime(s) {
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  function showGoal(team) {
    overlayTitle.textContent = 'GOL!';
    overlaySub.textContent = team === 'home' ? 'Bandeirantes marcou!' : 'O adversário marcou.';
    overlayRestart.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }
  function showFullTime() {
    overlayTitle.textContent = 'FIM DE JOGO';
    overlaySub.textContent = `Bandeirantes ${score.home} - ${score.away} Adversário`;
    overlayRestart.classList.remove('hidden');
    overlay.classList.remove('hidden');
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

  function drawPlayer(p) {
    let fill = p.team === 'home' ? '#1c1c1c' : '#b02c2c';
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
    ctx.strokeStyle = p.team === 'home' ? '#fff' : '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.number, p.x, p.y + 1);

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
        if (goalPause > 0) {
          goalPause -= dt * 1000;
          if (goalPause <= 0) hideOverlay();
        } else {
          pickControlled();
          for (const p of players) updatePlayer(p, dt);
          awayAIAct();
          updateBall(dt);

          timeLeft -= dt;
          timerEl.textContent = formatTime(timeLeft);
          if (timeLeft <= 0) {
            matchOver = true;
            showFullTime();
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
