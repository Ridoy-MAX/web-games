import * as THREE from 'three';
import { BODY_HEIGHT, Body } from './Body.js';
import { Animator } from './Poses.js';
import { ClipAnimator, ModelBody, hasModel } from './Models.js';
import { NORMALS } from './Moves.js';
import { clamp, damp } from '../utils/math.js';
import { mat, mesh } from '../utils/materials.js';

export const STAGE_HALF = 8.3;
export const DT = 1 / 60;
const GRAVITY = 40;
const JUMP_V = 13.5;
const JUMP_VX = 3.9;

const NEUTRAL = new Set(['idle', 'walk', 'crouch']);
const NO_HURTBOX = new Set(['down', 'getup', 'ko', 'victory', 'intro', 'gone']);

function makeWhip() {
  const g = new THREE.Group();
  const noodle = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), mat(0xf2d16b, { rough: 0.6 }));
  noodle.rotation.z = Math.PI / 2;
  noodle.position.x = 0.5;
  g.add(noodle);
  for (let i = 0; i < 3; i++) {
    const n = mesh(new THREE.TorusGeometry(0.12, 0.035, 5, 10), mat(0xf2d16b));
    n.position.set(0.3 + i * 0.3, Math.sin(i) * 0.08, 0);
    n.rotation.y = Math.PI / 2;
    g.add(n);
  }
  const meatball = mesh(new THREE.IcosahedronGeometry(0.16, 1), mat(0x7a3b1d));
  meatball.position.x = 1;
  g.add(meatball);
  g.visible = false;
  return g;
}

// One combatant: physics, the state machine, move execution and visuals.
// Logic runs at a fixed 60 Hz; `sync()` updates the 3D model every render frame.
export class Fighter {
  constructor(game, def, slot) {
    this.game = game;
    this.def = def;
    this.slot = slot;
    // Mixamo models when they're loaded, otherwise the built-in procedural body.
    this.body = hasModel(def.id) ? new ModelBody(def.id, def.look) : new Body(def.look);
    this.anim = this.body.animated ? new ClipAnimator(this.body) : new Animator(this.body);
    this.container = new THREE.Group();
    this.container.add(this.body.root);
    // Turned a little toward the camera so faces read in a side view.
    // Mixamo's stances already open the body to the side, so models need less turn.
    this.body.root.rotation.y = this.body.animated ? Math.PI / 2 - 0.12 : Math.PI / 2 - 0.45;
    game.scene.add(this.container);
    this.reach = def.reach ?? 1;
    this.scale = def.look.scale ?? 1;
    this.whip = def.specials.some((s) => s.whip) ? makeWhip() : null;
    if (this.whip) {
      this.whip.position.set(0.3, 1.55, 0.35);
      this.container.add(this.whip);
    }
    this.stars = this.makeStars();
    this.container.add(this.stars);
    this.input = null;
    this.hpMax = def.hp;
    this.meter = 0;
    this.roundsWon = 0;
    this.resetRound(0, 1);
  }

