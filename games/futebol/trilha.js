(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_trail_v1';

  const MILESTONES = [
    { points: 150, reward: { type: 'money', amount: 2000 }, label: 'Patrocínio inicial' },
    { points: 400, reward: { type: 'money', amount: 4000 }, label: 'Apoio regional' },
    { points: 800, reward: { type: 'money', amount: 7000 }, label: 'Contrato ampliado' },
    { points: 1400, reward: { type: 'money', amount: 12000 }, label: 'Patrocínio master' },
    { points: 2200, reward: { type: 'money', amount: 18000 }, label: 'Parceria nacional' },
    { points: 3200, reward: { type: 'exclusive_crest', amount: 0 }, label: 'Patrocinador Especial' },
  ];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    return { points: 0, claimed: [] };
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function pointsForResult(golsUser, golsRival) {
    let pts = 15 * golsUser;
    if (golsUser > golsRival) pts += 100;
    else if (golsUser === golsRival) pts += 40;
    else pts += 15;
    return pts;
  }

  function addMatchResult(golsUser, golsRival) {
    const state = loadState();
    state.points += pointsForResult(golsUser, golsRival);
    saveState(state);
    return state.points;
  }

  function getProgress() {
    const state = loadState();
    return {
      points: state.points,
      milestones: MILESTONES.map((m, i) => ({
        ...m,
        index: i,
        reached: state.points >= m.points,
        claimed: state.claimed.includes(i),
      })),
    };
  }

  function claimMilestone(index) {
    const state = loadState();
    const m = MILESTONES[index];
    if (!m) return { ok: false };
    if (state.points < m.points) return { ok: false, reason: 'locked' };
    if (state.claimed.includes(index)) return { ok: false, reason: 'claimed' };
    state.claimed.push(index);
    saveState(state);
    if (window.WSPClub) {
      const club = window.WSPClub.loadClub();
      if (m.reward.type === 'money') {
        club.budget += m.reward.amount;
      } else if (m.reward.type === 'exclusive_crest') {
        club.exclusiveEmblemUnlocked = true;
        club.exclusiveJerseyUnlocked = true;
      }
      window.WSPClub.saveClub(club);
    }
    return { ok: true, reward: m.reward };
  }

  window.WSPTrail = { MILESTONES, addMatchResult, getProgress, claimMilestone };
})();
