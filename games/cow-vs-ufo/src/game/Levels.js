const NAMES = ['Cow-ntryside Calm', 'Udder Chaos', 'Moo-ltiverse Mayhem'];
const ATTACKS = [['anvils'], ['anvils', 'wheels', 'sweep'], ['anvils', 'wheels', 'sweep', 'magnet', 'trap']];

// Levels are generated so "Next level" always has somewhere to go. The first
// three are hand-named; after that the UFO just keeps getting angrier.
export function levelConfig(n) {
  return {
    n,
    name: NAMES[n - 1] ?? `Bovine Overdrive ${n - NAMES.length}`,
    target: Math.min(20, 8 + (n - 1) * 3),
    ufoSpeed: Math.min(14, 7.5 + n * 1.1),
    beamDrift: Math.min(5.4, 2.8 + n * 0.45),
    beamTime: Math.min(4.6, 3 + n * 0.3),
    abductTime: Math.max(1.25, 2.3 - n * 0.2),
    huntTime: Math.max(1.3, 3.6 - n * 0.45),
    specialChance: Math.min(0.7, 0.35 + n * 0.1),
    attacks: ATTACKS[Math.min(n, ATTACKS.length) - 1],
    hideLimit: Math.max(3, 6.5 - n),
    eventMin: Math.max(12, 22 - n * 2),
    eventMax: Math.max(20, 32 - n * 2),
    parTime: 50 + n * 25,
  };
}
