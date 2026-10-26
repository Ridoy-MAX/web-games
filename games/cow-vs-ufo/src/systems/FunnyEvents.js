import { pick, rand, weightedPick } from '../utils/math.js';

// Random silly events. Only one runs at a time and there's always a breather
// between them so normal play stays readable.
const EVENTS = [
  { id: 'lowGravity', icon: '🪶', title: 'Gravity took a coffee break!', duration: 8, weight: 3, minLevel: 1 },
  { id: 'bananas', icon: '🍌', title: "It's raining banana peels!", duration: 2, weight: 3, minLevel: 1 },
  { id: 'earthquake', icon: '🌋', title: 'Earthquake! The ground is nervous.', duration: 4, weight: 2, minLevel: 1 },
  { id: 'chicken', icon: '🐔', title: 'A GIANT CHICKEN wants revenge!', duration: 12, weight: 3, minLevel: 1 },
  { id: 'burger', icon: '🍔', title: 'Rogue cheeseburger incoming!', duration: 5, weight: 2, minLevel: 2 },
  { id: 'disco', icon: '🪩', title: 'UFO disco break! Dance, cow, dance!', duration: 7, weight: 2, minLevel: 1 },
  { id: 'cowNap', icon: '🛸', title: 'The UFO got distracted by another cow…', duration: 9, weight: 2, minLevel: 1 },
  { id: 'hiccups', icon: '😵', title: 'Your cow has the hiccups!', duration: 6, weight: 2, minLevel: 1 },
];

const IDLE_UFO = ['hunt', 'cooldown', 'search'];

export class FunnyEvents {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.active = null;
    this.lastId = null;
    this.timer = 13;
  }

  announce(icon, text, duration = 3) {
    this.game.hud.banner(icon, text, duration);
  }

  update(dt) {
    const g = this.game;
    if (this.active) {
      this.active.t += dt;
      this.tick(this.active, dt);
      if (this.active.t >= this.active.duration) {
        this.finish(this.active);
        this.active = null;
        const cfg = g.level;
        this.timer = rand(cfg.eventMin, cfg.eventMax);
      }
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    // Wait for a calm moment: no abduction, no special attack in progress.
    if (g.player.busy || g.player.trapped > 0 || !IDLE_UFO.includes(g.ufo.state)) {
      this.timer = 1;
      return;
    }
    const options = EVENTS.filter((e) => e.minLevel <= g.level.n && e.id !== this.lastId);
    this.start(weightedPick(options));
  }

  start(def) {
    const g = this.game;
    this.lastId = def.id;
    const ev = { ...def, t: 0, hic: rand(0.4, 1) };
    this.active = ev;
    this.announce(def.icon, def.title, 2.6);
    g.audio.pop();
    switch (def.id) {
      case 'lowGravity':
        g.player.phys.gravityScale = 0.38;
        break;
      case 'bananas':
        g.obstacles.spawnPeels(7 + g.level.n);
        break;
      case 'earthquake':
        g.audio.rumble(def.duration);
        break;
      case 'chicken':
        g.critters.spawnGiantChicken();
        break;
      case 'burger':
        g.obstacles.rollBurger();
        break;
      case 'disco':
        g.ufo.startDisco();
        g.critters.dancing = true;
        g.player.dancing = true;
        g.audio.setMusicMode('disco');
        g.hud.setDisco(true);
        break;
      case 'cowNap': {
        const npc = g.critters.pickCow();
        if (npc) g.ufo.distract(npc);
        else ev.duration = 0;
        break;
      }
      default:
        break;
    }
  }

  tick(ev, dt) {
    const g = this.game;
    if (ev.id === 'earthquake') {
      g.effects.shake(dt * 3);
      if (Math.random() < dt * 2.5) g.player.hop(rand(4, 7));
      if (Math.random() < dt * 8) g.effects.dust(g.player.pos, 2);
    } else if (ev.id === 'hiccups') {
      ev.hic -= dt;
      if (ev.hic <= 0) {
        ev.hic = rand(0.6, 1.3);
        g.player.hop(6.5);
        g.audio.hic();
        g.effects.popup(pick(['hic!', 'HIC!', '*hic*']), g.player.pos.clone().setY(g.player.pos.y + 2.6), 'pts');
      }
    } else if (ev.id === 'disco' && Math.random() < dt * 6) {
      g.effects.confetti(g.ufo.root.position.clone().setY(g.ufo.root.position.y - 1), 3);
    }
  }

  finish(ev) {
    const g = this.game;
    switch (ev.id) {
      case 'lowGravity':
        g.player.phys.gravityScale = 1;
        this.announce('🪨', 'Gravity is back. Sorry about that.', 1.6);
        break;
      case 'disco':
        this.endDisco();
        break;
      default:
        break;
    }
  }

  endDisco() {
    const g = this.game;
    g.ufo.stopDisco();
    g.critters.dancing = false;
    g.player.dancing = false;
    g.audio.setMusicMode('farm');
    g.hud.setDisco(false);
  }

  // Called when the level ends so nothing lingers.
  stop() {
    if (this.active) {
      if (this.active.id === 'disco') this.endDisco();
      if (this.active.id === 'lowGravity') this.game.player.phys.gravityScale = 1;
    }
    this.active = null;
  }
}
