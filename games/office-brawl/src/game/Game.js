import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Match } from './Match.js';
import { jobTitle } from './Titles.js';
import { Combat } from '../fighters/Combat.js';
import { DT, Fighter } from '../fighters/Fighter.js';
import { BY_ID, ladderFor, ROSTER, STAGES, stageFor } from '../fighters/Roster.js';
import { Audio } from '../systems/Audio.js';
import { Effects } from '../systems/Effects.js';
import { Hazards } from '../systems/Hazards.js';
import { HumanController } from '../systems/Input.js';
import { HUD } from '../ui/HUD.js';
import { renderPortraits } from '../ui/Portraits.js';
import { Touch } from '../ui/Touch.js';
import { UI } from '../ui/UI.js';
import { clamp, damp, pick } from '../utils/math.js';
import { Arena } from '../world/Arena.js';
import { submitScore } from '../../../../src/shared/session.js';

const GAME_ID = 'office-brawl';
const DIFFICULTY = { easy: -0.2, normal: 0, hard: 0.22 };
const TAGLINES = [
  'Performance review in 3… 2… 1…',
  'This meeting could have been an email.',
  'Per my last punch…',
  "Let's take this offline. Violently.",
  'Synergy is about to happen.',
  'One of you is getting a calendar invite to HR.',
];
const WIN_LINES = ['Promotion secured!', 'Your manager is pretending they saw that.', 'HR has been notified. Of your greatness.', 'That was a 10/10 performance review.'];
const LOSE_LINES = ['You have been… let go.', 'Your access badge has been deactivated.', 'Please return your company laptop.', 'Your stapler now belongs to someone else.'];

const defaultSettings = { sound: true, music: true, voice: false, volume: 0.7, difficulty: 'normal', quality: 'auto', last: 'junior' };

function lowQuality(setting) {
  if (setting === 'low') return true;
  if (setting === 'high') return false;
  return window.matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
}

