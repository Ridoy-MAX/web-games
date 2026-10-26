import './home.css';
import { checkUsername, createUser, fetchLeaderboard, fetchMe, getSession, login, logout, setPassword, suggestUsername } from '../shared/session.js';
import { nextTitle, titleFor } from '../shared/titles.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n || 0).toLocaleString();

// Everything the home page needs to know about each game.
const GAMES = {
  'cow-vs-ufo': { name: 'Cow vs UFO', icon: '🐄', level: 'Level', extra: 'Snacks eaten', titles: true },
  'office-brawl': { name: 'Office Brawl', icon: '🥊', level: 'Stage', extra: 'K.O.s' },
};
const TITLE_GAME = 'cow-vs-ufo'; // rank titles are cow-themed, so they follow Cow vs UFO scores
const knownGame = (id) => (Object.hasOwn(GAMES, id) ? id : null);

let me = null;
let pendingGame = knownGame(new URLSearchParams(location.search).get('play'));

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
const goPlay = (game) => (location.href = `/games/${game}/`);

function setHint(node, text, kind = '', input) {
  node.textContent = text;
  node.className = `hint ${kind}`;
  if (input) {
    input.setAttribute('aria-invalid', kind === 'error' ? 'true' : 'false');
    input.classList.toggle('ok', kind === 'ok');
  }
}

// Accessible tabs: click or arrow keys select, only the active tab is in the tab order.
function tabs(list, attr, onSelect) {
  const buttons = [...list.querySelectorAll('[role="tab"]')];
  const select = (btn, focus) => {
    for (const b of buttons) {
      const on = b === btn;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (focus) btn.focus();
    onSelect(btn.dataset[attr], btn);
  };
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"]');
    if (btn) select(btn);
  });
  list.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const i = buttons.indexOf(document.activeElement);
    select(buttons[(i + step + buttons.length) % buttons.length], true);
  });
  return (value) => select(buttons.find((b) => b.dataset[attr] === value));
}

// Show/hide toggles for password fields.
document.querySelectorAll('[data-reveal]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const field = document.getElementById(btn.dataset.reveal);
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-pressed', String(show));
    field.focus();
  }),
);

function resetReveals(root) {
  root.querySelectorAll('[data-reveal]').forEach((btn) => {
    document.getElementById(btn.dataset.reveal).type = 'password';
    btn.textContent = 'Show';
    btn.setAttribute('aria-pressed', 'false');
  });
}

// ---------- password rules (mirrors server/http.js) ---------------------------------

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const COMMON = ['password', '12345678', '123456789', 'qwerty', 'qwertyuiop', 'iloveyou', 'letmein', 'abc12345', '11111111', 'password1'];

function passwordProblem(pw, username = '') {
  if (!pw) return 'Pick a password.';
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters. Cows can count that high.`;
  if (pw.length > PASSWORD_MAX) return `Keep it under ${PASSWORD_MAX + 1} characters. This isn't a novel.`;
  if (username && pw.toLowerCase() === username.trim().toLowerCase()) return "Your password can't be your player name. Nice try.";
  return null;
}

// A rough guide, not a guarantee: length matters most, variety helps.
function strength(pw) {
  if (pw.length < PASSWORD_MIN) return { level: 0, label: `Too short. ${PASSWORD_MIN - pw.length} more to go.` };
  if (COMMON.includes(pw.toLowerCase())) return { level: 1, label: 'Weak. This one is on every hacker’s fridge.' };
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'Weak. A determined goat could guess it.' };
  if (score === 2) return { level: 2, label: 'Okay. Make it longer to make it stronger.' };
  if (score === 3) return { level: 3, label: 'Strong. The UFO is impressed.' };
  return { level: 4, label: 'Fort Knox. Please don’t forget it.' };
}

// ---------- player chip / profile -------------------------------------------------

