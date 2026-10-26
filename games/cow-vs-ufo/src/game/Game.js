import * as THREE from 'three';
import { GameLoop } from './GameLoop.js';
import { GameState, STATES } from './GameState.js';
import { levelConfig } from './Levels.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { BEAM_RADIUS, UFO } from '../enemies/UFO.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { FunnyEvents } from '../systems/FunnyEvents.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { Settings } from '../systems/Settings.js';
import { bindEndScreens, showGameOver, showVictory } from '../ui/GameOverScreen.js';
import { HUD } from '../ui/HUD.js';
import { bindMainMenu } from '../ui/MainMenu.js';
import { bindPauseMenu } from '../ui/PauseMenu.js';
import { TouchControls } from '../ui/TouchControls.js';
import { UIManager } from '../ui/UIManager.js';
import { Effects } from '../utils/Effects.js';
import { distXZ, pick, rand } from '../utils/math.js';
import { submitScore } from '../../../../src/shared/session.js';
import { titleFor } from '../../../../src/shared/titles.js';
import { Collectibles } from '../world/Collectibles.js';
import { Critters } from '../world/Critters.js';
import { Obstacles } from '../world/Obstacles.js';
import { Terrain } from '../world/Terrain.js';
import { World } from '../world/World.js';

const MAX_HEARTS = 3;
const GAME_ID = 'cow-vs-ufo';

const TIPS = [
  'Tip: cows cannot fly. Yet.',
  'Tip: mooing inside a barn is a terrible hiding strategy.',
  'Tip: the red ring means "run". It always means "run".',
  'Tip: anvils fall down. Cows should go sideways.',
  'Tip: golden corn rides the balloons. Balloons do not have railings.',
  'Tip: the giant chicken does not accept apologies.',
  'Tip: if the UFO steals your roof, it looks fabulous in it.',
  'Tip: "FREE GRASS" is always a trap. Always.',
];
// The yard centre is kept clear of trees, so the menu camera has room to orbit.
const MENU_SPOT = new THREE.Vector3(1, 0, 1);
const tmp = new THREE.Vector3();

function detectLowQuality(setting) {
  if (setting === 'low') return true;
  if (setting === 'high') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return coarse || (navigator.hardwareConcurrency ?? 8) <= 4;
}

