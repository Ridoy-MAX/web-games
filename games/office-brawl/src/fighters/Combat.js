import { COMBO_NAMES, HIT_WORDS } from './Moves.js';
import { pick } from '../utils/math.js';

const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

// Resolves every hit in the game: melee, projectiles, hazards and supers.
export class Combat {
  constructor(game) {
    this.game = game;
  }

  // Melee hitbox for the attacker's current move this frame.
  checkMelee(att) {
    const def = att.opp;
    const m = att.move;
    if (!def || att.hitIds.has(def) || !def.hurtable) return;
    const r0 = m.range[0] * att.reach * att.scale;
    const r1 = m.range[1] * att.reach * att.scale;
    const x0 = att.facing > 0 ? att.x + r0 : att.x - r1;
    const x1 = att.facing > 0 ? att.x + r1 : att.x - r0;
    const y0 = att.y + m.height[0] * att.scale;
    const y1 = att.y + m.height[1] * att.scale;
    const hb = def.hurtbox();
    if (!overlap(x0, x1, hb.x0, hb.x1) || !overlap(y0, y1, hb.y0, hb.y1)) return;
    att.hitIds.add(def);
    const result = this.applyHit(att, def, {
      dmg: m.dmg, hitstun: m.hitstun ?? 16, blockstun: m.blockstun ?? 11, push: m.push ?? 0.3, low: m.low, overhead: m.overhead,
      knockdown: m.knockdown, launch: m.launch, stun: m.stun, heavy: m.heavy, sfx: m.sfx, special: !!m.shout, isSuper: att.isSuper,
    });
    if (result !== 'miss') {
      att.hitConfirmed = true;
      att.gainMeter(result === 'hit' ? m.meter ?? 10 : 3);
    }
  }

  checkGrab(att) {
    const def = att.opp;
    const m = att.move;
    if (!def || att.grabTarget || !def.hurtable || def.y > 0.2) return;
    if (['knockdown', 'down', 'getup', 'ko'].includes(def.state)) return;
    const dist = Math.abs(def.x - att.x);
    if (dist > m.range[1] * att.reach + 0.45) return;
    att.grabTarget = def;
    att.grabFrame = 0;
    def.state = 'grabbed';
    def.move = null;
    def.anim.set('hit', 20);
    def.body.setExpression('shock');
    this.game.fx.text('GRABBED!', def.headPos(), 'comic');
    this.game.audio.grab();
  }

  diveImpact(att) {
    const def = att.opp;
    const m = att.move;
    this.game.fx.coins(att.x, 0.2, 40);
    this.game.fx.dust(att.x, 3);
    this.game.shake(0.7);
    this.game.audio.explode();
    if (def.hurtable && Math.abs(def.x - att.x) < 1.9 && def.y < 2.5) {
      this.applyHit(att, def, { dmg: m.dmg, hitstun: 30, blockstun: 22, chip: 0.25, knockdown: true, launch: [8, 12], heavy: true, isSuper: true, word: 'BAILOUT!' });
    }
    att.rushPhase = 'recover';
    att.rushFrame = 0;
    att.vx = 0;
  }

  canBlock(def, h, fromX) {
    if (h.unblockable) return false;
    if (!['idle', 'walk', 'crouch', 'blockstun'].includes(def.state) || def.y > 0.01) return false;
    const awayRight = fromX < def.x;
    const back = def.input && (awayRight ? def.input.held.right : def.input.held.left);
    if (!back) return false;
    const crouching = def.input.held.down;
    if (h.low && !crouching) return false;
    if (h.overhead && crouching) return false;
    return true;
  }