function renderProgress(game) {
  const box = $(`#progress-${game}`);
  if (!box) return;
  box.innerHTML = '';
  box.hidden = !me;
  if (!me) return;
  const p = me.progress[game];
  box.append(
    el('div', {}, el('small', {}, 'Your best'), el('b', {}, fmt(p?.bestScore))),
    el('div', {}, el('small', {}, GAMES[game].level), el('b', {}, String(p?.highestLevel ?? 1))),
    el('div', {}, el('small', {}, 'Rank'), el('b', {}, p?.rank ? `#${p.rank}` : '–')),
  );
}

function renderPlayer() {
  const slot = $('#player-slot');
  slot.innerHTML = '';
  Object.keys(GAMES).forEach(renderProgress);
  if (!me) {
    slot.append(
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openSignup(null, 'login') }, 'Log in'),
      el('button', { class: 'btn btn-primary btn-sm', onclick: () => openSignup() }, 'Create player'),
    );
    return;
  }
  const t = titleFor(me.progress[TITLE_GAME]?.bestScore);
  slot.append(
    el('button', { class: 'player-chip', onclick: openProfile, 'aria-label': `Profile of ${me.user.username}` },
      el('span', { class: 'avatar' }, initial(me.user.username)),
      el('span', { class: 'who' }, el('strong', {}, me.user.username), el('small', {}, `${t.icon} ${t.title}`)),
      me.user.hasPassword ? null : el('span', { class: 'chip-dot', title: 'Set a password' }),
    ),
  );
}

function gameStats(game) {
  const info = GAMES[game];
  const p = me.progress[game];
  const head = el('h3', {}, `${info.icon} ${info.name}`);
  if (!p) {
    return el('section', { class: 'profile-game' }, head,
      el('p', { class: 'muted small' }, 'No runs yet. ', el('a', { href: `/games/${game}/` }, 'Fix that →')));
  }
  const stat = (label, value) => el('div', {}, el('small', {}, label), el('b', {}, value));
  const grid = el('div', { class: 'profile-stats' },
    stat('Best score', fmt(p.bestScore)),
    stat(`Highest ${info.level.toLowerCase()}`, String(p.highestLevel)),
    stat('Games played', fmt(p.gamesPlayed)),
    stat(info.extra, fmt(p.totalSnacks)),
  );
  if (info.titles) {
    const t = titleFor(p.bestScore);
    const next = nextTitle(p.bestScore);
    if (next) {
      const pct = Math.min(100, Math.round(((p.bestScore - t.min) / (next.min - t.min)) * 100));
      grid.append(el('div', { class: 'profile-next' },
        el('small', {}, `Next title: ${next.icon} ${next.title} at ${fmt(next.min)}`),
        el('div', { class: 'bar' }, el('i', { style: `width:${pct}%` }))));
    }
  }
  return el('section', { class: 'profile-game' }, head, grid);
}

function renderPasswordBox() {
  const has = me.user.hasPassword;
  const details = $('#pw-details');
  details.open = !has;
  details.classList.toggle('nudge', !has);
  $('#pw-summary').textContent = has ? '🔑 Change password' : '🔐 Set a password';
  $('#pw-lead').textContent = has
    ? 'Changing it signs you out everywhere else.'
    : 'Right now this player only lives on this device. Set a password to log in on your phone, laptop or office PC.';
  $('#pw-current-group').hidden = !has;
  $('#pw-username').value = me.user.username;
  for (const id of ['#pw-current', '#pw-new', '#pw-confirm']) $(id).value = '';
  resetReveals($('#password-form'));
  setHint($('#pw-hint'), '');
  $('#signout-note').textContent = has
    ? 'Signing out only affects this device. Log back in anytime with your password.'
    : "No password yet, so if you sign out you can't get this player back.";
}

function openProfile() {
  const t = titleFor(me.progress[TITLE_GAME]?.bestScore);
  $('#profile-avatar').textContent = initial(me.user.username);
  $('#profile-title').textContent = me.user.username;
  $('#profile-rank').textContent = `${t.icon} ${t.title}`;
  $('#profile-stats').replaceChildren(...Object.keys(GAMES).map(gameStats));
  renderPasswordBox();
  if (!$('#profile').open) $('#profile').showModal();
}