export class Game {
  constructor(canvas, session) {
    this.canvas = canvas;
    this.session = session;
    this.settingsKey = `officeBrawl.${(session?.username ?? 'guest').toLowerCase()}.settings`;
    this.settings = { ...defaultSettings };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem(this.settingsKey) || '{}'));
    } catch {
      /* storage unavailable */
    }
    this.low = lowQuality(this.settings.quality);

    const r = new THREE.WebGLRenderer({ canvas, antialias: !this.low, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.low ? 1.25 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = this.low ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    this.scene = new THREE.Scene();
    // Soft image-based lighting so skin, fabric and metal shade naturally.
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(-4, 12, 9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 10, bottom: -6, near: 1, far: 40 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight(0xbfd7ff, 0.6);
    fill.position.set(6, 4, 8);
    this.scene.add(fill);

    this.audio = new Audio(this.settings);
    this.fx = new Effects(this.scene, document.getElementById('fx-layer'), this.low);
    this.hazards = new Hazards(this);
    this.combat = new Combat(this);
    this.arena = new Arena(this.scene, this.low);
    this.human = new HumanController();
    this.human.onPause = () => this.togglePause();
    this.hud = new HUD();
    this.touch = new Touch(this.human, this.audio);
    this.ui = new UI(this);
    this.ui.bindSettings(this.settings, () => this.saveSettings(), this.audio);
    this.portraits = renderPortraits(this.renderer, ROSTER);

    this.cam = { x: 0, y: 2.3, dist: 10, trauma: 0, time: 0 };
    this.acc = 0;
    this.hitstopFrames = 0;
    this.superFreeze = 0;
    this.slowTimer = 0;
    this.match = null;
    this.mode = 'attract';
    this.paused = false;
    this.preview = null;
    this.profile = { bestScore: 0, highestLevel: 1 };
    this.careerScore = 0;
    this.rankTitle = jobTitle(0);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('keydown', () => this.audio.unlock());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'fight' && !this.paused) this.togglePause();
    });
    this.resize();
    this.toTitle();
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  saveSettings() {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.mode === 'fight') this.touch.show(true);
  }

  // --- profile -----------------------------------------------------------------------

  get ladderLength() {
    return ladderFor('junior').length;
  }

  isLocked(id) {
    if (id !== 'chairman') return false;
    let local = false;
    try {
      local = localStorage.getItem(`${this.settingsKey}.boss`) === '1';
    } catch {
      /* ignore */
    }
    return !(local || (this.profile?.highestLevel ?? 1) > this.ladderLength);
  }

  setProfile(progress, error) {
    this.profile = progress ?? { bestScore: 0, highestLevel: 1 };
    this.profileError = error;
    this.refreshTitle();
  }

  refreshTitle() {
    const p = this.profile;
    const reached = Math.min(p.highestLevel ?? 1, this.ladderLength);
    const ladder = ladderFor(this.settings.last);
    const stageName = (p.highestLevel ?? 1) > this.ladderLength ? '👑 Chairman defeated' : `Rung ${reached}: ${BY_ID[ladder[reached - 1]]?.role ?? '—'}`;
    this.ui.setPlayer(this.session?.username, jobTitle(p.bestScore ?? 0), p.bestScore ?? 0, stageName, this.profileError);
    this.ui.setCareerButton(Math.min(p.highestLevel ?? 1, this.ladderLength), this.ladderLength);
  }

  // --- flow ----------------------------------------------------------------------------

  action(name) {
    switch (name) {
      case 'career':
        this.mode = 'career';
        this.openSelect(false);
        break;
      case 'quick':
        this.mode = 'quick';
        this.openSelect(false);
        break;
      case 'confirm':
        this.confirmSelect();
        break;
      case 'fight':
        this.startCareerFight();
        break;
      case 'moves':
        this.ui.buildMoveList(ROSTER);
        this.ui.show('moves', { push: true });
        break;
      case 'settings':
        this.ui.show('settings', { push: true });
        break;
      case 'back':
        if (this.ui.current === 'select' && this.pickingRival) this.openSelect(false);
        else if (this.ui.current === 'select') this.toTitle();
        else this.ui.back();
        break;
      case 'resume':
        this.togglePause();
        break;
      case 'title':
        this.toTitle();
        break;
      case 'home':
        location.href = '/';
        break;
      case 'next':
        this.showLadder();
        break;
      case 'retry':
        if (this.fightMode === 'career') this.startCareerFight();
        else this.startQuick();
        break;
      case 'newcareer':
        this.career = { player: this.career.player, ladder: this.career.ladder, index: 0, kos: 0 };
        this.careerScore = 0;
        this.showLadder();
        break;
      case 'change':
        this.mode = 'quick';
        this.openSelect(false);
        break;
      default:
        break;
    }
  }

  clearMatch() {
    if (this.match) {
      this.match.dispose();
      this.match = null;
    }
    this.hazards.clear();
    this.fx.clear();
    this.hitstopFrames = 0;
    this.superFreeze = 0;
    this.slowTimer = 0;
    document.getElementById('flash').classList.remove('on');
  }

  clearPreview() {
    if (this.preview) {
      this.scene.remove(this.preview.container);
      this.preview.body.dispose();
      this.preview = null;
    }
  }

  setStage(id) {
    const s = this.arena.set(id);
    const [hc, gc, hi] = s.light.hemi;
    this.hemi.color.setHex(hc);
    this.hemi.groundColor.setHex(gc);
    this.hemi.intensity = hi * 0.7;
    this.sun.color.setHex(s.light.sun[0]);
    this.sun.intensity = s.light.sun[1];
    this.scene.background = new THREE.Color(s.light.bg);
    this.scene.fog = new THREE.Fog(s.light.fog, 22, 48);
    this.crowd = s.crowd;
  }

  toTitle() {
    this.paused = false;
    this.clearPreview();
    this.hud.show(false);
    this.touch.show(false);
    this.human.enabled = false;
    this.refreshTitle();
    this.ui.show('title');
    this.audio.setMusic('menu');
    this.startAttract();
  }

  // AI vs AI fights play behind the menus.
  startAttract() {
    this.clearMatch();
    this.mode = 'attract';
    const pool = ROSTER.filter((d) => !this.isLocked(d.id));
    const a = pick(pool);
    const b = pick(pool.filter((d) => d !== a));
    const stage = pick(['office', 'server', 'boardroom']);
    this.setStage(stage);
    this.match = new Match(this, a, b, { stage, aiLevel: 0.55, attract: true });
  }

  openSelect(rival) {
    this.pickingRival = rival;
    this.clearMatch();
    this.hud.show(false);
    this.setStage('office');
    if (!rival) this.selected = this.isLocked(this.settings.last) ? 'junior' : this.settings.last;
    else this.selected = pick(ROSTER.filter((d) => d.id !== this.playerId && !this.isLocked(d.id))).id;
    this.ui.buildRoster(ROSTER, this.portraits, { isLocked: (id) => this.isLocked(id), cpuPick: rival, selected: this.selected });
    this.hover(this.selected);
    this.ui.show('select');
    this.mode = this.mode === 'attract' ? 'quick' : this.mode;
  }

  hover(id) {
    this.selected = id;
    this.ui.highlight(id);
    const def = BY_ID[id];
    const locked = this.isLocked(id);
    this.ui.showInfo(def, locked);
    this.audio.select();
    this.clearPreview();
    if (locked) return;
    this.preview = new Fighter(this, def, 0);
    this.preview.resetRound(0, 1);
    this.preview.anim.snap(def.victory);
    this.previewT = 0;
    this.fx.bubble(pick(def.quotes), this.preview, 'quote', 2.2);
  }

  confirmSelect() {
    if (this.isLocked(this.selected)) return;
    if (!this.pickingRival) {
      this.playerId = this.selected;
      this.settings.last = this.selected;
      this.saveSettings();
      if (this.mode === 'quick') return this.openSelect(true);
      // Career: resume at the highest rung reached.
      const ladder = ladderFor(this.playerId).map((id) => BY_ID[id]);
      const start = Math.min((this.profile.highestLevel ?? 1) - 1, ladder.length - 1);
      this.career = { player: this.playerId, ladder, index: Math.max(0, start), kos: 0 };
      this.careerScore = 0;
      return this.showLadder();
    }
    this.rivalId = this.selected;
    this.startQuick();
  }

  showLadder() {
    this.clearPreview();
    this.clearMatch();
    this.hud.show(false);
    this.touch.show(false);
    this.setStage(this.career.ladder[this.career.index].id === 'chairman' ? 'boardroom' : 'office');
    this.ui.buildLadder(this.career.ladder, this.career.index, this.portraits);
    this.ui.show('career');
  }

  aiLevel(index, total) {
    const base = 0.18 + (index / Math.max(1, total - 1)) * 0.7;
    return clamp(base + (DIFFICULTY[this.settings.difficulty] ?? 0), 0.05, 1);
  }

  startCareerFight() {
    const c = this.career;
    const opp = c.ladder[c.index];
    this.beginFight(BY_ID[c.player], opp, stageFor(opp.id, c.index), this.aiLevel(c.index, c.ladder.length), c);
  }

  startQuick() {
    this.mode = 'quick';
    const lvl = clamp(0.5 + (DIFFICULTY[this.settings.difficulty] ?? 0), 0.05, 1);
    const opp = BY_ID[this.rivalId];
    this.beginFight(BY_ID[this.playerId], opp, stageFor(opp.id, Math.floor(Math.random() * 2)), lvl, null);
  }

  beginFight(a, b, stage, level, career) {
    this.clearPreview();
    this.clearMatch();
    this.mode = career ? 'career' : 'quick';
    this.setStage(stage);
    this.ui.showVs(a, b, this.portraits, pick(TAGLINES), STAGES[stage].name);
    this.audio.setMusic(b.boss ? 'boss' : 'fight');
    this.audio.announce(`${a.name} versus ${b.name}`);
    this.audio.whoosh(1.5);
    this.pendingFight = { a, b, stage, level, career, t: 2.4 };
  }

  launchFight() {
    const { a, b, stage, level, career } = this.pendingFight;
    this.pendingFight = null;
    this.ui.hideAll();
    this.match = new Match(this, a, b, { stage, aiLevel: level, career });
    this.mode = career ? 'career' : 'quick';
    this.hud.setFighters(this.match.p1, this.match.p2, this.portraits);
    this.hud.setRound(this.match);
    this.hud.setScore(career ? this.careerScore : 0);
    this.rankTitle = jobTitle(this.careerScore);
    this.hud.setTitle(this.rankTitle);
    this.hud.show(true);
    this.touch.setMoves(a);
    this.touch.show(true);
    this.human.enabled = true;
    this.mode = 'fight';
    this.fightMode = career ? 'career' : 'quick';
  }

  togglePause() {
    if (this.mode !== 'fight') return;
    if (this.ui.current && this.ui.current !== 'pause') {
      if (this.paused && ['moves', 'settings'].includes(this.ui.current)) this.ui.back();
      return;
    }
    this.paused = !this.paused;
    this.human.enabled = !this.paused;
    this.human.reset();
    this.touch.show(!this.paused);
    if (this.paused) this.ui.show('pause');
    else this.ui.hideAll();
  }

  // --- match callbacks -----------------------------------------------------------------

  onMatchEnd(res) {
    if (this.mode === 'attract') {
      setTimeout(() => this.mode === 'attract' && this.startAttract(), 600);
      return;
    }
    this.human.enabled = false;
    this.touch.show(false);
    this.hud.show(false);
    const s = res.stats;
    const rows = [
      ['Damage dealt', s.dmg],
      ['Best combo', `${s.maxCombo} hit${s.maxCombo === 1 ? '' : 's'}`],
      ['Rounds won', `${s.roundsWon} – ${s.roundsLost}`],
      ['Perfect rounds', s.perfects],
      ['Time bonus', `+${s.timeBonus}`],
    ];
    if (res.mult > 1) rows.push(['Rung multiplier', `×${res.mult.toFixed(2)}`]);

    if (this.fightMode === 'career') {
      const c = this.career;
      this.careerScore += res.score;
      c.kos += s.kos;
      if (res.won) {
        c.index++;
        if (c.index >= c.ladder.length) {
          try {
            localStorage.setItem(`${this.settingsKey}.boss`, '1');
          } catch {
            /* ignore */
          }
          this.fx.confetti(0, 4, 120);
          this.audio.win();
          this.ui.showResults({
            title: 'CORNER OFFICE!',
            line: 'You beat the Chairman. The corner office (and the Chairman) are now yours.',
            rows: [...rows, ['Career K.O.s', c.kos]],
            score: this.careerScore,
            rank: jobTitle(this.careerScore),
            buttons: [['title', 'Title screen', true], ['newcareer', 'New career', false]],
          });
          this.save({ score: this.careerScore, level: c.ladder.length, kos: c.kos, outcome: 'victory' });
          return;
        }
        this.audio.win();
        this.ui.showResults({
          title: 'PROMOTED!',
          line: pick(WIN_LINES),
          rows,
          score: this.careerScore,
          rank: jobTitle(this.careerScore),
          buttons: [['next', 'Next rung ▶', true], ['title', 'Title', false]],
        });
        // `level` is the rung just beaten; the server unlocks the next one on a win.
        this.save({ score: this.careerScore, level: c.index, kos: c.kos, outcome: 'victory' });
      } else {
        this.audio.lose();
        this.ui.showResults({
          title: 'FIRED!',
          line: pick(LOSE_LINES),
          rows,
          score: this.careerScore,
          rank: jobTitle(this.careerScore),
          buttons: [['retry', 'Appeal (retry)', true], ['title', 'Title', false]],
        });
        this.save({ score: this.careerScore, level: c.index + 1, kos: c.kos, outcome: 'gameover' });
        this.careerScore = 0;
      }
      return;
    }

    // Quick match.
    if (res.won) this.audio.win();
    else this.audio.lose();
    this.ui.showResults({
      title: res.won ? 'YOU WIN!' : 'YOU LOSE',
      line: pick(res.won ? WIN_LINES : LOSE_LINES),
      rows,
      score: res.score,
      rank: jobTitle(res.score),
      buttons: [['retry', 'Rematch', true], ['change', 'Change fighters', false], ['title', 'Title', false]],
    });
    this.save({ score: res.score, level: 1, kos: s.kos, outcome: res.won ? 'victory' : 'gameover' });
  }

  // Saves to the player's account; the database keeps the best score and highest rung.
  save({ score, level, kos, outcome }) {
    this.ui.setSave('', 'Saving to your profile…');
    submitScore({ game: GAME_ID, score, level, snacks: kos, timeSec: 0, outcome })
      .then(({ progress, newBest }) => {
        this.profile = progress;
        this.ui.setSave('ok', newBest ? `✓ New personal best saved to ${this.session.username}!` : `✓ Saved to ${this.session.username} · Rank #${progress.rank}`);
        this.refreshTitle();
      })
      .catch((err) => this.ui.setSave('error', `⚠ Not saved: ${err.message}`));
  }

  onCombo(att, hits, name) {
    if (this.mode === 'attract') return;
    this.hud.combo(att.slot, hits, name);
    if (att.slot === 0 && hits >= 3) this.audio.cheer(0.6);
  }

  // --- effects hooks ------------------------------------------------------------------------

  hitstop(frames) {
    this.hitstopFrames = Math.max(this.hitstopFrames, frames);
  }

  slowmo(seconds) {
    this.slowTimer = seconds;
  }

  shake(amount) {
    this.cam.trauma = Math.min(1, this.cam.trauma + amount);
  }

  superFlash(fighter, move) {
    this.superFreeze = 40;
    this.superCaster = fighter;
    const flash = document.getElementById('flash');
    flash.style.setProperty('--band', fighter.def.color);
    flash.querySelector('.flash-name').textContent = move.name;
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    this.audio.superStart();
    this.audio.announce(move.name);
    this.crowd?.react(2);
    if (this.mode !== 'attract') this.fx.text('OVERTIME!', fighter.headPos(), 'gold', 1);
  }

  // --- loop -----------------------------------------------------------------------------------

  frame(dt) {
    const scale = this.slowTimer > 0 ? 0.35 : 1;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    const sdt = dt * scale;

    if (this.pendingFight) {
      this.pendingFight.t -= dt;
      if (this.pendingFight.t <= 0) this.launchFight();
    }

    if (this.match && !this.paused) {
      this.acc += sdt;
      let steps = 0;
      while (this.acc >= DT && steps < 5) {
        this.acc -= DT;
        steps++;
        if (this.superFreeze > 0) {
          if (--this.superFreeze === 0) document.getElementById('flash').classList.remove('on');
          continue;
        }
        if (this.hitstopFrames > 0) {
          this.hitstopFrames--;
          continue;
        }
        this.match.step();
        if (!this.match) break;
      }
      this.match?.render(this.superFreeze > 0 ? dt * 0.4 : sdt);
      if (this.mode === 'fight' && this.match) {
        this.hud.update(this.match, dt);
        this.checkTitle();
      }
    }
    if (this.preview) {
      this.previewT += dt;
      if (this.previewT > 2.6) {
        this.previewT = 0;
        this.preview.anim.set(Math.random() < 0.5 ? 'idle' : this.preview.def.victory, 8);
      }
      this.preview.sync(dt);
    }

    this.arena.update(dt);
    this.fx.update(this.paused ? 0 : sdt, this.camera, this.w, this.h);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  checkTitle() {
    // Once the match is over its score is already in careerScore.
    if (this.fightMode !== 'career' || !this.match || this.match.over) return;
    const live = this.careerScore + (this.match ? this.match.result().score : 0);
    const t = jobTitle(live);
    if (t.min > this.rankTitle.min) {
      this.rankTitle = t;
      this.hud.setTitle(t, true);
      this.fx.text(`PROMOTED: ${t.title}!`, this.match.p1.headPos(), 'gold', 1.6);
      this.audio.powerUp();
    }
  }

  updateCamera(dt) {
    const c = this.cam;
    c.time += dt;
    let tx = 0;
    let ty = 2.3;
    let dist = 10;
    const portrait = this.w < this.h;
    if (this.preview) {
      // Frame the preview fighter in the open space above the roster cards.
      tx = portrait ? 0 : 0.9;
      ty = portrait ? 0.2 : 0.55;
      dist = portrait ? 13 : 9.5;
    } else if (this.match) {
      const a = this.match.p1;
      const b = this.match.p2;
      const sep = Math.abs(a.x - b.x);
      tx = clamp((a.x + b.x) / 2, -5.2, 5.2);
      ty = 2.2 + Math.max(a.y, b.y) * 0.3;
      dist = clamp(9.2 + sep * 0.55, 9.8, 14) * (portrait ? 1.55 : 1);
      if (this.superFreeze > 0 && this.superCaster) {
        tx = this.superCaster.x;
        ty = 2.0;
        dist = 5.4 * (portrait ? 1.3 : 1);
      }
      if (this.ui.current === 'title' || this.ui.current === 'career') {
        tx += this.ui.current === 'title' ? -2.2 : 0;
      }
    }
    const k = this.superFreeze > 0 ? 9 : 4;
    c.x = damp(c.x, tx, k, dt);
    c.y = damp(c.y, ty, k, dt);
    c.dist = damp(c.dist, dist, k, dt);
    c.trauma = Math.max(0, c.trauma - dt * 1.6);
    const s = c.trauma * c.trauma;
    const t = c.time * 40;
    this.camera.position.set(c.x + Math.sin(t) * s * 0.4, c.y + 0.5 + Math.cos(t * 1.3) * s * 0.3, c.dist);
    this.camera.lookAt(c.x, c.y - 0.35, 0);
  }
}
