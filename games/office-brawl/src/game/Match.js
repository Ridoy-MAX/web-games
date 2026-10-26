import * as THREE from 'three';
import { Fighter } from '../fighters/Fighter.js';
import { makeProp } from '../fighters/Props.js';
import { AIController } from '../systems/AI.js';
import { disposeObject } from '../utils/materials.js';
import { pick, rand } from '../utils/math.js';

const ROUND_NAMES = ['DAILY STAND-UP', 'SPRINT PLANNING', 'FINAL RETRO', 'OVERTIME', 'ALL-HANDS'];
const FIGHT_WORDS = ['FIGHT!', 'SYNERGIZE!', 'CIRCLE BACK!', 'DISRUPT!'];
const ROUND_TIME = 60 * 60;

// Silly K.O. animations, one per character.
const GAGS = {
  chair(f, g) {
    const chair = makeProp('chair');
    chair.position.set(f.x, 0, 0);
    g.scene.add(chair);
    const dir = f.x > 0 ? 1 : -1;
    let t = 0;
    return {
      props: [chair],
      update(dt) {
        t += dt;
        f.anim.set('jump', 8);
        f.body.body.rotation.x = 0;
        f.body.body.position.y = 0.2;
        if (t > 0.6) {
          f.state = 'gag';
          const v = Math.min(9, (t - 0.6) * 9);
          chair.position.x += dir * v * dt;
          chair.rotation.y += dt * 9;
          f.x = chair.position.x;
          f.container.rotation.y = chair.rotation.y;
        }
      },
    };
  },
  feature(f, g) {
    let t = 0;
    let z = false;
    return {
      update(dt) {
        t += dt;
        if (t > 1.6 && !z) {
          z = true;
          g.fx.text('zZz… still a feature', f.headPos(), 'tiny', 1.5);
        }
      },
    };
  },
  '404'(f, g) {
    let t = 0;
    let sign = null;
    const self = {
      props: [],
      update(dt) {
        t += dt;
        if (t > 0.7 && !sign) {
          g.fx.smoke(f.x, 1);
          g.audio.pop();
          f.state = 'gone';
          sign = makeProp('sign404');
          sign.position.set(f.x, 0, 0.2);
          g.scene.add(sign);
          self.props.push(sign);
        }
        if (sign) sign.rotation.z = Math.sin(t * 6) * 0.05;
      },
    };
    return self;
  },
  complaint(f, g) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (Math.random() < dt * 8) g.fx.papers(f.x, 1.2);
      },
    };
  },
  reschedule(f, g) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (t > 0.8) {
          const s = Math.max(0.001, 1 - (t - 0.8) * 0.8);
          f.body.root.scale.setScalar(s);
          f.container.rotation.y += dt * 6;
          if (s < 0.05 && f.state !== 'gone') {
            f.state = 'gone';
            g.fx.smoke(f.x, 0.5);
            g.fx.text('⏭ Moved to next sprint', new THREE.Vector3(f.x, 1.5, 0), 'tiny', 1.6);
          }
        }
      },
    };
  },
  sticky(f, g) {
    let t = 0;
    const notes = [];
    return {
      props: notes,
      update(dt) {
        t += dt;
        if (notes.length < 22 && Math.random() < dt * 14) {
          const n = makeProp('sticky');
          n.scale.setScalar(0.7);
          n.position.set(rand(-0.6, 0.6), rand(0.2, 1.4), rand(-0.3, 0.6));
          n.rotation.set(rand(-1.5, -1.2), 0, rand(0, 6));
          f.body.body.add(n);
          notes.push(n);
        }
      },
    };
  },
  paid(f, g) {
    return { update() {} };
  },
  parachute(f, g) {
    const chute = makeProp('parachute');
    let t = 0;
    f.container.add(chute);
    return {
      props: [chute],
      update(dt) {
        t += dt;
        if (t > 0.5) {
          f.state = 'gag';
          f.anim.set('cheer', 6);
          f.body.body.rotation.x = 0;
          f.y += dt * 1.6;
          f.x += dt * 0.8 * (f.x > 0 ? 1 : -1);
          if (Math.random() < dt * 10) g.fx.coins(f.x, f.y + 1, 2);
        }
      },
    };
  },
};