$('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const hint = $('#pw-hint');
  const current = $('#pw-current').value;
  const next = $('#pw-new').value;
  if (me.user.hasPassword && !current) return setHint(hint, 'Enter your current password first.', 'error');
  const problem = passwordProblem(next, me.user.username);
  if (problem) return setHint(hint, problem, 'error');
  if (next !== $('#pw-confirm').value) return setHint(hint, "The passwords don't match.", 'error');
  const btn = $('#pw-submit');
  btn.disabled = true;
  setHint(hint, 'Saving…');
  try {
    const r = await setPassword(next, me.user.hasPassword ? current : undefined);
    const was = me.user.hasPassword;
    me = await fetchMe();
    renderPlayer();
    openProfile();
    if (!was) toast('Password set. You can now log in on any device. 🔐');
    else toast(r.signedOutDevices ? `Password changed. Signed out ${r.signedOutDevices} other device(s).` : 'Password changed.');
  } catch (err) {
    setHint(hint, err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

$('#signout').addEventListener('click', async () => {
  const name = me.user.username;
  const ask = me.user.hasPassword
    ? `Sign out of "${name}" on this device? Your other devices stay signed in.`
    : `Sign out of "${name}"? You haven't set a password, so you won't be able to log back in. Set one first if you want to keep this player.`;
  if (!confirm(ask)) return;
  await logout();
  me = null;
  $('#profile').close();
  renderPlayer();
  loadBoard();
  toast('Signed out on this device. The cows will miss you.');
});

// ---------- create player / log in ---------------------------------------------------

const form = $('#signup-form');
const userInput = $('#username');
const userHint = $('#username-hint');
const pwInput = $('#password');
const pwHint = $('#password-hint');
const confirmInput = $('#password-confirm');
const confirmHint = $('#confirm-hint');
const formError = $('#form-error');
const submit = $('#signup-submit');
const USERNAME_HELP = '3–16 letters, numbers or _, starting with a letter.';
const PASSWORD_HELP = `At least ${PASSWORD_MIN} characters. Longer is stronger.`;
let mode = 'create';
let checkSeq = 0;
let checkTimer;

const MODES = {
  create: {
    icon: '🐮',
    title: 'Create your player',
    lead: 'Your scores and unlocked levels are saved under this name. Names are unique, so choose wisely.',
    submit: "Let's moo-ve ▶",
    busy: 'Creating…',
  },
  login: {
    icon: '🔑',
    title: 'Welcome back',
    lead: 'Log in to pick up your scores and levels on this device.',
    submit: 'Log in ▶',
    busy: 'Checking…',
  },
};

function clearErrors() {
  checkSeq++;
  formError.textContent = '';
  setHint(userHint, mode === 'create' ? USERNAME_HELP : '', '', userInput);
  setHint(pwHint, mode === 'create' ? PASSWORD_HELP : '', '', pwInput);
  setHint(confirmHint, '', '', confirmInput);
  $('#strength').dataset.level = '';
}

function applyMode(next) {
  mode = next;
  const m = MODES[mode];
  const create = mode === 'create';
  $('#signup-icon').textContent = m.icon;
  $('#signup-title').textContent = m.title;
  $('#signup-lead').textContent = m.lead;
  submit.textContent = m.submit;
  $('#suggest').hidden = !create;
  $('#confirm-group').hidden = !create;
  $('#strength').hidden = !create;
  pwInput.autocomplete = create ? 'new-password' : 'current-password';
  clearErrors();
  if (create && userInput.value.trim()) runCheck();
}

const selectMode = tabs($('.auth-tabs'), 'mode', applyMode);

function openSignup(game, startMode = 'create') {
  if (game) pendingGame = game;
  form.reset();
  resetReveals(form);
  submit.disabled = false;
  selectMode(startMode);
  $('#signup').showModal();
  userInput.focus();
}

async function runCheck() {
  if (mode !== 'create') return;
  const name = userInput.value.trim();
  if (!name) return setHint(userHint, USERNAME_HELP, '', userInput);
  const seq = ++checkSeq;
  setHint(userHint, 'Checking the barn records…', '', userInput);
  try {
    const r = await checkUsername(name);
    if (seq !== checkSeq) return;
    if (r.available) setHint(userHint, `"${name}" is available. Nice.`, 'ok', userInput);
    else setHint(userHint, r.reason, 'error', userInput);
  } catch (err) {
    if (seq === checkSeq) setHint(userHint, err.message, 'error', userInput);
  }
}

function showStrength() {
  if (mode !== 'create') return;
  const pw = pwInput.value;
  const meter = $('#strength');
  if (!pw) {
    meter.dataset.level = '';
    return setHint(pwHint, PASSWORD_HELP, '', pwInput);
  }
  const s = strength(pw);
  meter.dataset.level = String(s.level);
  setHint(pwHint, s.label, s.level >= 3 ? 'ok' : '', pwInput);
}

function showConfirm() {
  if (mode !== 'create' || !confirmInput.value) return setHint(confirmHint, '', '', confirmInput);
  if (confirmInput.value === pwInput.value) setHint(confirmHint, 'Passwords match.', 'ok', confirmInput);
  else if (!pwInput.value.startsWith(confirmInput.value)) setHint(confirmHint, "The passwords don't match.", 'error', confirmInput);
  else setHint(confirmHint, '', '', confirmInput);
}

userInput.addEventListener('input', () => {
  formError.textContent = '';
  clearTimeout(checkTimer);
  checkTimer = setTimeout(runCheck, 300);
});
pwInput.addEventListener('input', () => {
  formError.textContent = '';
  showStrength();
  showConfirm();
});
confirmInput.addEventListener('input', showConfirm);

$('#suggest').addEventListener('click', () => {
  userInput.value = suggestUsername();
  runCheck();
  userInput.focus();
});

// Returns the first invalid field, after marking every problem inline.
function validateForm() {
  const name = userInput.value.trim();
  const pw = pwInput.value;
  let first = null;
  const flag = (input, hint, text) => {
    setHint(hint, text, 'error', input);
    first ??= input;
  };
  if (!name) flag(userInput, userHint, 'Enter your player name.');
  if (mode === 'login') {
    if (!pw) flag(pwInput, pwHint, 'Enter your password.');
    return first;
  }
  if (userInput.getAttribute('aria-invalid') === 'true') first ??= userInput;
  const problem = passwordProblem(pw, name);
  if (problem) flag(pwInput, pwHint, problem);
  if (!problem && confirmInput.value !== pw) flag(confirmInput, confirmHint, confirmInput.value ? "The passwords don't match." : 'Type it again, just to be sure.');
  return first;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  const invalid = validateForm();
  if (invalid) return invalid.focus();
  const name = userInput.value.trim();
  submit.disabled = true;
  submit.textContent = MODES[mode].busy;
  try {
    if (mode === 'create') await createUser(name, pwInput.value);
    else await login(name, pwInput.value);
    me = await fetchMe();
    $('#signup').close();
    renderPlayer();
    loadBoard();
    toast(mode === 'create' ? `Welcome, ${me.user.username}! 🐄` : `Welcome back, ${me.user.username}!`);
    if (pendingGame) goPlay(pendingGame);
  } catch (err) {
    if (err.code === 'INVALID_USERNAME' || err.code === 'USERNAME_TAKEN') {
      setHint(userHint, err.message, 'error', userInput);
      userInput.focus();
    } else if (err.code === 'INVALID_PASSWORD') {
      setHint(pwHint, err.message, 'error', pwInput);
      pwInput.focus();
    } else {
      formError.textContent = err.message;
      if (err.code === 'BAD_LOGIN') pwInput.select();
    }
  } finally {
    submit.disabled = false;
    submit.textContent = MODES[mode].submit;
  }
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('[data-open-signup]').forEach((b) => b.addEventListener('click', () => openSignup()));
document.querySelectorAll('[data-open-login]').forEach((b) => b.addEventListener('click', () => openSignup(null, 'login')));

// Every "Play" link requires a player first.
document.querySelectorAll('[data-play]').forEach((a) =>
  a.addEventListener('click', (e) => {
    if (getSession()) return;
    e.preventDefault();
    openSignup(knownGame(a.dataset.play));
  }),
);

// ---------- gameplay previews -------------------------------------------------------

// Hovering a game card plays a short gameplay clip over its thumbnail. Touch screens
// have no hover, so there the card in view plays instead. Clips load only when first needed.
function setupPreviews() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;
  const thumbs = [...document.querySelectorAll('.thumb')].filter((t) => t.querySelector('.thumb-video'));
  const play = (thumb) => {
    const video = thumb.querySelector('.thumb-video');
    if (!video.src) video.src = video.dataset.src;
    video.onplaying = () => thumb.classList.add('playing');
    video.play().catch(() => {});
  };
  const stop = (thumb) => {
    const video = thumb.querySelector('.thumb-video');
    thumb.classList.remove('playing');
    video.pause();
  };

  if (matchMedia('(hover: hover)').matches) {
    for (const thumb of thumbs) {
      const card = thumb.closest('.game-card');
      card.addEventListener('pointerenter', () => play(thumb));
      card.addEventListener('pointerleave', () => stop(thumb));
    }
    return;
  }
  const seen = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? play(e.target) : stop(e.target))),
    { threshold: 0.7 },
  );
  thumbs.forEach((t) => seen.observe(t));
}
setupPreviews();

