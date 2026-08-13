(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_daily_v1';
  const REWARDS = [500, 750, 1000, 1250, 1500, 2000, 3000];

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore corrupt storage */ }
    return { lastClaimDate: null, streak: 0 };
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function nextStreak(state) {
    if (state.lastClaimDate === yesterdayStr()) return state.streak + 1;
    return 1;
  }

  function checkReward() {
    const state = loadState();
    const today = todayStr();
    if (state.lastClaimDate === today) return { available: false };
    const streak = nextStreak(state);
    const day = ((streak - 1) % REWARDS.length) + 1;
    return { available: true, day, amount: REWARDS[day - 1] };
  }

  function claimReward() {
    const state = loadState();
    const today = todayStr();
    if (state.lastClaimDate === today) return null;
    const streak = nextStreak(state);
    const day = ((streak - 1) % REWARDS.length) + 1;
    const amount = REWARDS[day - 1];
    saveState({ lastClaimDate: today, streak });
    if (window.WSPClub) {
      const club = window.WSPClub.loadClub();
      club.budget += amount;
      window.WSPClub.saveClub(club);
    }
    return { day, amount, streak };
  }

  window.WSPDaily = { REWARDS, checkReward, claimReward };
})();