export class Game {
  constructor(canvas, session = null) {
    this.canvas = canvas;
    this.session = session;
    this.profile = null;
    this.settings = Settings.load(session?.username);
    this.lowQuality = detectLowQuality(this.settings.quality);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lowQuality, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowQuality ? 1.25 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.lowQuality ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
    this.state = new GameState();
    this.level = levelConfig(1);
    this.hearts = MAX_HEARTS;

    this.audio = new AudioSystem(this.settings);
    this.effects = new Effects(this.scene, document.getElementById('fx-layer'), { lowQuality: this.lowQuality });
    this.terrain = new Terrain();
    this.collision = new CollisionSystem(this.terrain);
    this.world = new World(this.scene, this.terrain, this.collision, { lowQuality: this.lowQuality });
    this.player = new Player(this, this.settings.skin, this.settings.accessory);
    this.obstacles = new Obstacles(this);
    this.collectibles = new Collectibles(this);
    this.critters = new Critters(this);
    this.ufo = new UFO(this);
    this.score = new ScoreSystem();
    this.hud = new HUD();
    this.events = new FunnyEvents(this);
    this.input = new PlayerController(canvas);
    this.touch = new TouchControls(this.input, this.audio);
    this.cam = new ThirdPersonCamera(this.camera, this.collision, this.terrain);
    this.effects.camRig = this.cam;

    this.ui = new UIManager(this.audio);
    this.menuUI = bindMainMenu(this.ui, this);
    bindPauseMenu(this.ui, this);
    bindEndScreens(this.ui, this);

    // Keyboard game controls only swallow keys (Space, arrows) while playing,
    // so menu buttons stay keyboard-accessible.
    this.state.onChange((s) => (this.input.enabled = s === STATES.PLAYING));
    this.input.enabled = false;
    this.wasInBeam = false;
    this.timers = [];
    this.wardrobeFocus = false;
    this.menuHop = 2;

    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.is(STATES.PLAYING)) this.pause();
    });
    this.resize();
    this.toMenu();

    this.loop = new GameLoop((dt) => this.frame(dt));
    this.loop.start();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  // Small timer queue so delayed reactions don't need setTimeout (which keeps
  // running while paused).
  after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  runTimers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      timer.t -= dt;
      if (timer.t <= 0) {
        this.timers.splice(i, 1);
        timer.fn();
      }
    }
  }

  // --- flow -----------------------------------------------------------------------

  toMenu() {
    this.state.set(STATES.MENU);
    this.timers = [];
    this.events.stop();
    this.obstacles.reset();
    this.critters.reset();
    this.collectibles.hideAll();
    this.ufo.setMenu();
    this.world.resetBarns();
    this.effects.clear();
    this.hud.clearTransient();
    this.hud.show(false);
    this.touch.show(false);
    this.audio.beamOff();
    this.audio.setMusicMode('farm');
    MENU_SPOT.y = this.terrain.heightAt(MENU_SPOT.x, MENU_SPOT.z);
    this.player.reset(MENU_SPOT);
    this.player.heading = 0.6;
    this.player.frozen = true;
    this.wardrobeFocus = false;
    this.menuUI.refreshBest();
    this.ui.show('menu');
  }

  startLevel(n, { startScore = 0 } = {}) {
    this.audio.unlock();
    this.level = levelConfig(n);
    this.hearts = MAX_HEARTS;
    this.timers = [];
    this.wasInBeam = false;
    this.effects.clear();
    this.hud.clearTransient();
    this.events.stop();
    this.events.reset();
    this.events.timer = rand(this.level.eventMin * 0.6, this.level.eventMin);
    this.world.resetBarns();
    this.obstacles.reset();
    this.critters.reset();
    this.player.reset(this.world.spawnPoints[0]);
    this.player.frozen = false;
    this.score.reset(startScore, this.level.target);
    this.collectibles.reset(this.level.target);
    this.ufo.reset(this.level);
    this.cam.pitch = 0.42;
    this.cam.snapTo(this.player.pos, 0);
    this.input.reset();
    this.ui.hideAll();
    this.hud.show(true);
    this.touch.show(true);
    this.hud.setHearts(this.hearts, MAX_HEARTS);
    this.hud.setFood(0, this.level.target);
    this.hud.setScore(this.score.score);
    this.hud.levelIntro(n, this.level.name, pick(TIPS));
    this.rankTitle = titleFor(startScore);
    this.hud.setTitle(this.rankTitle);
    this.audio.setMusicMode('farm');
    this.state.set(STATES.PLAYING);
    this.canvas.focus?.();
  }

  restartLevel() {
    this.startLevel(this.level.n, { startScore: this.score.levelStart });
  }

  nextLevel() {
    this.startLevel(this.level.n + 1, { startScore: this.score.score });
  }

  pause() {
    if (!this.state.is(STATES.PLAYING)) return;
    this.state.set(STATES.PAUSED);
    this.audio.beamOff();
    this.touch.show(false);
    this.ui.show('pause');
  }

  resume() {
    if (!this.state.is(STATES.PAUSED)) return;
    this.ui.hideAll();
    this.input.reset();
    this.touch.show(true);
    if (this.ufo.state === 'beam') this.audio.beamOn();
    this.state.set(STATES.PLAYING);
  }

  gameOver(reason) {
    if (!this.state.is(STATES.PLAYING)) return;
    this.state.set(STATES.DYING);
    this.events.stop();
    this.audio.beamOff();
    this.audio.lose();
    this.touch.show(false);
    this.player.frozen = true;
    this.hud.setAbduct(0);
    this.after(1.8, () => {
      const newBest = this.score.commitBest();
      this.saveRun('gameover');
      this.hud.show(false);
      this.ufo.setMenu();
      // Bring the cow back to the farm (she may be in space or in the void).
      this.player.reset(this.world.spawnPoints[0]);
      this.player.frozen = true;
      this.state.set(STATES.GAMEOVER);
      showGameOver(this.ui, { reason, score: this.score.score, best: this.score.best, newBest, title: titleFor(this.score.score) });
    });
  }

  victory() {
    this.state.set(STATES.VICTORY);
    this.events.stop();
    this.ufo.retreat();
    this.player.frozen = true;
    this.player.dancing = true;
    this.player.invuln = 99;
    this.touch.show(false);
    this.hud.setAbduct(0);
    const bonus = this.score.levelBonus(this.hearts, this.level.parTime);
    this.score.add(bonus.total);
    this.score.commitBest();
    this.saveRun('victory');
    this.audio.win();
    this.hud.banner('🎉', 'All snacks eaten! The UFO rage-quits.', 2);
    for (let i = 0; i < 4; i++) {
      this.after(i * 0.45, () => this.effects.confetti(tmp.copy(this.player.pos).add(new THREE.Vector3(rand(-3, 3), 3, rand(-3, 3))), 50));
    }
    this.after(2.2, () => {
      this.hud.show(false);
      showVictory(this.ui, {
        food: this.score.food,
        golden: this.score.golden,
        time: this.score.time,
        bonus,
        score: this.score.score,
        best: this.score.best,
        title: titleFor(this.score.score),
      });
    });
  }

  // --- gameplay callbacks ------------------------------------------------------------

  onCollect(item, pos) {
    const golden = item.type === 'golden';
    const { gained, mult } = this.score.eat(item.points ?? (golden ? 500 : 100), golden);
    this.effects.sparkle(pos, golden ? [0xffd700, 0xfff3b0, 0xffffff] : undefined);
    this.effects.popup(mult > 1 ? `+${gained} ×${mult}` : `+${gained}`, pos, golden ? 'gold' : 'pts');
    if (golden) this.audio.golden();
    else this.audio.collect();
    this.player.cow.squish(-0.2);
    this.checkWin();
  }

  checkWin() {
    this.hud.setFood(Math.min(this.score.food, this.level.target), this.level.target);
    if (this.score.food >= this.level.target && this.state.is(STATES.PLAYING)) this.victory();
  }

  onTrapSprung(pos) {
    this.ufo.onTrapSprung(pos);
    this.score.eat(100, false);
    this.effects.popup('Free grass! (it was a trap)', tmp.copy(pos).setY(pos.y + 3), 'pts', 1.6);
    this.audio.clang();
    this.checkWin();
  }

  onMoo() {
    this.critters.scare(this.player.pos);
    if (this.player.hidden && this.ufo.state === 'search') {
      this.ufo.hideTime = 999;
      this.effects.popup('Shhh!!', tmp.copy(this.player.pos).setY(this.player.pos.y + 3.5), 'pts');
    }
  }

  hurtPlayer(reason) {
    const pl = this.player;
    if (pl.invuln > 0 || pl.busy || !this.state.is(STATES.PLAYING)) return;
    this.loseHeart(reason, false);
  }

  loseHeart(reason, respawn) {
    if (!this.state.is(STATES.PLAYING)) return;
    this.hearts--;
    this.score.heartsLost++;
    this.player.noteHazard(reason);
    this.hud.setHearts(this.hearts, MAX_HEARTS, this.hearts);
    this.audio.heartLost();
    this.effects.shake(0.5);
    if (this.hearts <= 0) {
      this.gameOver(reason);
      return;
    }
    if (respawn) this.respawnPlayer();
    else this.player.invuln = 2;
  }

  onPlayerFell() {
    if (!this.state.is(STATES.PLAYING) || this.player.busy) return;
    const pl = this.player;
    const recent = pl.time - pl.lastHazardTime < 4;
    const reason = recent && pl.lastHazard === 'chicken' ? 'chicken' : 'fall';
    this.audio.fall();
    this.hud.banner('🪂', reason === 'chicken' ? 'The chicken sends its regards.' : 'Cows cannot fly. Noted.', 1.8);
    this.loseHeart(reason, true);
  }

  onAbducted() {
    this.ufo.celebrate();
    this.effects.popup('ABDUCTED!', tmp.copy(this.ufo.root.position).setY(this.ufo.root.position.y + 2.5), 'comic bad', 1.4);
    this.loseHeart('abducted', true);
  }

  respawnPlayer() {
    // Respawn at the spawn point farthest from the UFO.
    const u = this.ufo.root.position;
    let best = this.world.spawnPoints[0];
    for (const p of this.world.spawnPoints) if (distXZ(p, u) > distXZ(best, u)) best = p;
    this.player.reset(best);
    this.player.invuln = 2.5;
    if (this.events.active?.id === 'lowGravity') this.player.phys.gravityScale = 0.38;
    if (this.events.active?.id === 'disco') this.player.dancing = true;
    this.effects.smoke(tmp.copy(best).setY(best.y + 1), 14);
    this.audio.pop();
    this.wasInBeam = false;
  }

  // --- player profile ------------------------------------------------------------

  setProfile(progress, error) {
    this.profile = progress ?? { bestScore: 0, highestLevel: 1 };
    if (this.profile.bestScore > this.score.best) this.score.best = this.profile.bestScore;
    this.menuUI.refreshProfile(this.session?.username, this.profile, error);
  }

  // Saves a finished run to the player's profile in the database.
  saveRun(outcome) {
    const run = {
      game: GAME_ID,
      score: this.score.score,
      level: this.level.n,
      snacks: this.score.food,
      timeSec: Math.round(this.score.time),
      outcome,
    };
    this.ui.setSaveStatus('saving', 'Saving to your profile…');
    submitScore(run)
      .then(({ progress, newBest }) => {
        this.profile = progress;
        if (progress.bestScore > this.score.best) this.score.best = progress.bestScore;
        this.ui.setSaveStatus('ok', newBest ? `✓ New personal best saved to ${this.session.username}!` : `✓ Saved to ${this.session.username} · Rank #${progress.rank}`);
        this.menuUI.refreshProfile(this.session.username, this.profile);
      })
      .catch((err) => this.ui.setSaveStatus('error', `⚠ Not saved: ${err.message}`));
  }

  continueGame() {
    this.startLevel(Math.max(1, this.profile?.highestLevel ?? 1));
  }

  // Funny rank titles unlock live as the run score climbs.
  checkTitle() {
    const t = titleFor(this.score.score);
    if (t.min <= this.rankTitle.min) return;
    this.rankTitle = t;
    this.hud.setTitle(t, true);
    this.hud.banner(t.icon, `NEW TITLE: ${t.title}!`, 2.6);
    this.audio.golden();
    this.effects.confetti(tmp.copy(this.player.pos).setY(this.player.pos.y + 3), 40);
  }

  applyWardrobe() {
    const s = this.settings;
    this.player.cow.setSkin(s.skin);
    this.player.cow.setAccessory(s.accessory);
    this.player.cow.squish(0.3);
    this.effects.sparkle(tmp.copy(this.player.pos).setY(this.player.pos.y + 1.5), [0xff8fab, 0xffe066, 0x9ff5ff]);
    this.audio.pop();
  }

  focusWardrobe(on) {
    this.wardrobeFocus = on;
  }

  // --- per-frame ---------------------------------------------------------------------

  frame(dt) {
    const s = this.state.current;
    if (s !== STATES.PAUSED) this.runTimers(dt);
    switch (s) {
      case STATES.PLAYING:
        this.updatePlaying(dt);
        break;
      case STATES.DYING:
      case STATES.VICTORY:
        this.updateCinematic(dt);
        break;
      case STATES.MENU:
      case STATES.GAMEOVER:
        this.updateMenu(dt);
        break;
      case STATES.PAUSED:
        if (this.input.consumePause() && this.ui.current === 'pause') this.resume();
        break;
      default:
        break;
    }
    if (s !== STATES.PAUSED) this.effects.update(dt, this.camera, this.w, this.h);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  updatePlaying(dt) {
    const pl = this.player;
    const ufo = this.ufo;
    this.input.update();
    if (this.input.consumePause()) {
      this.pause();
      return;
    }
    const cd = this.input.consumeCam();
    this.cam.rotate(cd.x, cd.y, this.settings.sensitivity);
    this.score.update(dt);

    ufo.update(dt);

    // Tractor beam: stand in it too long and you're going to space.
    pl.inBeam = false;
    if (ufo.beaming && !pl.busy && !pl.hidden && pl.invuln <= 0 && distXZ(pl.pos, ufo.groundPoint) < BEAM_RADIUS) {
      pl.inBeam = true;
      pl.abductProgress += dt / this.level.abductTime;
      if (pl.abductProgress >= 1) {
        pl.abductProgress = 0;
        pl.inBeam = false;
        pl.startAbduction(ufo.root.position);
        this.audio.zap();
      }
    } else if (pl.abductProgress > 0) {
      if (this.wasInBeam && pl.abductProgress > 0.55 && !pl.busy) {
        this.score.add(250);
        this.score.closeCalls++;
        this.effects.popup('CLOSE CALL! +250', tmp.copy(pl.pos).setY(pl.pos.y + 3), 'gold', 1.4);
        this.audio.golden();
      }
      pl.abductProgress = Math.max(0, pl.abductProgress - dt * 0.8);
    }
    this.wasInBeam = pl.inBeam;

    const ufoDist = distXZ(pl.pos, ufo.root.position);
    pl.update(dt, this.input, this.cam.yaw, {
      ufoPos: ufo.root.position,
      ufoDist,
      danger: pl.inBeam || (ufo.state === 'charge' && ufoDist < 8),
    });
    pl.phys.external.set(0, 0, 0);

    for (const barn of this.world.barns) {
      this.world.setBarnFade(barn, pl.hidden?.barn === barn && barn.roofState === 'home');
    }

    this.obstacles.update(dt);
    this.collectibles.update(dt);
    this.critters.update(dt);
    if (this.state.is(STATES.PLAYING)) this.events.update(dt);
    this.world.update(dt, pl.pos);
    const indoor = !!this.collision.hideZoneAt(pl.pos.x, pl.pos.z, true) && pl.pos.y < 4;
    this.cam.update(dt, pl.pos, false, indoor);

    // HUD.
    const hud = this.hud;
    hud.setScore(this.score.score);
    hud.setCombo(this.score.combo > 1 ? Math.min(4, this.score.combo) : 0);
    this.checkTitle();
    hud.setTime(this.score.time);
    hud.setAbduct(pl.inBeam || pl.abductProgress > 0.02 ? pl.abductProgress : 0);
    hud.setHidden(!!pl.hidden);
    const left = Math.max(0, this.level.target - this.score.food);
    let objective = `Eat ${left} more snack${left === 1 ? '' : 's'} — don't get abducted!`;
    if (pl.trapped > 0) objective = 'Mash JUMP to break out of the cage!';
    else if (pl.inBeam) objective = 'RUN! Get out of the beam!';
    else if (pl.hidden) objective = 'Hiding… the UFO will get impatient.';
    else if (ufo.hat) objective = 'The UFO is wearing a barn as a hat. Keep eating!';
    hud.setObjective(objective);
  }

  // Victory dance / dying: the world keeps moving but the player has no control.
  updateCinematic(dt) {
    const pl = this.player;
    this.input.update();
    this.input.consumeCam();
    this.ufo.update(dt);
    pl.inBeam = false;
    pl.update(dt, this.input, this.cam.yaw, { ufoPos: this.ufo.root.position, ufoDist: 99 });
    pl.phys.external.set(0, 0, 0);
    this.obstacles.update(dt);
    this.critters.update(dt);
    this.world.update(dt, pl.pos);
    if (this.state.is(STATES.VICTORY)) {
      this.cam.updateOrbit(dt, pl.pos, 9, 5);
      if (Math.random() < dt * 4) this.effects.confetti(tmp.copy(pl.pos).setY(pl.pos.y + 4), 6);
    } else {
      this.cam.update(dt, pl.pos);
    }
  }

  updateMenu(dt) {
    const pl = this.player;
    this.input.update();
    this.input.consumeCam();
    this.input.consumePause();
    this.input.consumeJump();
    this.ufo.update(dt);
    this.critters.update(dt);
    this.obstacles.updatePlatforms(dt);
    this.world.update(dt, pl.pos);

    // The menu cow idles, looks at the UFO and does the occasional happy hop.
    this.menuHop -= dt;
    if (this.menuHop <= 0) {
      this.menuHop = rand(2.5, 5);
      pl.cow.squish(0.3);
      if (Math.random() < 0.3) this.effects.popup('moo', tmp.copy(pl.pos).setY(pl.pos.y + 3), 'pts');
    }
    pl.cow.setExpression(this.wardrobeFocus ? 'joy' : 'happy');
    pl.cow.root.position.copy(pl.pos);
    pl.cow.root.rotation.y = pl.heading;
    pl.cow.root.visible = true;
    pl.cow.update(dt, { speed: 0, grounded: true, vy: 0, lookAt: this.ufo.root.position, dancing: this.state.is(STATES.MENU) && this.wardrobeFocus });

    if (this.wardrobeFocus) this.cam.updateOrbit(dt, pl.pos, 6, 1.8);
    else this.cam.updateOrbit(dt, pl.pos, 15, 8);
  }
}
