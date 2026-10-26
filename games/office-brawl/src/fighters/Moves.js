// Normal attacks shared by every fighter (ranges scale with the fighter's reach).
// Frame data is at 60 fps: startup -> active -> recovery.
export const NORMALS = {
  jab: {
    name: 'Jab', kind: 'melee', startup: 4, active: 3, recovery: 8, dmg: 38, range: [0.3, 1.3], height: [1.2, 2.1],
    hitstun: 14, blockstun: 9, push: 0.22, pose: ['punchWind', 'punch'], cancel: true, sfx: 'punch', meter: 5,
  },
  kick: {
    name: 'Kick', kind: 'melee', startup: 8, active: 4, recovery: 15, dmg: 80, range: [0.3, 1.8], height: [0.9, 1.8],
    hitstun: 19, blockstun: 13, push: 0.4, pose: ['kickWind', 'kick'], cancel: true, sfx: 'kick', meter: 8, heavy: true,
  },
  lowJab: {
    name: 'Low Jab', kind: 'melee', startup: 4, active: 3, recovery: 8, dmg: 28, range: [0.3, 1.25], height: [0.2, 1.1], low: true,
    hitstun: 13, blockstun: 8, push: 0.2, pose: ['crouch', 'lowPunch'], cancel: true, crouching: true, sfx: 'punch', meter: 4,
  },
  sweep: {
    name: 'Sweep', kind: 'melee', startup: 9, active: 4, recovery: 20, dmg: 70, range: [0.3, 1.9], height: [0, 0.6], low: true,
    knockdown: true, blockstun: 12, push: 0.3, pose: ['crouch', 'sweep'], crouching: true, sfx: 'kick', meter: 8, heavy: true,
  },
  airPunch: {
    name: 'Air Punch', kind: 'melee', startup: 4, active: 10, recovery: 2, dmg: 52, range: [0.1, 1.25], height: [0.4, 1.8], overhead: true,
    hitstun: 16, blockstun: 10, push: 0.25, pose: ['jump', 'airPunch'], air: true, sfx: 'punch', meter: 6,
  },
  airKick: {
    name: 'Air Kick', kind: 'melee', startup: 6, active: 10, recovery: 2, dmg: 78, range: [0.2, 1.65], height: [0, 1.3], overhead: true,
    hitstun: 18, blockstun: 12, push: 0.35, pose: ['jump', 'airKick'], air: true, sfx: 'kick', meter: 8, heavy: true,
  },
};

// Funny comic words for hits.
export const HIT_WORDS = ['BONK!', 'WHAM!', 'PING!', 'OOF!', 'SYNERGY!', 'BAM!', 'ESCALATED!', 'PWNED!', 'SMACK!', 'BLOCKER!'];

export const COMBO_NAMES = ['', '', 'PAIR PROGRAMMING!', 'AGILE!', 'SCRUM-TASTIC!', '10X DEVELOPER!', 'PROMOTED!', 'STOCK OPTIONS!', 'UNICORN STATUS!'];
