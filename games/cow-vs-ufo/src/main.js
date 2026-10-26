import './styles.css';
import { Game } from './game/Game.js';
import { fetchMe, getSession } from '../../../src/shared/session.js';

const GAME_ID = 'cow-vs-ufo';

function boot() {
  // A player name is required: send new visitors to the home page to create one.
  const session = getSession();
  if (!session) {
    location.replace(`/?play=${GAME_ID}`);
    return;
  }
  const loading = document.getElementById('loading');
  const canvas = document.getElementById('game');
  canvas.tabIndex = 0;
  try {
    const game = new Game(canvas, session);
    fetchMe()
      .then((me) => game.setProfile(me.progress[GAME_ID]))
      .catch((err) => {
        if (err.status === 401) location.replace(`/?play=${GAME_ID}`);
        else game.setProfile(null, err.message);
      });
    // Handy for debugging from the console.
    window.cowVsUfo = game;
  } catch (err) {
    console.error(err);
    loading.classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    return;
  }
  loading.classList.add('done');
  setTimeout(() => loading.classList.add('hidden'), 600);
}

// Wait for the display font so canvas-drawn signs use it.
const fontsReady = document.fonts?.ready ?? Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(boot);
