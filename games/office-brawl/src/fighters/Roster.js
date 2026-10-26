// Every fighter: look (for Body), stats, two specials, a super, a funny K.O.
// and some trash talk. Move kinds are implemented in Fighter.js / Hazards.js.

const SKIN = { light: 0xf3c9a5, tan: 0xd9a066, brown: 0xa86b3c, deep: 0x7a4a2a, pale: 0xf7d9c4 };

export const ROSTER = [
  {
    id: 'junior',
    name: 'Jay',
    role: 'Junior Developer',
    color: '#8f5bd6',
    bio: 'Two weeks of experience. Forty tabs of Stack Overflow. Zero fear.',
    stats: { power: 2, speed: 5, range: 3 },
    hp: 950,
    walk: 3.6,
    power: 0.95,
    look: {
      skin: SKIN.tan, hair: 'messy', hairColor: 0x3b2414, top: 'hoodie', topColor: 0x7b46d6, shirt: 0x7b46d6,
      pants: 0x3d5a80, shoes: 0xf2f2f2, sneakers: true, headphones: 0x222222, prop: 'energyDrink', blush: true,
    },
    specials: [
      {
        name: 'Stack Overflow Paste', short: 'CTRL+V', kind: 'projectile', startup: 12, recovery: 18, dmg: 70,
        pose: ['throwWind', 'throw'], shout: 'Ctrl+C… Ctrl+V!',
        projectile: { model: 'clipboard', speed: 9, y: 1.5, w: 0.6, h: 0.6, life: 2.2, spin: 12 },
      },
      {
        name: 'Works On My Machine', short: 'WOMM', kind: 'teleport', startup: 10, recovery: 14,
        pose: ['powerUp', 'idle'], shout: 'Works on my machine!',
      },
    ],
    super: {
      name: 'Force Push to Main', kind: 'wave', startup: 22, recovery: 26, dmg: 300, hits: 5,
      pose: ['castWind', 'cast'], shout: 'git push --force!!!',
      wave: { model: 'pushWave', speed: 12, w: 1.6, h: 2.4, life: 1.6 },
    },
    ko: 'chair',
    koLine: 'I QUIT! …can I still get a reference?',
    victory: 'dab',
    quotes: ['LGTM 👍', 'Ship it!', 'I learned that from a YouTube tutorial.', 'Is it Friday yet?'],
  },
  {
    id: 'senior',
    name: 'Grumbles',
    role: 'Senior Developer',
    color: '#b3302b',
    bio: 'Has seen every framework rise and fall. Communicates exclusively in code-review comments.',
    stats: { power: 5, speed: 2, range: 4 },
    hp: 1050,
    walk: 2.9,
    power: 1.15,
    reach: 1.1,
    look: {
      skin: SKIN.light, hair: 'bald', hairColor: 0x7a6a5a, beard: 0x6b5a4a, glasses: 'square', top: 'flannel', topHex: '#b3302b',
      topColor: 0xb3302b, shirt: 0x333333, pants: 0x4a4a52, shoes: 0x5a3a22, prop: 'mug', belly: 0.4, width: 1.08,
    },
    specials: [
      {
        name: 'Changes Requested', short: 'REVIEW', kind: 'projectile', startup: 16, recovery: 20, dmg: 95,
        pose: ['throwWind', 'point'], shout: 'CHANGES REQUESTED.',
        projectile: { model: 'redX', speed: 6, y: 1.5, w: 0.9, h: 0.9, life: 2.6 },
      },
      {
        name: 'Legacy Spaghetti', short: 'LEGACY', kind: 'melee', startup: 14, active: 6, recovery: 22, dmg: 110,
        range: [0.4, 3.4], height: [0.9, 1.8], hitstun: 22, push: 0.6, knockdown: true,
        pose: ['throwWind', 'cast'], shout: 'Behold: code from 2009!', whip: 'spaghetti',
      },
    ],
    super: {
      name: 'Rewrite It In Rust', kind: 'summon', startup: 26, recovery: 30, dmg: 320,
      pose: ['powerUp', 'point'], shout: 'We are rewriting it… IN RUST!', summon: 'crab',
    },
    ko: 'feature',
    koLine: "It's not a bug… it's a feature…",
    victory: 'shrug',
    quotes: ['Next time, write tests.', 'Back in my day we fought in COBOL.', 'Nit: your guard is down.', 'This could have been a one-liner.'],
  },
  {
    id: 'qa',
    name: 'Quinn',
    role: 'QA Engineer',
    color: '#c6e600',
    bio: 'Finds the bug you swore was impossible. Then files it. Then reopens it.',
    stats: { power: 3, speed: 4, range: 3 },
    hp: 980,
    walk: 3.4,
    power: 1,
    look: {
      skin: SKIN.brown, hair: 'bun', hairColor: 0x1e1410, glasses: 'round', top: 'vest', topColor: 0x3a86ff, shirt: 0x3a86ff,
      pants: 0x2b2d42, shoes: 0x222222, prop: 'magnifier',
    },
    specials: [
      {
        name: 'Bug Report', short: 'BUGS', kind: 'projectile', startup: 12, recovery: 20, dmg: 32,
        pose: ['throwWind', 'throw'], shout: 'Found 3 bugs. Assigning to you.',
        projectile: { model: 'bug', speed: 5.5, y: 0.25, w: 0.5, h: 0.5, life: 2.4, count: 3, spacing: 0.55, ground: true, low: true },
      },
      {
        name: 'Edge Case', short: 'EDGE', kind: 'melee', startup: 8, active: 14, recovery: 18, dmg: 90,
        range: [0.2, 1.5], height: [0, 0.7], low: true, knockdown: true, moveVx: 9,
        pose: ['crouch', 'slide'], shout: 'What about this edge case?!',
      },
    ],
    super: {
      name: 'Regression Test', kind: 'rush', startup: 16, recovery: 26, dmg: 310, hits: 7,
      pose: ['castWind', 'dash'], shout: 'Running the full regression suite!',
    },
    ko: '404',
    koLine: 'Fighter not found.',
    victory: 'point',
    quotes: ['Bug closed: WON\'T FIX.', 'Reproduced on the first try.', 'You failed 47 test cases.', 'Works on my machine? Not on MINE.'],
  },
  {
    id: 'hr',
    name: 'Holly',
    role: 'HR Business Partner',
    color: '#2a9d8f',
    bio: 'Smiles warmly. Keeps a detailed file on everyone. Everyone.',
    stats: { power: 3, speed: 3, range: 5 },
    hp: 1000,
    walk: 3.2,
    power: 1,
    look: {
      skin: SKIN.pale, hair: 'bob', hairColor: 0x161212, top: 'blazer', topColor: 0x2a9d8f, lapel: 0x23867a, shirt: 0xffffff,
      pants: 0x264653, shoes: 0x111111, prop: 'clipboard', lanyard: 0xe63946, blush: true,
    },
    specials: [
      {
        name: 'Mandatory Training', short: 'TRAINING', kind: 'projectile', startup: 14, recovery: 18, dmg: 45,
        pose: ['throwWind', 'throw'], shout: 'Mandatory training. 4 hours. No breaks.',
        projectile: { model: 'pamphlet', speed: 6.5, y: 1.5, w: 0.6, h: 0.7, life: 2.4, slow: 240, spin: 6 },
      },
      {
        name: "Let's Circle Back", short: 'CIRCLE', kind: 'projectile', startup: 12, recovery: 16, dmg: 55,
        pose: ['throwWind', 'throw'], shout: "Let's circle back on that!",
        projectile: { model: 'clipboardSpin', speed: 10, y: 1.4, w: 0.7, h: 0.5, life: 2.0, boomerang: true, spin: 20, hits: 2 },
      },
    ],
    super: {
      name: 'Pink Slip Storm', kind: 'rain', startup: 20, recovery: 24, dmg: 300, hits: 10,
      pose: ['powerUp', 'cheer'], shout: "You're all… FIRED UP!", rain: { model: 'pinkSlip', interval: 6 },
    },
    ko: 'complaint',
    koLine: "I'm filing a formal complaint about this!",
    victory: 'point',
    quotes: ['This is going in your file.', "Let's schedule a 1:1 about that.", 'Remember: we are a family.', 'Please complete the exit survey.'],
  },
  {
    id: 'pm',
    name: 'Parker',
    role: 'Product Manager',
    color: '#59606b',
    bio: 'Has never written a line of code. Has written 900 tickets about it.',
    stats: { power: 3, speed: 4, range: 4 },
    hp: 980,
    walk: 3.4,
    power: 1,
    look: {
      skin: SKIN.light, hair: 'side', hairColor: 0xd9b25c, top: 'fleece', topColor: 0x9ccfff, shirt: 0x9ccfff, vestColor: 0x59606b,
      pants: 0xc2a878, shoes: 0x6b4226, prop: 'phone', earbuds: true,
    },
    specials: [
      {
        name: 'Scope Creep', short: 'SCOPE', kind: 'projectile', startup: 14, recovery: 20, dmg: 50,
        pose: ['castWind', 'cast'], shout: 'Just one more tiny feature…',
        projectile: { model: 'scope', speed: 4, y: 1.4, w: 0.6, h: 0.6, life: 3.2, grow: 1.0 },
      },
      {
        name: 'Pivot', short: 'PIVOT', kind: 'melee', startup: 6, active: 16, recovery: 14, dmg: 75,
        range: [0.1, 1.3], height: [0.8, 2.0], moveVx: 7, invuln: 20, spin: true,
        pose: ['dash', 'punch'], shout: "We're pivoting!",
      },
    ],
    super: {
      name: 'Roadmap Rampage', kind: 'wave', startup: 20, recovery: 26, dmg: 290, hits: 5,
      pose: ['castWind', 'cast'], shout: 'Behold: the Q4 ROADMAP!',
      wave: { model: 'roadmap', speed: 9, w: 1.6, h: 2.2, life: 2.2 },
    },
    ko: 'reschedule',
    koLine: 'Let\'s… reschedule this to next sprint…',
    victory: 'phone',
    quotes: ["Let's take this offline.", 'Per my last email…', 'Great sync, team!', "That's out of scope for you."],
  },
  {
    id: 'scrum',
    name: 'Stan',
    role: 'Scrum Master',
    color: '#ff9f1c',
    bio: 'Believes every problem can be solved with a 15-minute stand-up. It has never been 15 minutes.',
    stats: { power: 3, speed: 4, range: 3 },
    hp: 1000,
    walk: 3.5,
    power: 1,
    look: {
      skin: SKIN.deep, hair: 'messy', hairColor: 0x111111, beanie: 0xff9f1c, glasses: 'round', top: 'cardigan', topColor: 0x6d597a,
      lapel: 0x5a4866, shirt: 0xf4f1de, pants: 0x3d405b, shoes: 0x222222, prop: 'stickyPad', beard: 0x111111,
    },
    specials: [
      {
        name: 'Daily Stand-up', short: 'STANDUP', kind: 'melee', startup: 12, active: 8, recovery: 22, dmg: 40,
        range: [0.3, 2.2], height: [0, 2.4], stun: 75, pose: ['castWind', 'cast'], shout: 'EVERYONE. STAND. UP.', aura: 'standup',
      },
      {
        name: 'Sprint', short: 'SPRINT', kind: 'melee', startup: 8, active: 12, recovery: 16, dmg: 85,
        range: [0.2, 1.4], height: [0.9, 2.0], moveVx: 11, knockdown: true, pose: ['dash', 'dash'], shout: 'SPRINT!!!',
      },
    ],
    super: {
      name: 'Retrospective', kind: 'rain', startup: 20, recovery: 24, dmg: 290, hits: 12,
      pose: ['powerUp', 'cheer'], shout: 'What went well? NOT YOU.', rain: { model: 'sticky', interval: 5 },
    },
    ko: 'sticky',
    koLine: 'Action item: lose less.',
    victory: 'cheer',
    quotes: ['Same time tomorrow?', 'That fight was 13 story points.', 'Any blockers? You, apparently.', "Let's timebox your defeat."],
  },
  {
    id: 'intern',
    name: 'Ian',
    role: 'Summer Intern',
    color: '#ff8c42',
    bio: 'Unpaid. Over-caffeinated. Somehow has admin access to production.',
    stats: { power: 2, speed: 5, range: 3 },
    hp: 900,
    walk: 3.8,
    power: 0.92,
    look: {
      skin: SKIN.tan, hair: 'spiky', hairColor: 0xe0a100, top: 'tshirt', topColor: 0xff8c42, topHex: '#ff8c42', shirtText: '★',
      sleeves: 'short', shirt: 0xff8c42, pants: 0x4a6fa5, shoes: 0xe63946, sneakers: true, prop: 'coffeeTray', lanyard: 0x3a86ff, scale: 0.94,
    },
    specials: [
      {
        name: 'Coffee Run', short: 'COFFEE', kind: 'projectile', startup: 12, recovery: 18, dmg: 40,
        pose: ['throwWind', 'throw'], shout: 'WHO ORDERED THE OAT LATTE?!',
        projectile: { model: 'coffee', speed: 7, y: 1.6, w: 0.45, h: 0.45, life: 2.4, count: 2, spacing: 0.35, gravity: 9, vy: 4.5, spin: 10 },
      },
      {
        name: 'Unpaid Overtime', short: 'OVERTIME', kind: 'buff', startup: 20, recovery: 10,
        pose: ['powerUp', 'flex'], shout: 'I get paid in EXPERIENCE!', buff: { frames: 420, power: 1.45, speed: 1.25 },
      },
    ],
    super: {
      name: 'Reply All', kind: 'rain', startup: 20, recovery: 24, dmg: 280, hits: 12,
      pose: ['powerUp', 'point'], shout: 'RE: RE: RE: RE: Fwd: lunch?', rain: { model: 'email', interval: 5 },
    },
    ko: 'paid',
    koLine: 'Wait… is this paid?',
    victory: 'flex',
    quotes: ['Can I put this on my LinkedIn?', 'Do I get a return offer now?', 'My mom says I\'m a 10x engineer.', 'I accidentally deployed to prod.'],
  },
  {
    id: 'chairman',
    name: 'The Chairman',
    role: 'Chairman of the Board',
    color: '#d4a017',
    bio: 'Owns the building, the company and probably your house. Final boss of the org chart.',
    stats: { power: 5, speed: 3, range: 4 },
    hp: 1200,
    walk: 3.0,
    power: 1.2,
    reach: 1.1,
    boss: true,
    look: {
      skin: SKIN.light, hair: 'slick', hairColor: 0xe8e8e8, browColor: 0xbdbdbd, mustache: 0xe0e0e0, glasses: 'gold', top: 'suit',
      topColor: 0x1d2b53, lapel: 0x16213e, shirt: 0xffffff, tie: 0xd4a017, pocketSquare: 0xd4a017, pants: 0x1d2b53, shoes: 0x111111,
      watch: true, prop: 'pen', belly: 0.6, width: 1.12, scale: 1.06,
    },
    specials: [
      {
        name: 'Hostile Takeover', short: 'TAKEOVER', kind: 'grab', startup: 8, active: 4, recovery: 26, dmg: 150,
        range: [0.2, 1.3], pose: ['grab', 'lift'], shout: 'HOSTILE TAKEOVER!',
      },
      {
        name: 'Layoff Wave', short: 'LAYOFFS', kind: 'projectile', startup: 14, recovery: 20, dmg: 85,
        pose: ['throwWind', 'throw'], shout: 'Restructuring… YOU.',
        projectile: { model: 'briefcase', speed: 8, y: 1.3, w: 0.8, h: 0.6, life: 2.4, spin: 10 },
      },
    ],
    super: {
      name: 'Golden Parachute', kind: 'dive', startup: 18, recovery: 30, dmg: 340,
      pose: ['powerUp', 'airKick'], shout: 'Enjoy my GOLDEN PARACHUTE!',
    },
    ko: 'parachute',
    koLine: 'Fine. I\'ll just take my bonus and leave.',
    victory: 'bow',
    quotes: ["You're all fired. Except me.", 'This meeting is adjourned.', 'Put it on the company card.', 'I own this office. And this floor. And you.'],
  },
];

export const BY_ID = Object.fromEntries(ROSTER.map((c) => [c.id, c]));

// Career mode climbs the org chart; the Chairman is always the final boss.
export const LADDER = ['intern', 'junior', 'qa', 'scrum', 'hr', 'pm', 'senior'];

export function ladderFor(playerId) {
  const list = LADDER.filter((id) => id !== playerId);
  return [...list, playerId === 'chairman' ? 'chairman' : 'chairman'];
}

export const STAGES = {
  office: { name: 'Open-Plan Office', sub: 'Third floor, near the snack bar' },
  server: { name: 'The Server Room', sub: 'Do NOT touch the blinking one' },
  boardroom: { name: 'The Boardroom', sub: 'Penthouse. Smells like money.' },
};

export function stageFor(opponentId, index = 0) {
  if (opponentId === 'chairman') return 'boardroom';
  return ['office', 'server'][index % 2];
}
