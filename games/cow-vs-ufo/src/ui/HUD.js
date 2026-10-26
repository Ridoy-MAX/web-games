const $ = (id) => document.getElementById(id);

export function formatTime(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The in-game overlay. Values are cached so the DOM is only touched on change.
export class HUD {
  constructor() {
    this.el = $('hud');
    this.food = $('hud-food');
    this.score = $('hud-score');
    this.combo = $('hud-combo');
    this.time = $('hud-time');
    this.hearts = $('hud-hearts');
    this.objective = $('hud-objective');
    this.meter = $('abduct-meter');
    this.fill = $('abduct-fill');
    this.hiddenTag = $('hidden-tag');
    this.bannerEl = $('banner');
    this.bannerIcon = this.bannerEl.querySelector('.banner-icon');
    this.bannerText = this.bannerEl.querySelector('.banner-text');
    this.intro = $('level-intro');
    this.titleEl = $('hud-title');
    this.cache = {};
    this.bannerTimer = 0;
    this.introTimer = 0;
  }

  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  show(visible) {
    this.el.classList.toggle('hidden', !visible);
    document.body.classList.toggle('playing', visible);
  }

  setFood(n, target) {
    this.set('food', `${n}/${target}`, (v) => (this.food.textContent = v));
  }

  setScore(s) {
    this.set('score', s, (v) => (this.score.textContent = v.toLocaleString()));
  }

  setCombo(mult) {
    this.set('combo', mult, (v) => (this.combo.textContent = v > 1 ? `COMBO ×${v}` : ''));
  }

  setTime(sec) {
    this.set('time', Math.floor(sec), () => (this.time.textContent = formatTime(sec)));
  }

  setHearts(n, max, popIndex = -1) {
    this.set('hearts', `${n}/${max}/${popIndex}`, () => {
      this.hearts.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const s = document.createElement('span');
        s.textContent = '❤️';
        if (i >= n) s.className = 'lost';
        if (i === popIndex) s.classList.add('pop');
        this.hearts.appendChild(s);
      }
    });
  }

  setObjective(text) {
    this.set('objective', text, (v) => (this.objective.textContent = v));
  }

  setAbduct(p) {
    const v = Math.round(p * 100);
    this.set('abduct', v, () => {
      this.meter.classList.toggle('hidden', v <= 0);
      this.fill.style.width = `${v}%`;
    });
  }

  setHidden(hidden) {
    this.set('hidden', hidden, (v) => this.hiddenTag.classList.toggle('hidden', !v));
  }

  banner(icon, text, duration = 2.5) {
    this.bannerIcon.textContent = icon;
    this.bannerText.textContent = text;
    this.bannerEl.classList.add('show');
    this.bannerTimer = duration;
  }

  levelIntro(n, name, tip) {
    this.intro.innerHTML = '';
    const small = document.createElement('small');
    small.textContent = `LEVEL ${n}`;
    this.intro.append(small, document.createTextNode(name));
    if (tip) {
      const t = document.createElement('span');
      t.className = 'intro-tip';
      t.textContent = tip;
      this.intro.append(t);
    }
    this.intro.classList.add('show');
    this.introTimer = 3;
  }

  setTitle(t, celebrate = false) {
    this.titleEl.textContent = `${t.icon} ${t.title}`;
    if (celebrate) {
      this.titleEl.classList.remove('rankup');
      void this.titleEl.offsetWidth;
      this.titleEl.classList.add('rankup');
    }
  }

  setDisco(on) {
    document.body.classList.toggle('disco', on);
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show');
    }
    if (this.introTimer > 0) {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.intro.classList.remove('show');
    }
  }

  clearTransient() {
    this.bannerTimer = 0;
    this.introTimer = 0;
    this.bannerEl.classList.remove('show');
    this.intro.classList.remove('show');
    this.setAbduct(0);
    this.setHidden(false);
    this.setDisco(false);
  }
}
