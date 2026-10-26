import './styles.css';
import { Game } from './game/Game.js';
import { loadModels } from './fighters/Models.js';
import { fetchMe, getSession } from '../../../src/shared/session.js';

const GAME_ID = 'office-brawl';

function boot() {
  // Every game is played under the player's account; no session → sign in first.
  const session = getSession();
  if (!session) {
    location.replace(`/?play=${GAME_ID}`);
    return;
  }
  const loading = document.getElementById('loading');
  try {
    const game = new Game(document.getElementById('game'), session);
    window.officeBrawl = game;
    fetchMe()
      .then((me) => game.setProfile(me.progress[GAME_ID]))
      .catch((err) => {
        if (err.status === 401) location.replace(`/?play=${GAME_ID}`);
        else game.setProfile(null, err.message);
      });
  } catch (err) {
    console.error(err);
    loading.classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    return;
  }
  loading.classList.add('done');
  setTimeout(() => loading.classList.add('hidden'), 500);
}

const fonts = document.fonts?.ready ?? Promise.resolve();
const label = document.querySelector('#loading p');
// Load the 3D employees; if they're missing, the game falls back to built-in bodies.
const models = loadModels((p) => (label.textContent = `Hiring employees… ${Math.round(p * 100)}%`)).catch((err) => console.warn('Character models unavailable, using built-in bodies.', err));
Promise.all([models, Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))])]).then(boot);
