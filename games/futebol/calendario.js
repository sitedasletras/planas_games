(() => {
  'use strict';

  const STORAGE_KEY = 'wsp_calendar_v1';
  // calendário do jogo, não do mundo real: 2h reais = 1 "dia" dentro do WSP.
  // os "3 dias" de intervalo viram 6h reais corridas — se o jogador ficar mais
  // tempo fora, o relógio não avança além disso, só espera ele voltar.
  const GAME_DAY_REAL_MS = 2 * 60 * 60 * 1000;
  const MATCH_COOLDOWN_GAME_DAYS = 3;
  const MATCH_COOLDOWN_MS = GAME_DAY_REAL_MS * MATCH_COOLDOWN_GAME_DAYS;
  const MAX_HEADLINES = 10;

  function freshCalendar() {
    return { nextMatchAt: null, lastMatch: null, headlines: [], lastAdSkipDay: null };
  }

  function loadCalendar() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (raw) return Object.assign(freshCalendar(), raw);
    } catch (e) { /* ignore corrupt storage */ }
    return freshCalendar();
  }

  function saveCalendar(cal) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cal)); } catch (e) { /* storage unavailable */ }
  }

  function isMatchAvailable(cal) {
    return !cal.nextMatchAt || Date.now() >= cal.nextMatchAt;
  }

  function msUntilNextMatch(cal) {
    if (!cal.nextMatchAt) return 0;
    return Math.max(0, cal.nextMatchAt - Date.now());
  }

  // dias "de dentro do jogo" que faltam, não dias reais — é essa a unidade
  // mostrada pro jogador (o relógio real por trás corre bem mais rápido)
  function gameDaysRemaining(ms) {
    return Math.max(0, Math.ceil(ms / GAME_DAY_REAL_MS));
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Disponível agora';
    const days = gameDaysRemaining(ms);
    return days === 1 ? '1 dia' : days + ' dias';
  }

  // ---------- Assistir vídeo pra adiantar um dia ----------
  // limitado a 1 vez por dia real (não de jogo) — senão dava pra encadear
  // vídeos e zerar o cooldown inteiro entre partidas de uma vez
  function canWatchAdToSkipDay(cal) {
    if (isMatchAvailable(cal)) return false;
    return cal.lastAdSkipDay !== new Date().toDateString();
  }

  function watchAdToSkipDay(cal) {
    if (!canWatchAdToSkipDay(cal)) return { ok: false };
    cal.nextMatchAt = Math.max(Date.now(), cal.nextMatchAt - GAME_DAY_REAL_MS);
    cal.lastAdSkipDay = new Date().toDateString();
    saveCalendar(cal);
    return { ok: true };
  }

  // ---------- Manchetes e opinião da torcida ----------
  const HEADLINE_TEMPLATES = {
    goleada_pro: [
      '{clube} atropela o {adv} e deixa a torcida em êxtase',
      'Show de bola! {clube} aplica {golsFor} a {golsAgainst} no {adv}',
      'Torcida do {clube} sai cantando do estádio após a goleada',
    ],
    vitoria: [
      '{clube} vence o {adv} e soma mais três pontos',
      'Vitória tranquila: {clube} bate o {adv} por {golsFor} a {golsAgainst}',
      '{clube} faz o dever de casa e supera o {adv}',
    ],
    empate: [
      '{clube} e {adv} dividem os pontos em duelo equilibrado',
      'Sem vencedor: {clube} {golsFor} x {golsAgainst} {adv}',
      'Empate deixa torcida do {clube} de cabelo em pé até o fim',
    ],
    derrota: [
      '{clube} tropeça diante do {adv}',
      'Torcida cobra reação após revés para o {adv}',
      '{clube} sai de campo derrotado pelo {adv}',
    ],
    goleada_contra: [
      'Vexame! {clube} leva goleada do {adv} e torcida vaia no estádio',
      'Noite para esquecer: {clube} {golsFor} x {golsAgainst} {adv}',
      'Pressão aumenta sobre o {clube} após a goleada sofrida',
    ],
  };

  const TORCIDA_MOOD = {
    goleada_pro: ['A torcida está em festa com a atuação do time!', 'Nas redes, torcedores exaltam o time após a goleada.'],
    vitoria: ['A torcida sai satisfeita do estádio.', 'Clima positivo entre os torcedores após mais uma vitória.'],
    empate: ['A torcida saiu de campo com a sensação de "podia ser mais".', 'O resultado dividiu opiniões entre os torcedores.'],
    derrota: ['A torcida cobra postura do elenco para o próximo compromisso.', 'Alguns torcedores já pedem mudanças na equipe.'],
    goleada_contra: ['A torcida está revoltada com a diretoria e o elenco.', 'Cobrança pesada da torcida nas redes sociais após o vexame.'],
  };

  function resultBucket(golsFor, golsAgainst) {
    const diff = golsFor - golsAgainst;
    if (diff >= 3) return 'goleada_pro';
    if (diff > 0) return 'vitoria';
    if (diff === 0) return 'empate';
    if (diff > -3) return 'derrota';
    return 'goleada_contra';
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function fillTemplate(tpl, ctx) {
    return tpl
      .replace(/\{clube\}/g, ctx.clube)
      .replace(/\{adv\}/g, ctx.adv)
      .replace(/\{golsFor\}/g, ctx.golsFor)
      .replace(/\{golsAgainst\}/g, ctx.golsAgainst);
  }

  function generateHeadlines(ctx) {
    const bucket = resultBucket(ctx.golsFor, ctx.golsAgainst);
    return [fillTemplate(pick(HEADLINE_TEMPLATES[bucket]), ctx), pick(TORCIDA_MOOD[bucket])];
  }

  // registra o resultado, gera as manchetes e abre o intervalo de 3 dias até a próxima partida
  function registerMatchResult(cal, ctx) {
    const now = Date.now();
    const [headline, mood] = generateHeadlines(ctx);
    cal.lastMatch = Object.assign({ date: now }, ctx);
    cal.nextMatchAt = now + MATCH_COOLDOWN_MS;
    cal.headlines.unshift({ date: now, text: headline });
    cal.headlines.unshift({ date: now, text: mood });
    cal.headlines = cal.headlines.slice(0, MAX_HEADLINES);
    saveCalendar(cal);
    return cal;
  }

  window.WSPCalendar = {
    GAME_DAY_REAL_MS, MATCH_COOLDOWN_GAME_DAYS, MATCH_COOLDOWN_MS,
    loadCalendar, saveCalendar, freshCalendar,
    isMatchAvailable, msUntilNextMatch, formatCountdown, gameDaysRemaining,
    generateHeadlines, registerMatchResult,
    canWatchAdToSkipDay, watchAdToSkipDay,
  };
})();
