import './home.css';
import { checkUsername, clearSession, createUser, fetchLeaderboard, fetchMe, getSession, suggestUsername } from '../shared/session.js';
import { nextTitle, titleFor } from '../shared/titles.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n || 0).toLocaleString();
const GAME = 'cow-vs-ufo';

let me = null;
let pendingGame = new URLSearchParams(location.search).get('play');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

const initial = (name) => name.charAt(0).toUpperCase();

// ---------- player chip / profile -------------------------------------------------

function renderPlayer() {
  const slot = $('#player-slot');
  slot.innerHTML = '';
  if (!me) {
    slot.append(el('button', { class: 'btn btn-primary btn-sm', onclick: () => openSignup() }, 'Create player'));
    $('#progress-cow-vs-ufo').hidden = true;
    return;
  }
  const p = me.progress[GAME];
  const t = titleFor(p?.bestScore);
  slot.append(
    el('button', { class: 'player-chip', onclick: openProfile, 'aria-label': `Profile of ${me.user.username}` },
      el('span', { class: 'avatar' }, initial(me.user.username)),
      el('span', { class: 'who' }, el('strong', {}, me.user.username), el('small', {}, `${t.icon} ${t.title}`)),
    ),
  );
  const box = $('#progress-cow-vs-ufo');
  box.innerHTML = '';
  box.hidden = false;
  box.append(
    el('div', {}, el('small', {}, 'Your best'), el('b', {}, fmt(p?.bestScore))),
    el('div', {}, el('small', {}, 'Level'), el('b', {}, String(p?.highestLevel ?? 1))),
    el('div', {}, el('small', {}, 'Rank'), el('b', {}, p?.rank ? `#${p.rank}` : '–')),
  );
}

function openProfile() {
  const p = me.progress[GAME] ?? {};
  const best = p.bestScore ?? 0;
  const t = titleFor(best);
  const next = nextTitle(best);
  $('#profile-avatar').textContent = initial(me.user.username);
  $('#profile-title').textContent = me.user.username;
  $('#profile-rank').textContent = `${t.icon} ${t.title}`;
  const stats = $('#profile-stats');
  stats.innerHTML = '';
  const stat = (label, value) => el('div', {}, el('small', {}, label), el('b', {}, value));
  stats.append(
    stat('Best score', fmt(best)),
    stat('Highest level', String(p.highestLevel ?? 1)),
    stat('Games played', fmt(p.gamesPlayed)),
    stat('Snacks eaten', fmt(p.totalSnacks)),
  );
  if (next) {
    const pct = Math.min(100, Math.round(((best - t.min) / (next.min - t.min)) * 100));
    const bar = el('div', { class: 'bar' }, el('i', { style: `width:${pct}%` }));
    stats.append(el('div', { class: 'profile-next' }, el('small', {}, `Next title: ${next.icon} ${next.title} at ${fmt(next.min)}`), bar));
  }
  $('#profile').showModal();
}

$('#signout').addEventListener('click', () => {
  if (!confirm(`Sign out of "${me.user.username}"? You won't be able to use this name again.`)) return;
  clearSession();
  me = null;
  $('#profile').close();
  renderPlayer();
  loadBoard();
  toast('Signed out. The cows will miss you.');
});

// ---------- signup -----------------------------------------------------------------

const input = $('#username');
const hint = $('#username-hint');
const submit = $('#signup-submit');
let checkSeq = 0;
let checkTimer;

function setHint(text, kind = '') {
  hint.textContent = text;
  hint.className = `hint ${kind}`;
  input.setAttribute('aria-invalid', kind === 'error' ? 'true' : 'false');
  input.classList.toggle('ok', kind === 'ok');
}

function openSignup(game) {
  if (game) pendingGame = game;
  setHint('3–16 letters, numbers or _, starting with a letter.');
  submit.disabled = false;
  $('#signup').showModal();
  input.focus();
}

async function runCheck() {
  const name = input.value.trim();
  if (!name) return setHint('3–16 letters, numbers or _, starting with a letter.');
  const seq = ++checkSeq;
  setHint('Checking the barn records…');
  try {
    const r = await checkUsername(name);
    if (seq !== checkSeq) return;
    if (r.available) setHint(`"${name}" is available. Nice.`, 'ok');
    else setHint(r.reason, 'error');
  } catch (err) {
    if (seq === checkSeq) setHint(err.message, 'error');
  }
}

input.addEventListener('input', () => {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(runCheck, 300);
});

$('#suggest').addEventListener('click', () => {
  input.value = suggestUsername();
  runCheck();
  input.focus();
});

$('#signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = input.value.trim();
  submit.disabled = true;
  submit.textContent = 'Creating…';
  try {
    await createUser(name);
    me = await fetchMe();
    $('#signup').close();
    renderPlayer();
    loadBoard();
    toast(`Welcome, ${me.user.username}! 🐄`);
    if (pendingGame) location.href = `/games/${pendingGame}/`;
  } catch (err) {
    setHint(err.message, 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = "Let's moo-ve ▶";
  }
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('[data-open-signup]').forEach((b) => b.addEventListener('click', () => openSignup()));

// Every "Play" link requires a player name first.
document.querySelectorAll('[data-play]').forEach((a) =>
  a.addEventListener('click', (e) => {
    if (getSession()) return;
    e.preventDefault();
    openSignup(a.dataset.play);
  }),
);

// ---------- leaderboard -------------------------------------------------------------

async function loadBoard() {
  const body = $('#board-body');
  try {
    const data = await fetchLeaderboard(GAME, 10);
    $('#stat-players').textContent = fmt(data.players);
    body.innerHTML = '';
    if (!data.entries.length) {
      body.append(el('tr', {}, el('td', { colspan: '5', class: 'muted center' }, 'Nobody has scored yet. The throne is empty. 👑')));
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    for (const e of data.entries) {
      const t = titleFor(e.bestScore);
      const mine = me && e.username.toLowerCase() === me.user.username.toLowerCase();
      body.append(
        el('tr', { class: mine ? 'me' : '' },
          el('td', { class: 'rank' }, medals[e.rank - 1] ?? String(e.rank)),
          el('td', {}, el('span', { class: 'board-player' }, el('span', { class: 'avatar' }, initial(e.username)), e.username, mine ? ' (you)' : '')),
          el('td', { class: 'hide-sm board-title' }, `${t.icon} ${t.title}`),
          el('td', { class: 'num' }, String(e.highestLevel)),
          el('td', { class: 'num score' }, fmt(e.bestScore)),
        ),
      );
    }
  } catch (err) {
    body.innerHTML = '';
    body.append(el('tr', {}, el('td', { colspan: '5', class: 'muted center' }, `Couldn't load the leaderboard: ${err.message}`)));
  }
}

// ---------- boot ---------------------------------------------------------------------

async function boot() {
  if (getSession()) {
    try {
      me = await fetchMe();
    } catch (err) {
      if (err.status === 401) toast('Your player session expired. Create a new player name.');
      me = null;
    }
  }
  renderPlayer();
  loadBoard();
  if (pendingGame) {
    if (me) location.href = `/games/${pendingGame}/`;
    else openSignup(pendingGame);
  }
}

boot();