// One fight: best of three rounds between a human and a CPU coworker.
export class Match {
  constructor(game, p1Def, p2Def, { stage, aiLevel = 0.4, career = null, attract = false } = {}) {
    this.game = game;
    this.career = career;
    this.attract = attract;
    this.stage = stage;
    this.p1 = new Fighter(game, p1Def, 0);
    this.p2 = new Fighter(game, p2Def, 1);
    this.p1.opp = this.p2;
    this.p2.opp = this.p1;
    this.ai = new AIController(game, aiLevel);
    this.ai.setFighter(this.p2);
    // In attract mode (behind the menus) both fighters are CPU-controlled.
    this.human = attract ? new AIController(game, aiLevel) : game.human;
    if (attract) this.human.setFighter(this.p1);
    this.round = 0;
    this.stats = { dmg: 0, taken: 0, maxCombo: 0, perfects: 0, roundsWon: 0, roundsLost: 0, timeBonus: 0, kos: 0 };
    this.gag = null;
    this.over = false;
    this.p1.meter = 0;
    this.p2.meter = 0;
    this.nextRound();
  }

  get fighters() {
    return [this.p1, this.p2];
  }

  nextRound() {
    this.round++;
    this.clearGag();
    this.game.hazards.clear();
    this.p1.resetRound(-2.6, 1);
    this.p2.resetRound(2.6, -1);
    this.p1.input = this.p2.input = null;
    this.human.reset();
    this.ai.reset();
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.t = 0;
    this.koFighter = null;
    this.winner = null;
    this.game.hud.setRound(this);
  }

  clearGag() {
    if (this.gag?.props) {
      for (const p of this.gag.props) {
        p.parent?.remove(p);
        disposeObject(p);
      }
    }
    this.gag = null;
  }

  // --- logic frame ------------------------------------------------------------

  step() {
    this.t++;
    const g = this.game;
    this.human.tick();
    this.ai.tick();

    if (this.phase === 'intro') {
      if (this.t === 1) {
        const name = ROUND_NAMES[Math.min(this.round - 1, ROUND_NAMES.length - 1)];
        g.hud.announce(`ROUND ${this.round}`, name);
        if (!this.attract) g.audio.announce(`Round ${this.round}`);
        if (this.round === 1) {
          g.fx.bubble(pick(['Let\'s sync on this.', 'I have a meeting in 5.', 'You\'re on mute.']), this.p2, 'special', 1.3);
        }
      }
      if (this.t === 75) {
        const w = pick(FIGHT_WORDS);
        g.hud.announce(w, '', 'fight');
        if (!this.attract) {
          g.audio.announce(w.replace('!', ''));
          g.audio.bell();
        }
      }
      if (this.t >= 100) {
        this.phase = 'fight';
        this.p1.input = this.human;
        this.p2.input = this.ai;
      }
    } else if (this.phase === 'fight') {
      this.timer--;
      if (this.timer % 60 === 0 && this.timer <= 600 && this.timer > 0 && !this.attract) g.audio.beep();
      if (this.timer <= 0) this.timeOver();
    } else if (this.phase === 'ko' || this.phase === 'timeover') {
      if (this.t === 70 && this.koFighter && this.koFighter.state !== 'ko' && !this.gag) this.startGag(this.koFighter);
      if (this.t === 150) this.celebrate();
      if (this.t === 330) this.endRound();
    }

    for (const f of this.fighters) f.step();
    g.hazards.update();
    this.separate();

    if (this.phase === 'fight') {
      const down = this.fighters.filter((f) => f.hp <= 0);
      if (down.length) this.onKo(down.length === 2 ? null : down[0]);
    }
  }

  separate() {
    const a = this.p1;
    const b = this.p2;
    if (['gone', 'gag', 'grabbed'].includes(a.state) || ['gone', 'gag', 'grabbed'].includes(b.state)) return;
    if (a.y > 1.2 || b.y > 1.2) return;
    const min = 0.8 * (a.scale + b.scale) / 2;
    const dx = b.x - a.x;
    const d = Math.abs(dx);
    if (d >= min) return;
    const push = (min - d) / 2;
    const dir = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
    a.x -= dir * push;
    b.x += dir * push;
  }

