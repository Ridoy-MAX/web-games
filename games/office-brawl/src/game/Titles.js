// Funny corporate job titles, earned by career score.
export const JOB_TITLES = [
  { min: 0, title: 'Unpaid Intern', icon: '🪪' },
  { min: 2500, title: 'Junior Associate', icon: '📎' },
  { min: 6000, title: 'Mid-Level Menace', icon: '🖇️' },
  { min: 11000, title: 'Senior Brawler', icon: '🥊' },
  { min: 17000, title: 'Team Lead of Violence', icon: '📋' },
  { min: 25000, title: 'Manager of Mayhem', icon: '📈' },
  { min: 35000, title: 'Director of Knuckle Sandwiches', icon: '🥪' },
  { min: 48000, title: 'VP of Beatdowns', icon: '💼' },
  { min: 65000, title: 'CEO of Beating People Up', icon: '👑' },
];

export function jobTitle(score = 0) {
  let t = JOB_TITLES[0];
  for (const j of JOB_TITLES) if (score >= j.min) t = j;
  return t;
}