// ---------- leaderboard -------------------------------------------------------------

let boardGame = 'cow-vs-ufo';
let boardSeq = 0;

function boardColumns(game) {
  const info = GAMES[game];
  return [
    { label: '#', cell: (e) => el('td', { class: 'rank' }, ['🥇', '🥈', '🥉'][e.rank - 1] ?? String(e.rank)) },
    { label: 'Player', cell: (e, mine) => el('td', {}, el('span', { class: 'board-player' }, el('span', { class: 'avatar' }, initial(e.username)), e.username, mine ? ' (you)' : '')) },
    info.titles && { label: 'Title', class: 'hide-sm', cell: (e) => { const t = titleFor(e.bestScore); return el('td', { class: 'hide-sm board-title' }, `${t.icon} ${t.title}`); } },
    { label: info.level, class: 'num', cell: (e) => el('td', { class: 'num' }, String(e.highestLevel)) },
    { label: 'Best score', class: 'num', cell: (e) => el('td', { class: 'num score' }, fmt(e.bestScore)) },
  ].filter(Boolean);
}

async function loadBoard() {
  const game = boardGame;
  const seq = ++boardSeq;
  const cols = boardColumns(game);
  const body = $('#board-body');
  const message = (text) => body.replaceChildren(el('tr', {}, el('td', { colspan: String(cols.length), class: 'muted center' }, text)));
  $('#board-caption').textContent = `${GAMES[game].name} · top 10 all-time`;
  $('#board').setAttribute('aria-labelledby', `tab-${game}`);
  $('#board-head').replaceChildren(el('tr', {}, ...cols.map((c) => el('th', c.class ? { class: c.class } : {}, c.label))));
  if (!body.children.length || body.querySelector('td[colspan]')) message('Loading the hall of fame…');
  try {
    const data = await fetchLeaderboard(game, 10);
    if (seq !== boardSeq) return;
    $('#stat-players').textContent = fmt(data.players);
    if (!data.entries.length) return message('Nobody has scored yet. The throne is empty. 👑');
    body.replaceChildren(
      ...data.entries.map((e) => {
        const mine = me && e.username.toLowerCase() === me.user.username.toLowerCase();
        return el('tr', { class: mine ? 'me' : '' }, ...cols.map((c) => c.cell(e, mine)));
      }),
    );
  } catch (err) {
    if (seq === boardSeq) message(`Couldn't load the leaderboard: ${err.message}`);
  }
}

tabs($('.board-tabs'), 'board', (game) => {
  boardGame = game;
  loadBoard();
});

// ---------- boot ---------------------------------------------------------------------

async function boot() {
  if (getSession()) {
    try {
      me = await fetchMe();
    } catch (err) {
      if (err.status === 401) toast('Your session expired. Log in again.');
      me = null;
    }
  }
  renderPlayer();
  loadBoard();
  if (pendingGame) {
    if (me) goPlay(pendingGame);
    else openSignup(pendingGame);
  }
}

boot();