  onKo(fighter) {
    const g = this.game;
    this.phase = 'ko';
    this.t = 0;
    this.p1.input = this.p2.input = null;
    this.koFighter = fighter;
    this.winner = fighter ? fighter.opp : null;
    g.slowmo(1.2);
    if (!this.attract) {
      g.audio.bell();
      g.audio.cheer(1.5);
    }
    g.crowd?.react(3);
    g.shake(0.6);
    const perfect = this.winner && this.winner.hp >= this.winner.hpMax;
    g.hud.announce('K.O.', perfect ? 'PERFECT — ZERO BUGS FOUND' : pick(['LOGGED OFF', 'CONNECTION LOST', 'OUT OF OFFICE', 'SESSION EXPIRED']), 'ko');
    if (!this.attract) g.audio.announce(perfect ? 'Perfect' : 'K O');
    if (fighter) g.fx.bubble(fighter.def.koLine, fighter, 'ko', 2.6);
    this.scoreRound(perfect);
  }

  onKoLanded(fighter) {
    fighter.state = 'down';
    fighter.stun = 99999;
    fighter.anim.set(fighter.def.ko === 'paid' ? 'lying' : 'lying', 10);
    this.startGag(fighter);
  }

  startGag(fighter) {
    if (this.gag) return;
    const fn = GAGS[fighter.def.ko] ?? GAGS.feature;
    this.gag = fn(fighter, this.game);
  }

  timeOver() {
    const g = this.game;
    this.phase = 'timeover';
    this.t = 0;
    this.p1.input = this.p2.input = null;
    const r1 = this.p1.hp / this.p1.hpMax;
    const r2 = this.p2.hp / this.p2.hpMax;
    this.winner = r1 === r2 ? null : r1 > r2 ? this.p1 : this.p2;
    this.koFighter = null;
    g.hud.announce('TIME OVER', 'THE MEETING RAN LONG', 'ko');
    g.audio.bell();
    this.scoreRound(false);
  }

  scoreRound(perfect) {
    const s = this.stats;
    if (this.winner === this.p1) {
      s.roundsWon++;
      s.kos += this.koFighter ? 1 : 0;
      s.timeBonus += Math.ceil(this.timer / 60) * 15;
      if (perfect) s.perfects++;
      this.p1.roundsWon++;
    } else if (this.winner === this.p2) {
      s.roundsLost++;
      this.p2.roundsWon++;
    }
    this.game.hud.setRound(this);
  }

  celebrate() {
    const w = this.winner;
    if (!w) {
      this.game.hud.announce('DRAW', 'Both of you are getting a performance review', 'ko');
      return;
    }
    w.state = 'victory';
    w.vx = 0;
    w.anim.set(w.def.victory, 6);
    w.body.setExpression('happy');
    this.game.fx.bubble(pick(w.def.quotes), w, 'quote', 2.6);
    if (w === this.p1) this.game.audio.cheer(1);
  }

  endRound() {
    const winsNeeded = 2;
    if (this.p1.roundsWon >= winsNeeded || this.p2.roundsWon >= winsNeeded || this.round >= 5) {
      this.over = true;
      this.phase = 'over';
      this.game.onMatchEnd(this.result());
      return;
    }
    this.nextRound();
  }

  result() {
    const s = this.stats;
    const won = this.p1.roundsWon > this.p2.roundsWon;
    const base = s.dmg + s.maxCombo * 60 + s.perfects * 1500 + s.roundsWon * 400 + s.timeBonus + (won ? 1500 : 0);
    const mult = this.career ? 1 + (this.career.index ?? 0) * 0.15 : 1;
    return { won, score: Math.round(base * mult), stats: { ...s }, mult, p1: this.p1.def, p2: this.p2.def };
  }

  // --- hooks from combat ------------------------------------------------------------

  onHit(att, def) {
    if (att === this.p1) this.stats.maxCombo = Math.max(this.stats.maxCombo, def.comboHits);
  }

  onDamage(att, def, amount) {
    if (att === this.p1) this.stats.dmg += amount;
    else this.stats.taken += amount;
  }

  // Visual-rate update (gags animate smoothly even in slow motion).
  render(dt) {
    for (const f of this.fighters) f.sync(dt);
    this.gag?.update(dt);
  }

  dispose() {
    this.clearGag();
    for (const f of this.fighters) {
      this.game.scene.remove(f.container);
      f.body.dispose();
    }
  }
}