  makeStars() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = mesh(new THREE.OctahedronGeometry(0.11, 0), mat(0xffe14d, { emissive: 0xffc800, emissiveIntensity: 0.8 }), { cast: false });
      g.add(s);
    }
    g.position.y = BODY_HEIGHT * 1.06;
    g.visible = false;
    return g;
  }

  resetRound(x, facing) {
    this.x = x;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = this.hpMax;
    this.state = 'idle';
    this.frame = 0;
    this.move = null;
    this.moveFrame = 0;
    this.stun = 0;
    this.slow = 0;
    this.buffFrames = 0;
    this.buff = null;
    this.invuln = 0;
    this.comboHits = 0;
    this.comboDmg = 0;
    this.hitConfirmed = false;
    this.grabTarget = null;
    this.gag = null;
    this.tilt = 0;
    this.spin = 0;
    this.lastHitBy = null;
    this.body.root.visible = true;
    this.body.root.scale.setScalar(1);
    this.body.root.position.set(0, 0, 0);
    this.body.body.rotation.set(0, 0, 0);
    this.body.body.position.set(0, 0, 0);
    this.container.rotation.set(0, 0, 0);
    this.container.scale.set(facing, 1, 1);
    this.body.setExpression('normal');
    this.anim.snap('idle');
    if (this.whip) this.whip.visible = false;
    this.sync(0);
  }

  // --- helpers --------------------------------------------------------------

  get grounded() {
    return this.y <= 0.0001 && this.vy <= 0;
  }

  get speedMul() {
    return (this.slow > 0 ? 0.55 : 1) * (this.buffFrames > 0 ? this.buff.speed : 1);
  }

  get powerMul() {
    return this.def.power * (this.buffFrames > 0 ? this.buff.power : 1);
  }

  get crouching() {
    return this.state === 'crouch' || (this.state === 'attack' && this.move?.crouching) || (this.state === 'blockstun' && this.blockLow);
  }

  get hurtable() {
    return !NO_HURTBOX.has(this.state) && this.invuln <= 0;
  }

  hurtbox() {
    const hw = 0.45 * this.scale;
    const h = (this.crouching ? 0.64 : 1) * BODY_HEIGHT * this.scale;
    return { x0: this.x - hw, x1: this.x + hw, y0: this.y, y1: this.y + h };
  }

  headPos(out = new THREE.Vector3()) {
    return out.set(this.x, this.y + (this.crouching ? 0.78 : 1.06) * BODY_HEIGHT * this.scale, 0);
  }

  holdingBack() {
    const opp = this.opp;
    if (!opp || !this.input) return false;
    const awayRight = opp.x < this.x;
    return awayRight ? this.input.held.right : this.input.held.left;
  }

  faceOpponent() {
    if (!this.opp) return;
    const f = this.opp.x >= this.x ? 1 : -1;
    if (f !== this.facing && Math.abs(this.opp.x - this.x) > 0.05) this.facing = f;
  }

  gainMeter(n) {
    this.meter = clamp(this.meter + n, 0, 100);
  }

  toNeutral() {
    this.state = 'idle';
    this.move = null;
    this.grabTarget = null;
    this.vx = 0;
    if (this.whip) this.whip.visible = false;
    this.body.setExpression('normal');
    this.anim.set('idle', 14);
  }

  // --- input -> actions ----------------------------------------------------------

  neutralInput() {
    const inp = this.input;
    if (!inp) return;
    const fw = this.facing > 0 ? inp.held.right : inp.held.left;
    const bk = this.facing > 0 ? inp.held.left : inp.held.right;
    if (inp.take('sup') && this.meter >= 100) return this.doSuper();
    if (inp.take('s1') && this.doSpecial(0)) return;
    if (inp.take('s2') && this.doSpecial(1)) return;
    if (inp.take('hk')) return this.startMove(inp.held.down ? NORMALS.sweep : NORMALS.kick);
    if (inp.take('lp')) return this.startMove(inp.held.down ? NORMALS.lowJab : NORMALS.jab);
    if (inp.held.up) {
      this.state = 'jump';
      this.vy = JUMP_V;
      this.vx = (fw ? 1 : bk ? -1 : 0) * this.facing * JUMP_VX * this.speedMul;
      this.airAttacked = false;
      this.anim.set('jump', 16);
      this.game.audio.jump();
      return;
    }
    if (inp.held.down) {
      this.state = 'crouch';
      this.vx = 0;
      this.anim.set(bk ? 'crouchBlock' : 'crouch', 18);
      return;
    }
    if (fw || bk) {
      this.state = 'walk';
      this.vx = (fw ? 1 : -0.75) * this.facing * this.def.walk * this.speedMul;
      this.anim.set('idle', 12);
      return;
    }
    this.state = 'idle';
    this.vx = 0;
    this.anim.set('idle', 12);
  }

  doSpecial(i) {
    const m = this.def.specials[i];
    if (!m) return false;
    if (m.kind === 'projectile' && this.game.hazards.hasProjectile(this)) return false;
    this.startMove(m);
    return true;
  }

  doSuper() {
    this.meter = 0;
    const m = this.def.super;
    this.game.superFlash(this, m);
    this.startMove(m, true);
  }

  startMove(m, isSuper = false) {
    this.move = m;
    this.isSuper = isSuper;
    this.moveFrame = 0;
    this.hitIds = new Set();
    this.hitConfirmed = false;
    this.spawned = false;
    this.state = 'attack';
    this.rushPhase = null;
    if (!m.air) this.vx = 0;
    if (m.invuln) this.invuln = m.invuln;
    if (isSuper) this.invuln = Math.max(this.invuln, m.startup + 4);
    this.anim.set(m.pose[0], m.startup <= 5 ? 30 : 20, { duration: (m.startup + (m.active ?? 1) + m.recovery) / 60, restart: true });
    this.body.setExpression('effort');
    if (m.shout) {
      this.game.fx.bubble(m.shout, this, isSuper ? 'super' : 'special', 1.6);
      this.game.audio.whoosh(isSuper ? 1.5 : 1.0);
    } else {
      this.game.audio.whoosh(m.heavy ? 0.8 : 0.5);
    }
    if (this.game.hooks?.onMove) this.game.hooks.onMove(this, m);
  }

  // --- per-frame logic ---------------------------------------------------------------

  step() {
    this.frame++;
    if (this.invuln > 0) this.invuln--;
    if (this.slow > 0) {
      this.slow--;
      if (this.slow % 45 === 0) this.game.fx.text('📚 zZz', this.headPos(), 'tiny');
    }
    if (this.buffFrames > 0) {
      this.buffFrames--;
      if (this.frame % 4 === 0) this.game.fx.flame(this);
    }

    switch (this.state) {
      case 'idle':
      case 'walk':
      case 'crouch':
        this.faceOpponent();
        this.neutralInput();
        break;
      case 'jump':
        if (this.input && !this.airAttacked) {
          if (this.input.take('hk')) {
            this.airAttacked = true;
            this.startMove(NORMALS.airKick);
          } else if (this.input.take('lp')) {
            this.airAttacked = true;
            this.startMove(NORMALS.airPunch);
          }
        }
        break;
      case 'land':
        this.vx = 0;
        if (--this.stun <= 0) this.toNeutral();
        break;
      case 'attack':
        this.stepMove();
        break;
      case 'hitstun':
      case 'blockstun':
        this.vx = damp(this.vx, 0, 8, DT);
        if (--this.stun <= 0 && this.grounded) {
          this.comboHits = 0;
          this.comboDmg = 0;
          this.toNeutral();
        }
        break;
      case 'dizzy':
        this.vx = 0;
        if (--this.stun <= 0) {
          this.stars.visible = false;
          this.comboHits = 0;
          this.toNeutral();
        }
        break;
      case 'down':
        this.vx = damp(this.vx, 0, 10, DT);
        if (--this.stun <= 0) {
          this.state = 'getup';
          this.stun = 18;
          this.anim.set('getUp', 10, { duration: 0.32 });
        }
        break;
      case 'getup':
        if (--this.stun <= 0) {
          this.invuln = 10;
          this.comboHits = 0;
          this.comboDmg = 0;
          this.toNeutral();
        }
        break;
      default:
        break;
    }

    // Physics.
    // Grabbed fighters and K.O. gags are positioned by someone else.
    const free = !['grabbed', 'gag', 'gone'].includes(this.state);
    const airborne = this.y > 0 || this.vy > 0;
    if (airborne && free) {
      this.vy -= GRAVITY * DT * (this.state === 'knockdown' || this.state === 'ko' ? 0.85 : 1);
      this.y += this.vy * DT;
    }
    if (free) this.x += this.vx * DT;
    if (this.y <= 0 && airborne && free) this.land();
    if (free) this.x = clamp(this.x, -STAGE_HALF, STAGE_HALF);
  }

  land() {
    this.y = 0;
    const vy = this.vy;
    this.vy = 0;
    if (this.state === 'knockdown' || this.state === 'ko') {
      this.game.fx.dust(this.x, 1.4);
      this.game.audio.thud();
      this.game.shake(0.18);
      if (this.state === 'ko') {
        this.vx *= 0.3;
        this.game.match?.onKoLanded(this);
        return;
      }
      if (vy < -8) {
        // A little bounce.
        this.vy = 4.5;
        this.y = 0.01;
        return;
      }
      this.state = 'down';
      this.stun = 34;
      this.anim.set('lying', 12);
      return;
    }
    if (this.state === 'attack' && this.move?.air) {
      this.state = 'land';
      this.stun = 5;
      this.move = null;
      this.anim.set('crouch', 20);
      return;
    }
    if (this.state === 'attack' && this.move?.kind === 'dive') {
      this.game.combat.diveImpact(this);
      return;
    }
    if (this.state === 'jump') {
      this.state = 'land';
      this.stun = 4;
      this.anim.set('crouch', 24);
      this.game.fx.dust(this.x, 0.5);
      return;
    }
    if (this.state === 'hitstun') this.state = 'hitstun';
  }

  stepMove() {
    const m = this.move;
    const f = ++this.moveFrame;
    const s = m.startup;
    const a = m.active ?? 1;
    const r = m.recovery;

    if (m.kind === 'rush' && f > s) return this.stepRush();
    if (m.kind === 'dive' && f > s) return this.stepDive();
    if (m.kind === 'grab' && this.grabTarget) return this.stepGrabHold();

    if (f === s + 1) {
      this.anim.set(m.pose[1] ?? m.pose[0], 34);
      this.onActive(m);
    }
    const ground = !m.air;
    if (m.moveVx && f <= s + a) this.vx = this.facing * m.moveVx * this.speedMul;
    else if (ground) this.vx = damp(this.vx, 0, 12, DT);
    if (m.spin) this.spin += f <= s + a ? 0.6 : 0;

    if (f > s && f <= s + a) {
      if (m.kind === 'melee') this.game.combat.checkMelee(this);
      if (m.kind === 'grab') this.game.combat.checkGrab(this);
      if (this.whip) this.whip.visible = !!m.whip;
      if (this.whip?.visible) this.whip.scale.x = (m.range[1] * this.reach) * Math.min(1, (f - s) / 3);
    } else if (this.whip && f > s + a) {
      this.whip.visible = false;
    }
    if (f > s + a && f > s + a + r * 0.55) this.anim.set(m.air ? 'jump' : m.crouching ? 'crouch' : 'idle', 10);

    // Cancel a connecting normal into a special or super (or jab into kick).
    if (m.cancel && this.hitConfirmed && f > s && this.input) {
      if (this.input.take('sup') && this.meter >= 100) return this.doSuper();
      if (this.input.take('s1') && this.doSpecial(0)) return;
      if (this.input.take('s2') && this.doSpecial(1)) return;
      if (m === NORMALS.jab && this.input.take('hk')) return this.startMove(NORMALS.kick);
      if (m === NORMALS.lowJab && this.input.take('hk')) return this.startMove(NORMALS.sweep);
    }

    if (f > s + a + r) {
      this.spin = 0;
      if (m.air && this.y > 0) {
        this.state = 'jump';
        this.anim.set('jump', 14);
        this.move = null;
      } else {
        this.toNeutral();
      }
    }
  }

  onActive(m) {
    const g = this.game;
    switch (m.kind) {
      case 'projectile':
        g.hazards.spawnProjectile(this, m);
        g.audio.throw();
        break;
      case 'teleport': {
        const opp = this.opp;
        g.fx.smoke(this.x, 1.2);
        const behind = opp.x + (opp.x > this.x ? 1.3 : -1.3);
        this.x = clamp(behind, -STAGE_HALF, STAGE_HALF);
        this.invuln = 12;
        this.faceOpponent();
        g.fx.smoke(this.x, 1.2);
        g.audio.pop();
        break;
      }
      case 'buff':
        this.buff = m.buff;
        this.buffFrames = m.buff.frames;
        g.fx.text('POWER UP!', this.headPos(), 'gold');
        g.audio.powerUp();
        break;
      case 'wave':
        g.hazards.spawnWave(this, m);
        g.audio.blast();
        break;
      case 'rain':
        g.hazards.spawnRain(this, m);
        break;
      case 'summon':
        g.hazards.spawnSummon(this, m);
        break;
      default:
        if (m.aura) g.fx.ring(this.x + this.facing * 1.2, 1.2, 0xff9f1c);
        break;
    }
  }

  // QA's Regression Test: dash in, then a flurry of rewinding hits.
  stepRush() {
    const m = this.move;
    const opp = this.opp;
    if (!this.rushPhase) {
      this.rushPhase = 'dash';
      this.rushFrame = 0;
      this.anim.set('dash', 30);
    }
    this.rushFrame++;
    if (this.rushPhase === 'dash') {
      this.vx = this.facing * 17;
      if (this.rushFrame % 2 === 0) this.game.fx.afterimage(this);
      const close = Math.abs(opp.x - this.x) < 1.3 && Math.abs(opp.y - this.y) < 1.5;
      if (close && opp.hurtable) {
        this.rushPhase = 'combo';
        this.rushFrame = 0;
        this.rushHits = 0;
        this.vx = 0;
      } else if (this.rushFrame > 26) {
        this.rushPhase = 'recover';
        this.rushFrame = 0;
      }
    } else if (this.rushPhase === 'combo') {
      this.vx = 0;
      if (this.rushFrame % 5 === 1) {
        const last = this.rushHits === m.hits - 1;
        this.anim.set(this.rushHits % 2 ? 'kick' : 'punch', 40);
        this.game.fx.afterimage(this);
        this.game.combat.applyHit(this, opp, {
          dmg: m.dmg / m.hits, hitstun: 30, blockstun: 10, push: last ? 0 : 0.05, chip: 0.2, knockdown: last,
          launch: last ? [7, 9] : null, word: last ? 'REGRESSION!' : null, sfx: 'punch', isSuper: true,
        });
        this.rushHits++;
        if (this.rushHits >= m.hits) {
          this.rushPhase = 'recover';
          this.rushFrame = 0;
        }
      }
    } else if (this.rushFrame > m.recovery) {
      this.toNeutral();
    }
  }

  // The Chairman's Golden Parachute: leap off-screen, then dive onto the opponent.
  stepDive() {
    if (!this.rushPhase) {
      this.rushPhase = 'up';
      this.vy = 24;
      this.vx = 0;
      this.anim.set('cheer', 20);
      this.game.fx.coins(this.x, 0.5, 20);
      this.game.audio.blast();
    }
    if (this.rushPhase === 'up' && this.vy < 4) {
      this.rushPhase = 'hover';
      this.rushFrame = 0;
      this.vy = 0;
    }
    if (this.rushPhase === 'hover') {
      this.vy = 0;
      this.x = damp(this.x, this.opp.x, 6, DT);
      if (++this.rushFrame > 22) {
        this.rushPhase = 'down';
        this.vy = -30;
        this.anim.set('airKick', 30);
      }
      if (this.rushFrame % 3 === 0) this.game.fx.coins(this.x, this.y, 2);
    }
    if (this.rushPhase === 'recover' && ++this.rushFrame > this.move.recovery) this.toNeutral();
  }

  stepGrabHold() {
    const opp = this.grabTarget;
    this.grabFrame = (this.grabFrame ?? 0) + 1;
    const f = this.grabFrame;
    this.anim.set('lift', 12);
    opp.x = this.x + this.facing * 0.9;
    opp.y = Math.min(1.4, f * 0.06);
    opp.vx = opp.vy = 0;
    if (f % 8 === 0) this.game.fx.coins(opp.x, opp.y + 1, 3);
    if (f === 40) {
      opp.state = 'hitstun';
      opp.y = 1.4;
      this.game.combat.applyHit(this, opp, {
        dmg: this.move.dmg, unblockable: true, knockdown: true, launch: [9, 10], hitstun: 30, word: 'ACQUIRED!', sfx: 'heavy', heavy: true,
      });
      this.grabTarget = null;
      this.grabFrame = 0;
      this.anim.set('throw', 30);
      this.moveFrame = this.move.startup + (this.move.active ?? 1);
    }
  }

  // --- visuals -------------------------------------------------------------------------

  sync(dt) {
    this.container.position.set(this.x, this.y, 0);
    this.container.scale.x = this.facing;
    const st = this.state;
    const lying = st === 'down' || (st === 'ko' && this.y <= 0.01) || st === 'knockdown' || st === 'ko';
    const targetTilt = st === 'down' || (st === 'ko' && this.y <= 0.01) ? -1.45 : st === 'knockdown' || st === 'ko' ? -0.9 : 0;
    this.tilt = damp(this.tilt, targetTilt, lying ? 10 : 14, dt);
    // Mixamo clips animate falling and lying down themselves.
    if (this.body.animated) this.tilt = 0;
    this.body.body.rotation.x = this.tilt;
    this.body.body.position.y = this.tilt < -1 ? 0.25 : 0;
    this.body.body.rotation.y = this.spin;
    if (this.spin && !(st === 'attack' && this.move?.spin)) this.spin = damp(this.spin, 0, 8, dt);
    const walking = st === 'walk' ? Math.sign(this.vx) * this.facing * Math.min(1, Math.abs(this.vx) / 2) : 0;
    const planted = this.y <= 0.01 && !['knockdown', 'ko', 'down', 'gag', 'gone', 'grabbed'].includes(st) && !(st === 'attack' && this.move?.air);
    this.anim.update(dt, { walk: walking, breathe: st === 'idle' || st === 'walk', dizzy: st === 'dizzy', plant: planted });
    if (this.stars.visible) {
      this.stars.children.forEach((s, i) => {
        const a = this.anim.time * 5 + (i / 3) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.5, Math.sin(this.anim.time * 7 + i) * 0.06, Math.sin(a) * 0.5);
        s.rotation.y = a;
      });
    }
    // Blink while invulnerable after getting up.
    const blink = this.invuln > 0 && (st === 'idle' || st === 'walk' || st === 'getup') && Math.floor(this.frame / 3) % 2 === 0;
    this.body.root.visible = st === 'gone' ? false : !blink;
  }
}
