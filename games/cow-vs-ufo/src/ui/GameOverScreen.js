import { pick } from '../utils/math.js';
import { formatTime } from './HUD.js';

const $ = (id) => document.getElementById(id);

const FAIL = {
  abducted: [
    "You've been probed… emotionally.",
    'Beamed up. Mom is going to be so worried.',
    'Your cow is now a resident of Zorblax-7.',
  ],
  fall: ['Gravity is not your friend.', 'You found the edge of the world. It was sharp.', 'Cows cannot fly. Science confirmed it again.'],
  anvil: ['Flattened by one ton of cosmic irony.', 'Pancake cow. Delicious, but sad.'],
  chicken: ['The chicken has won this round.', 'Defeated by poultry. Let that sink in.'],
  generic: [
    'Congratulations! You failed spectacularly.',
    'Your gaming license has been temporarily revoked.',
    'The UFO would like to thank you for your cooperation.',
  ],
};

const WIN = [
  'The UFO left a 1-star review and flew home.',
  'Udderly magnificent!',
  'Snacks: eaten. Aliens: humiliated.',
  'The alien is filing a formal complaint.',
];

export function bindEndScreens(ui, game) {
  ui.on('replay', () => game.restartLevel());
  ui.on('next', () => game.nextLevel());
  ui.on('home', () => (location.href = '/'));
}

export function showGameOver(ui, { reason, score, best, newBest, title }) {
  $('go-title').textContent = `${title.icon} ${title.title}`;
  $('go-message').textContent = pick(FAIL[reason] ?? FAIL.generic);
  $('go-score').textContent = score.toLocaleString();
  $('go-best').textContent = best.toLocaleString();
  $('go-newbest').classList.toggle('hidden', !newBest);
  ui.show('gameover');
}

export function showVictory(ui, { food, golden, time, bonus, score, best, title }) {
  $('vic-title').textContent = `${title.icon} ${title.title}`;
  $('vic-message').textContent = pick(WIN);
  $('vic-food').textContent = food;
  $('vic-golden').textContent = golden;
  $('vic-time').textContent = formatTime(time);
  const list = $('vic-bonus');
  list.innerHTML = '';
  const rows = [
    ['Speed bonus', bonus.timeBonus],
    ['Hearts left', bonus.heartBonus],
    ['Flawless (no hits)', bonus.flawless],
  ].filter(([, v]) => v > 0);
  rows.forEach(([label, v], i) => {
    const li = document.createElement('li');
    li.style.animationDelay = `${0.2 + i * 0.15}s`;
    const b = document.createElement('b');
    b.textContent = `+${v.toLocaleString()}`;
    li.append(document.createTextNode(label), b);
    list.appendChild(li);
  });
  $('vic-score').textContent = score.toLocaleString();
  $('vic-best').textContent = best.toLocaleString();
  ui.show('victory');
}
