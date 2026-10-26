const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'select', 'career', 'vs', 'results', 'pause', 'moves', 'settings'];
const KEYS = { s1: 'U', s2: 'I', sup: 'O' };

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

// Screen switching plus the DOM builders for each screen.
export class UI {
  constructor(game) {
    this.game = game;
    this.screens = Object.fromEntries(SCREENS.map((id) => [id, $(id)]));
    this.current = null;
    this.stack = [];
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      game.audio.unlock();
      game.audio.click();
      game.action(b.dataset.action, b);
    });
  }

  show(name, { push = false } = {}) {
    if (push && this.current) this.stack.push(this.current);
    else this.stack = [];
    this.set(name);
  }

  set(name) {
    for (const [id, s] of Object.entries(this.screens)) s.classList.toggle('visible', id === name);
    this.current = name;
    const first = name && this.screens[name].querySelector('.mbtn.primary, .mbtn, .card');
    if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
  }

  back() {
    this.set(this.stack.pop() ?? 'title');
  }

  hideAll() {
    this.stack = [];
    this.set(null);
  }

  // --- title -----------------------------------------------------------------------
  setPlayer(username, title, best, stage, error) {
    $('pb-name').textContent = username ?? '';
    $('pb-title').textContent = `${title.icon} ${title.title}`;
    $('best-score').textContent = best.toLocaleString();
    $('best-stage').textContent = stage;
    $('offline').classList.toggle('hidden', !error);
    if (error) $('offline').textContent = `Offline: scores may not save (${error})`;
  }

  setCareerButton(rung, total) {
    const b = $('btn-career');
    b.innerHTML = '';
    b.append(rung > 1 ? `🏢 Continue Career` : '🏢 Career Mode', el('small', {}, rung > 1 ? `Resume at rung ${rung} of ${total}` : 'Climb the org chart'));
  }

  // --- select ------------------------------------------------------------------------
  buildRoster(roster, portraits, { isLocked, cpuPick = false, selected }) {
    const box = $('roster');
    box.innerHTML = '';
    $('sel-title').textContent = cpuPick ? 'CHOOSE YOUR RIVAL' : 'CHOOSE YOUR EMPLOYEE';
    $('sel-step').textContent = cpuPick ? 'Step 2 of 2' : this.game.mode === 'quick' ? 'Step 1 of 2' : 'Career Mode';
    for (const def of roster) {
      const locked = isLocked(def.id);
      const card = el(
        'button',
        { class: `card${locked ? ' locked' : ''}${cpuPick ? ' cpu' : ''}`, style: `--c:${def.color}`, 'aria-label': `${def.name}, ${def.role}${locked ? ' (locked)' : ''}` },
        el('img', { src: portraits[def.id], alt: '' }),
        el('span', {}, locked ? '???' : def.name),
      );
      card.addEventListener('click', () => this.game.hover(def.id));
      card.addEventListener('dblclick', () => this.game.action('confirm'));
      card.dataset.id = def.id;
      box.append(card);
    }
    this.highlight(selected);
  }

  highlight(id) {
    for (const c of $('roster').children) c.classList.toggle('active', c.dataset.id === id);
  }

  showInfo(def, locked) {
    $('si-name').textContent = locked ? '???' : def.name;
    $('si-role').textContent = locked ? 'Classified' : def.role;
    $('si-bio').textContent = locked ? 'Beat Career Mode to meet the person who signs everyone\'s paychecks.' : def.bio;
    const stats = $('si-stats');
    stats.innerHTML = '';
    for (const [k, v] of Object.entries(def.stats)) {
      stats.append(el('div', { class: 'stat' }, k.toUpperCase(), el('div', { class: 'track' }, el('i', { style: `width:${locked ? 0 : v * 20}%` }))));
    }
    const moves = $('si-moves');
    moves.innerHTML = '';
    if (!locked) {
      def.specials.forEach((m, i) => moves.append(el('li', {}, m.name, el('kbd', {}, KEYS[`s${i + 1}`]))));
      moves.append(el('li', { class: 'super' }, `☕ ${def.super.name}`, el('kbd', {}, KEYS.sup)));
    }
    const confirm = $('sel-confirm');
    confirm.disabled = locked;
    confirm.textContent = locked ? '🔒 Locked' : this.game.pickingRival ? 'Fight them ▶' : 'Clock in ▶';
  }

  // --- career ladder ----------------------------------------------------------------------
  buildLadder(ladder, index, portraits) {
    const list = $('ladder');
    list.innerHTML = '';
    ladder.forEach((def, i) => {
      const cls = i < index ? 'done' : i === index ? 'next' : '';
      list.append(
        el('li', { class: `${cls}${def.boss ? ' boss' : ''}` },
          el('img', { src: portraits[def.id], alt: '' }),
          el('b', {}, `${def.name}`),
          el('small', {}, def.boss ? '👑 FINAL BOSS' : def.role),
        ),
      );
    });
  }

  // --- versus ------------------------------------------------------------------------------
  showVs(a, b, portraits, tag, stage) {
    $('vs-p1').src = portraits[a.id];
    $('vs-p2').src = portraits[b.id];
    $('vs-n1').textContent = a.name;
    $('vs-n2').textContent = b.name;
    $('vs-r1').textContent = a.role;
    $('vs-r2').textContent = b.role;
    $('vs-tag').textContent = tag;
    $('vs-stage').textContent = `📍 ${stage}`;
    this.show('vs');
  }

  // --- results -------------------------------------------------------------------------------
  showResults({ title, line, rows, score, rank, buttons }) {
    $('res-title').textContent = title;
    $('res-line').textContent = line;
    const list = $('res-stats');
    list.innerHTML = '';
    rows.forEach(([k, v], i) => list.append(el('li', { style: `animation-delay:${0.1 + i * 0.07}s` }, k, el('b', {}, String(v)))));
    $('res-score').textContent = score.toLocaleString();
    $('res-rank').textContent = `${rank.icon} ${rank.title}`;
    const btns = $('res-btns');
    btns.innerHTML = '';
    for (const [action, label, primary] of buttons) btns.append(el('button', { class: `mbtn${primary ? ' primary' : ''}`, 'data-action': action }, label));
    this.setSave('', '');
    this.show('results');
  }

  setSave(kind, text) {
    const s = $('save-status');
    s.dataset.kind = kind;
    s.textContent = text;
  }

  // --- move list ---------------------------------------------------------------------------
  buildMoveList(roster) {
    const box = $('movelist');
    box.innerHTML = '';
    for (const def of roster) {
      if (def.boss && this.game.isLocked(def.id)) continue;
      box.append(
        el('div', {},
          el('b', {}, `${def.name} · ${def.role}`),
          el('br'),
          `U: ${def.specials[0].name}`, el('br'),
          `I: ${def.specials[1].name}`, el('br'),
          `O: ☕ ${def.super.name}`,
        ),
      );
    }
  }

  // --- settings --------------------------------------------------------------------------------
  bindSettings(settings, save, audio) {
    const bind = (id, key, prop = 'checked', cast = (v) => v) => {
      const input = $(id);
      input[prop] = settings[key];
      input.addEventListener(prop === 'checked' ? 'change' : 'input', () => {
        settings[key] = cast(input[prop]);
        save();
        audio.apply();
      });
    };
    bind('set-sound', 'sound');
    bind('set-music', 'music');
    bind('set-voice', 'voice');
    bind('set-volume', 'volume', 'value', Number);
    bind('set-diff', 'difficulty', 'value');
    bind('set-quality', 'quality', 'value');
  }
}
