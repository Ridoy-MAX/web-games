// Funny rank titles, earned by score. Shown on the home page, the leaderboard
// and live in-game when you level up your title.
export const TITLES = [
  { min: 0, title: 'Confused Calf', icon: '🍼' },
  { min: 500, title: 'Lactose-Tolerant Intern', icon: '🥛' },
  { min: 1500, title: 'Professional Grass Muncher', icon: '🌿' },
  { min: 3000, title: 'Hay-Bale Hurdler', icon: '🌾' },
  { min: 5000, title: 'Moo-ster of Disguise', icon: '🥸' },
  { min: 8000, title: 'Udder Chaos Agent', icon: '🕶️' },
  { min: 12000, title: 'Barnyard Ninja', icon: '🥷' },
  { min: 18000, title: 'Abduction Dodger Supreme', icon: '🛸' },
  { min: 26000, title: 'Galactic Cow-mander', icon: '🚀' },
  { min: 40000, title: 'Supreme Bovine Overlord', icon: '👑' },
];

export function titleFor(score = 0) {
  let current = TITLES[0];
  for (const t of TITLES) if (score >= t.min) current = t;
  return current;
}

export function nextTitle(score = 0) {
  return TITLES.find((t) => t.min > score) ?? null;
}