  // Returns 'hit', 'block' or 'miss'.
  applyHit(att, def, h, fromX = att.x) {
    const g = this.game;
    if (!def.hurtable && def.state !== 'grabbed') return 'miss';
    const dir = fromX <= def.x ? 1 : -1;
    const head = def.headPos();

    if (this.canBlock(def, h, fromX)) {
      def.state = 'blockstun';
      def.stun = h.blockstun ?? 10;
      def.blockLow = def.input.held.down;
      def.vx = dir * (h.push ?? 0.3) * 14;
      def.anim.set(def.blockLow ? 'crouchBlock' : 'block', 40);
      const chip = Math.round(h.dmg * (h.chip ?? (h.isSuper ? 0.25 : h.special ? 0.12 : 0)) * att.powerMul);
      if (chip) this.damage(att, def, chip, true);
      def.gainMeter(3);
      g.fx.blockSpark(def.x - dir * 0.4, def.y + (def.blockLow ? 0.9 : 1.6));
      g.audio.block();
      g.hitstop(4);
      if (Math.random() < 0.25) g.fx.text(pick(['BLOCKED!', 'DECLINED!', 'NOT TODAY!', 'NOPE.']), head, 'block');
      return 'block';
    }

    // Damage scales down the longer a combo gets.
    def.comboHits++;
    const scale = Math.max(0.35, 1 - (def.comboHits - 1) * 0.1);
    const dmg = Math.round(h.dmg * scale * att.powerMul);
    this.damage(att, def, dmg, false);
    att.gainMeter(Math.round(dmg * 0.1));
    def.gainMeter(Math.round(dmg * 0.06));
    def.lastHitBy = att;
    def.move = null;
    def.grabTarget = null;
    if (def.whip) def.whip.visible = false;
    def.body.setExpression('hurt');
    def.stars.visible = false;

    const airborne = def.y > 0.05;
    if (def.hp <= 0) {
      def.state = 'ko';
      def.vy = 11;
      def.vx = dir * 7;
      def.y = Math.max(def.y, 0.05);
      def.anim.set('fall', 12);
      def.body.setExpression('ko');
    } else if (h.knockdown || airborne || h.launch) {
      const [lx, ly] = h.launch ?? [5, airborne ? 6 : 8];
      def.state = 'knockdown';
      def.vx = dir * lx;
      def.vy = ly;
      def.y = Math.max(def.y, 0.05);
      def.anim.set('fall', 16);
    } else if (h.stun) {
      def.state = 'dizzy';
      def.stun = h.stun;
      def.vx = 0;
      def.stars.visible = true;
      def.anim.set('dizzy', 10);
      g.fx.text('IN A MEETING…', head, 'block');
    } else {
      def.state = 'hitstun';
      def.stun = h.hitstun ?? 16;
      def.vx = dir * (h.push ?? 0.3) * 14;
      def.anim.snap(def.crouching ? 'hitLow' : 'hit');
    }
    if (h.slow) {
      def.slow = h.slow;
      g.fx.text('SLOWED: TRAINING!', head, 'block');
    }

    const heavy = h.heavy || h.isSuper || dmg > 90;
    g.fx.hitSpark(def.x - dir * 0.3, def.y + (def.crouching ? 0.9 : 1.6), heavy);
    g.audio[h.sfx === 'kick' ? 'kick' : heavy ? 'heavy' : 'punch']();
    g.hitstop(h.isSuper ? 10 : heavy ? 8 : 5);
    g.shake(heavy ? 0.35 : 0.12);
    g.crowd?.react(heavy ? 2 : 1);
    if (h.word || Math.random() < (heavy ? 0.6 : 0.25)) g.fx.text(h.word ?? pick(HIT_WORDS), head, 'comic');
    if (def.comboHits >= 2) {
      const name = COMBO_NAMES[Math.min(def.comboHits, COMBO_NAMES.length - 1)];
      g.onCombo?.(att, def.comboHits, name);
    }
    g.match?.onHit(att, def, dmg);
    return 'hit';
  }

  damage(att, def, amount, chip) {
    // Chip damage from blocking can't finish a round; only clean hits can.
    def.hp = Math.max(chip ? 1 : 0, def.hp - amount);
    def.comboDmg += amount;
    this.game.match?.onDamage(att, def, amount);
  }
}
