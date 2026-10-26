const $ = (id) => document.getElementById(id);

// Health bars, timer, caffeine meters, round pips, combo counters and the
// big announcer text.
export class HUD {
  constructor() {
    this.el = $('hud');
    this.side = [0, 1].map((i) => ({
      portrait: $(`p${i + 1}-portrait`),
      name: $(`p${i + 1}-name`),
      role: $(`p${i + 1}-role`),
      hp: $(`p${i + 1}-hp`),
      trail: $(`p${i + 1}-trail`),
      pips: $(`p${i + 1}-pips`),
      meter: $(`p${i + 1}-meter`),
      meterBox: $(`p${i + 1}-meter`).closest('.meter'),
      mlabel: $(`p${i + 1}-mlabel`),
      combo: $(`combo-p${i + 1}`),
      comboTimer: 0,
      last: {},
    }));
    this.timer = $('timer');
    this.announceEl = $('announce');
    this.titleEl = $('hud-title');
    this.scoreEl = $('hud-score');
    this.supBtn = $('t-sup');
  }

  show(v) {
    this.el.classList.toggle('hidden', !v);
  }

  setFighters(p1, p2, portraits) {
    [p1, p2].forEach((f, i) => {
      const s = this.side[i];
      s.portrait.src = portraits[f.def.id];
      s.name.textContent = f.def.name;
      s.role.textContent = f.def.role;
      s.last = {};
    });
  }

  setRound(match) {
    [match.p1, match.p2].forEach((f, i) => {
      const pips = this.side[i].pips;
      pips.innerHTML = '';
      for (let k = 0; k < 2; k++) {
        const s = document.createElement('span');
        s.textContent = '☕';
        if (k < f.roundsWon) s.className = 'won';
        pips.appendChild(s);
      }
    });
  }

  update(match, dt) {
    [match.p1, match.p2].forEach((f, i) => {
      const s = this.side[i];
      const hp = Math.max(0, f.hp / f.hpMax);
      const pct = `${(hp * 100).toFixed(1)}%`;
      if (s.last.hp !== pct) {
        s.hp.style.width = pct;
        s.trail.style.width = pct;
        s.hp.classList.toggle('low', hp < 0.25);
        s.last.hp = pct;
      }
      const m = Math.floor(f.meter);
      if (s.last.m !== m) {
        s.meter.style.width = `${m}%`;
        const full = m >= 100;
        s.meterBox.classList.toggle('full', full);
        s.mlabel.textContent = full ? '☕ OVERTIME READY!' : '☕ CAFFEINE';
        if (i === 0) this.supBtn?.classList.toggle('ready', full);
        s.last.m = m;
      }
      if (s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo.classList.remove('show');
      }
    });
    const secs = Math.ceil(match.timer / 60);
    if (this.lastSecs !== secs) {
      this.timer.textContent = String(Math.max(0, secs));
      this.timer.classList.toggle('urgent', secs <= 10);
      this.lastSecs = secs;
    }
  }

  combo(slot, hits, name) {
    const s = this.side[slot];
    s.combo.innerHTML = '';
    s.combo.append(document.createTextNode(`${hits} HITS`));
    if (name) {
      const sm = document.createElement('small');
      sm.textContent = name;
      s.combo.append(sm);
    }
    s.combo.classList.remove('show');
    void s.combo.offsetWidth;
    s.combo.classList.add('show');
    s.comboTimer = 1.4;
  }

  announce(big, small = '', cls = '') {
    const a = this.announceEl;
    a.querySelector('.big').textContent = big;
    a.querySelector('.small').textContent = small;
    a.className = 'announce';
    void a.offsetWidth;
    a.className = `announce show ${cls}`;
  }

  setTitle(t, celebrate = false) {
    this.titleEl.textContent = `${t.icon} ${t.title}`;
    if (celebrate) {
      this.titleEl.classList.remove('rankup');
      void this.titleEl.offsetWidth;
      this.titleEl.classList.add('rankup');
    }
  }

  setScore(n) {
    this.scoreEl.textContent = n ? `Career score ${n.toLocaleString()}` : '';
    this.scoreEl.hidden = !n;
  }
}
